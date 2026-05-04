'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type { CartLine, MenuCategory, MenuItem, Restaurant, RestaurantTable } from '@/lib/types';

type Tab = 'menu' | 'cart' | 'status';
type Filter = 'all' | 'veg' | 'chef' | 'nutfree';

interface ActiveOrder {
  id: string;
  status: string;
  total: number;
  table_number: number | null;
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
  const [tab, setTab] = useState<Tab>('menu');
  const [filter, setFilter] = useState<Filter>('all');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>(initialActiveOrders);
  const [submitting, setSubmitting] = useState(false);
  const [previewOffer, setPreviewOffer] = useState<PreviewOffer | null>(null);

  const filteredItems = useMemo(() => items.filter(it => {
    if (filter === 'all') return true;
    if (filter === 'veg') return it.is_veg;
    if (filter === 'chef') return it.is_chef_pick;
    if (filter === 'nutfree') return !(it.allergens ?? []).includes('nuts');
    return true;
  }), [items, filter]);

  const cartCount = Object.values(cart).reduce((s, l) => s + l.qty, 0);
  const subtotal = Object.values(cart).reduce((s, l) => s + l.qty * l.item.price, 0);

  // Calculate discount based on preview offer
  const discount = previewOffer && subtotal > 0
    ? (() => {
        // Re-scale the preview discount to match real subtotal proportionally if it's percent-based
        // Easiest approach: just request a fresh preview when subtotal changes
        return Math.min(previewOffer.discountAmount, subtotal);
      })()
    : 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discount);
  const tax = Math.round(subtotalAfterDiscount * (restaurant.tax_rate / 100));
  const total = subtotalAfterDiscount + tax;

  // Fetch initial offer preview when customer is logged in
  useEffect(() => {
    if (!customerProfile) return;
    fetch(`/api/offer-preview?restaurantId=${restaurant.id}&subtotal=1000`)
      .then(r => r.json())
      .then(data => {
        if (data.offer) setPreviewOffer(data.offer);
      })
      .catch(() => {});
  }, [customerProfile, restaurant.id]);

  // Re-fetch preview when subtotal changes (so percent discounts scale correctly)
  useEffect(() => {
    if (!customerProfile || subtotal === 0) return;
    const t = setTimeout(() => {
      fetch(`/api/offer-preview?restaurantId=${restaurant.id}&subtotal=${subtotal}`)
        .then(r => r.json())
        .then(data => setPreviewOffer(data.offer ?? null))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [subtotal, customerProfile, restaurant.id]);

  // Realtime updates for active orders
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
    if (cartCount === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          tableId: table.id,
          tableNumber: table.number,
          customerId: customerProfile?.id ?? null,
          items: Object.values(cart).map(l => ({
            menuItemId: l.item.id,
            name: l.item.name,
            price: l.item.price,
            qty: l.qty
          })),
          subtotal,
          tax,
          total
        })
      });
      const data = await res.json();
      if (data.id) {
        setActiveOrders(prev => [{
          id: data.id,
          status: 'received',
          total: Number(data.total ?? total),
          table_number: table.number,
          created_at: new Date().toISOString()
        }, ...prev]);
        setCart({});
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
                <span className="ml-1">to track orders & unlock offers</span>
              </div>
            )}
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
              {t === 'cart' && cartCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-forest text-white rounded-full">{cartCount}</span>
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

            {cartCount > 0 && (
              <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-3 bg-white border-t border-charcoal/10">
                <button
                  onClick={() => setTab('cart')}
                  className="w-full bg-forest text-white py-3 rounded-md text-sm font-medium flex items-center justify-between px-4"
                >
                  <span>{cartCount} item{cartCount !== 1 ? 's' : ''} in cart</span>
                  <span>₹{total} →</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cart */}
        {tab === 'cart' && (
          <div className="px-5 py-5">
            {cartCount === 0 ? (
              <div className="text-center py-16 text-charcoal/50 text-sm">Your cart is empty. Pick something from the menu.</div>
            ) : (
              <>
                {Object.values(cart).map(line => (
                  <div key={line.item.id} className="py-3 border-b border-charcoal/10 flex justify-between">
                    <div>
                      <div className="text-sm font-medium">{line.item.name}</div>
                      <div className="text-xs text-charcoal/60">₹{line.item.price} × {line.qty}</div>
                    </div>
                    <div className="text-sm font-medium">₹{line.qty * line.item.price}</div>
                  </div>
                ))}
                <div className="mt-5 pt-4 border-t border-charcoal/10 space-y-1.5 text-sm">
                  <div className="flex justify-between text-charcoal/70"><span>Subtotal</span><span>₹{subtotal}</span></div>
                  {discount > 0 && previewOffer && (
                    <div className="flex justify-between text-forest font-medium">
                      <span>{previewOffer.description}</span>
                      <span>−₹{discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-charcoal/70"><span>GST {restaurant.tax_rate}%</span><span>₹{tax}</span></div>
                  <div className="flex justify-between text-base font-medium pt-2 mt-2 border-t border-charcoal/10">
                    <span>Total</span><span>₹{total}</span>
                  </div>
                </div>
                <button
                  onClick={placeOrder}
                  disabled={submitting}
                  className="w-full mt-6 bg-forest text-white py-3 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Send to kitchen'}
                </button>
                <div className="text-center text-[11px] text-charcoal/50 mt-2">Pay at the end of your meal</div>
              </>
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
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function OrderStatusCard({ order }: { order: ActiveOrder }) {
  const stages = ['received', 'preparing', 'ready', 'served'];
  const stageIdx = stages.indexOf(order.status);
  return (
    <div className="bg-cream/50 rounded-lg p-4">
      <div className="flex justify-between items-start mb-1">
        <div className="text-xs text-charcoal/60">Order #{order.id.slice(0, 8)}</div>
        <div className="text-xs font-medium">₹{Number(order.total).toLocaleString('en-IN')}</div>
      </div>
      <div className="font-serif text-lg mb-3">
        {order.status === 'received' && 'Order received — kitchen will start soon'}
        {order.status === 'preparing' && 'Your courses are being prepared'}
        {order.status === 'ready' && 'Ready! Server bringing it now'}
        {order.status === 'served' && 'Enjoy your meal 🍽️'}
      </div>
      <div className="grid grid-cols-4 gap-1">
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
