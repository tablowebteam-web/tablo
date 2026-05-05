'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type { CartLine, MenuCategory, MenuItem, Restaurant } from '@/lib/types';

type Tab = 'menu' | 'cart' | 'status';

interface ActiveOrder {
  id: string;
  status: string;
  total: number;
  pickup_code: string | null;
  created_at: string;
}

interface PreviewOffer {
  offerType: string;
  description: string;
  discountAmount: number;
}

export default function ParcelOrderClient({
  restaurant,
  categories,
  items,
  customerProfile,
  initialActiveOrders = []
}: {
  restaurant: Restaurant;
  categories: MenuCategory[];
  items: MenuItem[];
  customerProfile: { id: string; name: string | null; phone: string | null };
  initialActiveOrders?: ActiveOrder[];
}) {
  const [tab, setTab] = useState<Tab>('menu');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>(initialActiveOrders);
  const [submitting, setSubmitting] = useState(false);
  const [previewOffer, setPreviewOffer] = useState<PreviewOffer | null>(null);

  const cartCount = Object.values(cart).reduce((s, l) => s + l.qty, 0);
  const subtotal = Object.values(cart).reduce((s, l) => s + l.qty * l.item.price, 0);
  const discount = previewOffer && subtotal > 0 ? Math.min(previewOffer.discountAmount, subtotal) : 0;
  const subtotalAfter = Math.max(0, subtotal - discount);
  const tax = Math.round(subtotalAfter * (restaurant.tax_rate / 100));
  const total = subtotalAfter + tax;

  // Offer preview
  useEffect(() => {
    fetch(`/api/offer-preview?restaurantId=${restaurant.id}&subtotal=${subtotal || 1000}`)
      .then(r => r.json())
      .then(data => setPreviewOffer(data.offer ?? null))
      .catch(() => {});
  }, [subtotal, restaurant.id]);

  // Realtime updates
  useEffect(() => {
    if (activeOrders.length === 0) return;
    const orderIds = activeOrders.map(o => o.id);
    let mounted = true;

    import('@/lib/supabase').then(({ supabase }) => {
      const channel = supabase
        .channel(`parcel-orders-${customerProfile.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
          if (!mounted) return;
          const updated = payload.new as any;
          if (orderIds.includes(updated.id)) {
            setActiveOrders(prev =>
              prev
                .map(o => o.id === updated.id ? { ...o, status: updated.status, total: Number(updated.total) } : o)
                .filter(o => !['paid', 'cancelled', 'served'].includes(o.status))
            );
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });

    return () => { mounted = false; };
  }, [activeOrders.map(o => o.id).join(','), customerProfile.id]);

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
          orderType: 'parcel',
          customerId: customerProfile.id,
          customerName: customerProfile.name,
          customerPhone: customerProfile.phone,
          items: Object.values(cart).map(l => ({
            menuItemId: l.item.id,
            name: l.item.name,
            price: l.item.price,
            qty: l.qty
          })),
          subtotal
        })
      });
      const data = await res.json();
      if (data.id) {
        setActiveOrders(prev => [{
          id: data.id,
          status: 'received',
          total: Number(data.total ?? total),
          pickup_code: data.pickupCode,
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
        {/* Header — distinct parcel theme */}
        <div className="px-5 pt-5 pb-4 border-b border-charcoal/10 bg-cream/40">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] tracking-[2px] text-charcoal/50 font-medium">TABLO</span>
            <span className="text-[10px] tracking-[2px] bg-forest text-white px-2 py-0.5 rounded">📦 PARCEL</span>
          </div>
          <div className="font-serif text-2xl leading-tight">{restaurant.name}</div>
          <div className="text-xs text-charcoal/60 mt-1 italic">Takeaway · pickup at counter</div>

          <div className="mt-3 flex justify-between items-center">
            <Link
              href={`/me?returnTo=${encodeURIComponent(`/r/${restaurant.slug}/parcel`)}`}
              className="text-[11px] text-forest hover:underline flex items-center gap-1.5"
            >
              <span className="w-5 h-5 rounded-full bg-forest text-white flex items-center justify-center text-[9px] font-medium">
                {(customerProfile.name ?? 'U').slice(0, 1).toUpperCase()}
              </span>
              <span className="font-medium">Hi {customerProfile.name ?? 'there'}</span>
            </Link>
            <Link href={`/r/${restaurant.slug}/t/1`} className="text-[10px] text-charcoal/50 hover:text-charcoal">
              Dining in instead? →
            </Link>
          </div>
        </div>

        {/* Offer banner */}
        {previewOffer && (
          <div className="px-5 pt-3">
            <div className="bg-gradient-to-r from-forest to-emerald rounded-lg p-3 text-white text-sm leading-relaxed">
              <strong>{previewOffer.description}</strong>
              <div className="text-xs opacity-90 mt-0.5">Discount applied automatically.</div>
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
          <div className="px-5 pb-24">
            {categories.map(cat => {
              const catItems = items.filter(i => i.category_id === cat.id);
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
                            {item.is_chef_pick && <span className="text-[9px] tracking-wide bg-cream text-forest px-1.5 py-0.5 rounded">CHEF</span>}
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
            {cartCount > 0 && (
              <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-3 bg-white border-t border-charcoal/10">
                <button onClick={() => setTab('cart')} className="w-full bg-forest text-white py-3 rounded-md text-sm font-medium flex items-center justify-between px-4">
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
              <div className="text-center py-16 text-charcoal/50 text-sm">Your cart is empty.</div>
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
                      <span>{previewOffer.description}</span><span>−₹{discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-charcoal/70"><span>GST {restaurant.tax_rate}%</span><span>₹{tax}</span></div>
                  <div className="flex justify-between text-base font-medium pt-2 mt-2 border-t border-charcoal/10">
                    <span>Total</span><span>₹{total}</span>
                  </div>
                </div>
                <button onClick={placeOrder} disabled={submitting} className="w-full mt-6 bg-forest text-white py-3 rounded-md text-sm font-medium disabled:opacity-50">
                  {submitting ? 'Sending…' : 'Place parcel order'}
                </button>
                <div className="text-center text-[11px] text-charcoal/50 mt-2">📦 Pay at counter when picking up</div>
              </>
            )}
          </div>
        )}

        {/* Status */}
        {tab === 'status' && (
          <div className="px-5 py-5">
            {activeOrders.length === 0 ? (
              <div className="text-center py-16 text-charcoal/50 text-sm">No active parcel orders.</div>
            ) : (
              <div className="space-y-3">
                {activeOrders.map(o => <ParcelStatusCard key={o.id} order={o} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function ParcelStatusCard({ order }: { order: ActiveOrder }) {
  const stages = ['received', 'preparing', 'ready'];
  const stageIdx = stages.indexOf(order.status);

  return (
    <div className={`rounded-lg p-4 border-2 ${
      order.status === 'ready' ? 'bg-emerald-50 border-emerald-300' : 'bg-cream/50 border-cream'
    }`}>
      <div className="flex justify-between items-start mb-1">
        <div className="text-xs text-charcoal/60">📦 Parcel order</div>
        <div className="text-xs font-medium">₹{Number(order.total).toLocaleString('en-IN')}</div>
      </div>
      <div className="font-serif text-3xl text-forest mb-1">
        {order.pickup_code ?? '—'}
      </div>
      <div className="text-xs text-charcoal/60 mb-3">Show this code at the counter</div>

      <div className="font-serif text-base mb-3">
        {order.status === 'received' && 'Order received — chef will start soon'}
        {order.status === 'preparing' && 'Being prepared in the kitchen'}
        {order.status === 'ready' && '🎉 Ready for pickup!'}
      </div>
      <div className="grid grid-cols-3 gap-1">
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
