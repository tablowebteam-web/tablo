'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type { CartLine, MenuCategory, MenuItem, Restaurant, RestaurantTable } from '@/lib/types';

type Mode = 'dine_in' | 'parcel';
type Tab = 'menu' | 'cart' | 'status';
type Filter = 'all' | 'veg' | 'chef' | 'nutfree';

interface ActiveOrder {
  id: string;
  status: string;
  total: number;
  table_number: number | null;
  pickup_code: string | null;
  order_type: string | null;
  created_at: string;
}

interface PreviewOffer {
  offerType: string;
  description: string;
  discountAmount: number;
}

export default function GuestOrderClient({
  restaurant,
  table,
  categories,
  items,
  customerProfile,
  initialActiveOrders = []
}: {
  restaurant: Restaurant;
  table: RestaurantTable;
  categories: MenuCategory[];
  items: MenuItem[];
  customerProfile: { id: string; name: string | null } | null;
  initialActiveOrders?: ActiveOrder[];
}) {
  const [mode, setMode] = useState<Mode>('dine_in');
  const [tab, setTab] = useState<Tab>('menu');
  const [filter, setFilter] = useState<Filter>('all');

  // TWO separate carts — one per mode
  const [dineInCart, setDineInCart] = useState<Record<string, CartLine>>({});
  const [parcelCart, setParcelCart] = useState<Record<string, CartLine>>({});

  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>(initialActiveOrders);
  const [submitting, setSubmitting] = useState(false);
  const [previewOffer, setPreviewOffer] = useState<PreviewOffer | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Currently active cart (based on mode)
  const cart = mode === 'dine_in' ? dineInCart : parcelCart;
  const setCart = mode === 'dine_in' ? setDineInCart : setParcelCart;

  const filteredItems = useMemo(() => items.filter(it => {
    if (filter === 'all') return true;
    if (filter === 'veg') return it.is_veg;
    if (filter === 'chef') return it.is_chef_pick;
    if (filter === 'nutfree') return !(it.allergens ?? []).includes('nuts');
    return true;
  }), [items, filter]);

  // Dine-in cart totals
  const dineInCount = Object.values(dineInCart).reduce((s, l) => s + l.qty, 0);
  const dineInSubtotal = Object.values(dineInCart).reduce((s, l) => s + l.qty * l.item.price, 0);

  // Parcel cart totals
  const parcelCount = Object.values(parcelCart).reduce((s, l) => s + l.qty, 0);
  const parcelSubtotal = Object.values(parcelCart).reduce((s, l) => s + l.qty * l.item.price, 0);

  const totalCount = dineInCount + parcelCount;

  // Discount applies only to current mode's cart at preview time
  const currentSubtotal = mode === 'dine_in' ? dineInSubtotal : parcelSubtotal;
  const currentCount = mode === 'dine_in' ? dineInCount : parcelCount;

  const discount = previewOffer && currentSubtotal > 0
    ? Math.min(previewOffer.discountAmount, currentSubtotal)
    : 0;
  const subtotalAfter = Math.max(0, currentSubtotal - discount);
  const tax = Math.round(subtotalAfter * (restaurant.tax_rate / 100));
  const total = subtotalAfter + tax;

  // Switching mode: if switching to parcel and not logged in, show prompt
  function switchMode(newMode: Mode) {
    if (newMode === 'parcel' && !customerProfile) {
      setShowLoginPrompt(true);
      return;
    }
    setMode(newMode);
    setShowLoginPrompt(false);
  }

  // Offer preview
  useEffect(() => {
    if (!customerProfile) return;
    const sub = currentSubtotal || 1000;
    const t = setTimeout(() => {
      fetch(`/api/offer-preview?restaurantId=${restaurant.id}&subtotal=${sub}`)
        .then(r => r.json())
        .then(data => setPreviewOffer(data.offer ?? null))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [currentSubtotal, customerProfile, restaurant.id]);

  // Realtime updates
  useEffect(() => {
    if (activeOrders.length === 0) return;
    const orderIds = activeOrders.map(o => o.id);
    let mounted = true;

    import('@/lib/supabase').then(({ supabase }) => {
      const channel = supabase
        .channel(`guest-orders-${table.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
          if (!mounted) return;
          const updated = payload.new as any;
          if (orderIds.includes(updated.id)) {
            setActiveOrders(prev =>
              prev
                .map(o => o.id === updated.id ? { ...o, status: updated.status, total: Number(updated.total) } : o)
                .filter(o => !['paid', 'cancelled'].includes(o.status))
            );
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });

    return () => { mounted = false; };
  }, [activeOrders.map(o => o.id).join(','), table.id]);

  function inc(item: MenuItem) {
    setCart(c => ({ ...c, [item.id]: { item, qty: (c[item.id]?.qty ?? 0) + 1 } }));
  }
  function dec(itemId: string) {
    setCart(c => {
      const cur = c[itemId];
      if (!cur) return c;
      const newQty = cur.qty - 1;
      const next = { ...c };
      if (newQty <= 0) delete next[itemId];
      else next[itemId] = { ...cur, qty: newQty };
      return next;
    });
  }

  async function placeOrder() {
    if (currentCount === 0 || submitting) return;
    setSubmitting(true);
    try {
      const payload: any = {
        restaurantId: restaurant.id,
        customerId: customerProfile?.id ?? null,
        items: Object.values(cart).map(l => ({
          menuItemId: l.item.id,
          name: l.item.name,
          price: l.item.price,
          qty: l.qty
        })),
        subtotal: currentSubtotal
      };

      if (mode === 'dine_in') {
        payload.tableId = table.id;
        payload.tableNumber = table.number;
        payload.orderType = 'dine_in';
      } else {
        payload.orderType = 'parcel';
        payload.customerName = customerProfile?.name ?? null;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.id) {
        setActiveOrders(prev => [{
          id: data.id,
          status: 'received',
          total: Number(data.total ?? total),
          table_number: mode === 'dine_in' ? table.number : null,
          pickup_code: data.pickupCode ?? null,
          order_type: mode,
          created_at: new Date().toISOString()
        }, ...prev]);
        // Clear ONLY the cart that was just ordered
        if (mode === 'dine_in') setDineInCart({});
        else setParcelCart({});
        setTab('status');
      } else {
        alert(data.error ?? 'Could not place order');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FBFAF7]">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-charcoal/10">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] tracking-[2px] text-charcoal/50 font-medium">TABLO</span>
            <span className="text-[11px] text-charcoal/60">Table {table.number} · seats {table.capacity}</span>
          </div>
          <div className="font-serif text-2xl leading-tight">{restaurant.name}</div>
          {restaurant.tagline && <div className="text-xs text-charcoal/60 mt-1 italic">{restaurant.tagline}</div>}

          <div className="mt-3 flex justify-between items-center">
            {customerProfile ? (
              <Link
                href={`/me?returnTo=${encodeURIComponent(`/r/${restaurant.slug}/t/${table.number}`)}`}
                className="text-[11px] text-forest hover:underline flex items-center gap-1.5"
              >
                <span className="w-5 h-5 rounded-full bg-cream text-forest flex items-center justify-center text-[9px] font-medium">
                  {(customerProfile.name ?? 'U').slice(0, 1).toUpperCase()}
                </span>
                <span className="font-medium">Hi {customerProfile.name ?? 'there'}</span>
                <span className="text-charcoal/40">· View profile</span>
              </Link>
            ) : (
              <div className="text-[11px] text-charcoal/60">
                <Link href={`/customer-login?next=${encodeURIComponent(`/r/${restaurant.slug}/t/${table.number}`)}`} className="text-forest font-medium hover:underline">
                  Sign in
                </Link>
                <span className="ml-1">to track orders & order parcel</span>
              </div>
            )}
          </div>
        </div>

        {/* MODE TOGGLE — the new piece */}
        <div className="px-5 pt-3">
          <div className="flex gap-1 p-1 bg-charcoal/5 rounded-lg">
            <button
              onClick={() => switchMode('dine_in')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                mode === 'dine_in' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/60'
              }`}
            >
              🍽️ Dine in
              {dineInCount > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  mode === 'dine_in' ? 'bg-forest text-white' : 'bg-charcoal/15 text-charcoal/70'
                }`}>{dineInCount}</span>
              )}
            </button>
            <button
              onClick={() => switchMode('parcel')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                mode === 'parcel' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/60'
              }`}
            >
              📦 Parcel
              {parcelCount > 0 && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  mode === 'parcel' ? 'bg-forest text-white' : 'bg-charcoal/15 text-charcoal/70'
                }`}>{parcelCount}</span>
              )}
            </button>
          </div>
          <div className="text-[10px] text-charcoal/50 text-center mt-1.5">
            {mode === 'dine_in'
              ? 'Items will be served at your table'
              : 'Items will be packed for takeaway with a pickup code'}
          </div>
        </div>

        {/* OFFER BANNER */}
        {previewOffer && (
          <div className="px-5 pt-3">
            <div className="bg-gradient-to-r from-forest to-emerald rounded-lg p-3 text-white text-sm leading-relaxed">
              <strong>{previewOffer.description}</strong>
              <div className="text-xs opacity-90 mt-0.5">Discount applied automatically at checkout.</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-charcoal/10 sticky top-0 bg-white z-10">
          {(['menu', 'cart', 'status'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm capitalize border-b-2 transition-colors ${
                tab === t ? 'border-charcoal text-charcoal font-medium' : 'border-transparent text-charcoal/60'
              }`}
            >
              {t}
              {t === 'cart' && totalCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-forest text-white rounded-full">{totalCount}</span>
              )}
              {t === 'status' && activeOrders.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-forest text-white rounded-full">{activeOrders.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Menu */}
        {tab === 'menu' && (
          <div>
            <div className="flex gap-1.5 px-4 py-3 overflow-x-auto border-b border-charcoal/10">
              {(['all', 'veg', 'chef', 'nutfree'] as Filter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap ${
                    filter === f ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-charcoal/70 border-charcoal/20'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'veg' ? 'Veg' : f === 'chef' ? "Chef's pick" : 'Nut-free'}
                </button>
              ))}
            </div>
            <div className="px-5 pb-24">
              {categories.map(cat => {
                const catItems = filteredItems.filter(i => i.category_id === cat.id);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <div className="text-[10px] tracking-[2px] text-charcoal/50 font-medium mt-5 mb-2">{cat.name.toUpperCase()}</div>
                    {catItems.map(item => {
                      const qty = cart[item.id]?.qty ?? 0;
                      return (
                        <div key={item.id} className="py-3 border-b border-charcoal/10 flex justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {item.is_veg && (
                                <span className="w-3 h-3 border border-green-700 flex items-center justify-center">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-700" />
                                </span>
                              )}
                              <span className="text-sm font-medium">{item.name}</span>
                              {item.is_chef_pick && (
                                <span className="text-[9px] tracking-wide bg-cream text-forest px-1.5 py-0.5 rounded">CHEF</span>
                              )}
                            </div>
                            {item.description && <div className="text-xs text-charcoal/60 leading-relaxed">{item.description}</div>}
                            <div className="text-sm mt-1">₹{item.price}</div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {item.image_url && (
                              <div className="relative w-20 h-20 rounded-md overflow-hidden bg-charcoal/5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              {qty > 0 && (
                                <>
                                  <button onClick={() => dec(item.id)} className="w-7 h-7 rounded-full border border-charcoal/30 text-base">−</button>
                                  <span className="text-sm font-medium w-4 text-center">{qty}</span>
                                </>
                              )}
                              <button onClick={() => inc(item)} className={`w-7 h-7 rounded-full text-base ${qty > 0 ? 'border border-charcoal/30' : 'bg-charcoal text-white'}`}>+</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {currentCount > 0 && (
              <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-3 bg-white border-t border-charcoal/10">
                <button
                  onClick={() => setTab('cart')}
                  className="w-full bg-forest text-white py-3 rounded-md text-sm font-medium flex items-center justify-between px-4"
                >
                  <span>{mode === 'dine_in' ? '🍽️' : '📦'} {currentCount} item{currentCount !== 1 ? 's' : ''} in {mode === 'dine_in' ? 'dine-in' : 'parcel'} cart</span>
                  <span>₹{total} →</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cart */}
        {tab === 'cart' && (
          <div className="px-5 py-5">
            {totalCount === 0 ? (
              <div className="text-center py-16 text-charcoal/50 text-sm">Both carts are empty. Pick something from the menu.</div>
            ) : (
              <div className="space-y-6">
                {/* Dine-in cart */}
                {dineInCount > 0 && (
                  <CartSection
                    icon="🍽️"
                    title="Dine in"
                    cart={dineInCart}
                    subtotal={dineInSubtotal}
                    taxRate={restaurant.tax_rate}
                    isCurrent={mode === 'dine_in'}
                    previewOffer={mode === 'dine_in' ? previewOffer : null}
                    discount={mode === 'dine_in' ? discount : 0}
                    submitting={submitting}
                    onSwitch={() => setMode('dine_in')}
                    onPlaceOrder={placeOrder}
                  />
                )}

                {/* Parcel cart */}
                {parcelCount > 0 && (
                  <CartSection
                    icon="📦"
                    title="Parcel / takeaway"
                    cart={parcelCart}
                    subtotal={parcelSubtotal}
                    taxRate={restaurant.tax_rate}
                    isCurrent={mode === 'parcel'}
                    previewOffer={mode === 'parcel' ? previewOffer : null}
                    discount={mode === 'parcel' ? discount : 0}
                    submitting={submitting}
                    onSwitch={() => setMode('parcel')}
                    onPlaceOrder={placeOrder}
                  />
                )}

                {dineInCount > 0 && parcelCount > 0 && (
                  <div className="text-[11px] text-charcoal/60 text-center bg-cream/50 rounded p-2">
                    💡 Place each cart separately — kitchen handles them differently
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status */}
        {tab === 'status' && (
          <div className="px-5 py-5">
            {activeOrders.length === 0 ? (
              <div className="text-center py-16 text-charcoal/50 text-sm">No active orders yet.</div>
            ) : (
              <div className="space-y-3">
                {activeOrders.map(o => <OrderStatusCard key={o.id} order={o} />)}
                {activeOrders.some(o => o.order_type !== 'parcel') && (
                  <Link
                    href={`/r/${restaurant.slug}/t/${table.number}/bill`}
                    className="block w-full bg-charcoal text-white text-center py-3 rounded-md text-sm font-medium hover:bg-charcoal/90 mt-4"
                  >
                    💸 Request bill & pay
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* LOGIN PROMPT MODAL */}
      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLoginPrompt(false)}>
          <div className="bg-white rounded-lg max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-3">📦</div>
            <h2 className="font-serif text-xl mb-2">Sign in for parcel orders</h2>
            <p className="text-sm text-charcoal/60 mb-5">
              Parcel orders need a pickup code so we know who's collecting it. Sign in or create an account in 30 seconds.
            </p>
            <Link
              href={`/customer-login?next=${encodeURIComponent(`/r/${restaurant.slug}/t/${table.number}`)}`}
              className="block w-full bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90"
            >
              Sign in to continue
            </Link>
            <button
              onClick={() => setShowLoginPrompt(false)}
              className="block w-full mt-3 text-xs text-charcoal/60 hover:text-charcoal"
            >
              Continue with dine-in only
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function CartSection({
  icon,
  title,
  cart,
  subtotal,
  taxRate,
  isCurrent,
  previewOffer,
  discount,
  submitting,
  onSwitch,
  onPlaceOrder
}: {
  icon: string;
  title: string;
  cart: Record<string, CartLine>;
  subtotal: number;
  taxRate: number;
  isCurrent: boolean;
  previewOffer: PreviewOffer | null;
  discount: number;
  submitting: boolean;
  onSwitch: () => void;
  onPlaceOrder: () => void;
}) {
  const subtotalAfter = Math.max(0, subtotal - discount);
  const tax = Math.round(subtotalAfter * (taxRate / 100));
  const total = subtotalAfter + tax;

  return (
    <div className={`rounded-lg p-4 border ${isCurrent ? 'border-forest bg-forest/5' : 'border-charcoal/15 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-serif text-lg flex items-center gap-2">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        {!isCurrent && (
          <button onClick={onSwitch} className="text-[11px] text-forest hover:underline">
            Add more →
          </button>
        )}
      </div>

      <div className="space-y-2">
        {Object.values(cart).map(line => (
          <div key={line.item.id} className="flex justify-between text-sm">
            <div>
              <div className="font-medium">{line.item.name}</div>
              <div className="text-xs text-charcoal/60">₹{line.item.price} × {line.qty}</div>
            </div>
            <div className="font-medium">₹{line.qty * line.item.price}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-charcoal/10 space-y-1 text-xs">
        <div className="flex justify-between text-charcoal/70"><span>Subtotal</span><span>₹{subtotal}</span></div>
        {discount > 0 && previewOffer && (
          <div className="flex justify-between text-forest font-medium">
            <span>{previewOffer.description}</span><span>−₹{discount}</span>
          </div>
        )}
        <div className="flex justify-between text-charcoal/70"><span>GST {taxRate}%</span><span>₹{tax}</span></div>
        <div className="flex justify-between text-sm font-medium pt-1 mt-1 border-t border-charcoal/10">
          <span>Total</span><span>₹{total}</span>
        </div>
      </div>

      <button
        onClick={() => { if (!isCurrent) onSwitch(); else onPlaceOrder(); }}
        disabled={submitting}
        className="w-full mt-4 bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50"
      >
        {!isCurrent
          ? `Switch to ${title.toLowerCase()} to order`
          : submitting
            ? 'Sending…'
            : `Send ${title.toLowerCase()} to kitchen`}
      </button>
    </div>
  );
}

function OrderStatusCard({ order }: { order: ActiveOrder }) {
  const isParcel = order.order_type === 'parcel';
  const stages = isParcel ? ['received', 'preparing', 'ready'] : ['received', 'preparing', 'ready', 'served'];
  const stageIdx = stages.indexOf(order.status);

  return (
    <div className={`rounded-lg p-4 border-2 ${
      isParcel && order.status === 'ready'
        ? 'bg-emerald-50 border-emerald-300'
        : isParcel
          ? 'bg-amber-50/50 border-amber-200'
          : 'bg-cream/50 border-cream'
    }`}>
      <div className="flex justify-between items-start mb-1">
        <div>
          {isParcel ? (
            <>
              <div className="text-xs text-amber-800 font-medium tracking-wide">📦 PARCEL</div>
              <div className="font-serif text-2xl text-forest leading-none mt-0.5">{order.pickup_code ?? '—'}</div>
              <div className="text-[10px] text-charcoal/60 mt-0.5">Show this at the counter</div>
            </>
          ) : (
            <>
              <div className="text-xs text-charcoal/60 font-medium tracking-wide">🍽️ DINE IN</div>
              <div className="font-serif text-2xl mt-0.5">Table {order.table_number}</div>
              <div className="text-[10px] text-charcoal/60">#{order.id.slice(0, 6)}</div>
            </>
          )}
        </div>
        <div className="text-xs font-medium">₹{Number(order.total).toLocaleString('en-IN')}</div>
      </div>
      <div className="font-serif text-base mt-3 mb-3">
        {order.status === 'received' && 'Order received — kitchen will start soon'}
        {order.status === 'preparing' && (isParcel ? 'Being prepared in the kitchen' : 'Your courses are being prepared')}
        {order.status === 'ready' && (isParcel ? '🎉 Ready for pickup!' : 'Ready! Server bringing it now')}
        {order.status === 'served' && 'Enjoy your meal 🍽️'}
      </div>
      <div className={`grid gap-1 ${stages.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {stages.map((s, i) => (
          <div key={s}>
            <div className={`h-1 rounded-full ${i <= stageIdx ? 'bg-forest' : 'bg-charcoal/15'}`} />
            <div className={`text-[10px] mt-1.5 capitalize text-center ${i <= stageIdx ? 'text-forest font-medium' : 'text-charcoal/40'}`}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
