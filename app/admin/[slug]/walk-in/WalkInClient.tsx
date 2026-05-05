'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { CartLine, MenuCategory, MenuItem, Restaurant } from '@/lib/types';

export default function WalkInClient({
  restaurant,
  categories,
  items
}: {
  restaurant: Restaurant;
  categories: MenuCategory[];
  items: MenuItem[];
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ pickupCode: string; total: number } | null>(null);

  const cartCount = Object.values(cart).reduce((s, l) => s + l.qty, 0);
  const subtotal = Object.values(cart).reduce((s, l) => s + l.qty * l.item.price, 0);
  const tax = Math.round(subtotal * (restaurant.tax_rate / 100));
  const total = subtotal + tax;

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
    if (!customerName.trim()) {
      alert('Please enter the customer name');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          orderType: 'parcel',
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          notes: notes.trim() || null,
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
      if (data.id && data.pickupCode) {
        setLastOrder({ pickupCode: data.pickupCode, total: Number(data.total ?? total) });
        // Reset form
        setCart({});
        setCustomerName('');
        setCustomerPhone('');
        setNotes('');
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
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-5 flex justify-between items-end flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
          <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Walk-in counter</h1>
          <p className="text-sm text-charcoal/60 mt-1">Take a parcel/takeaway order from a customer at the counter.</p>
        </div>
        <Link href={`/admin/${restaurant.slug}/orders`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded">View orders</Link>
      </header>

      {/* Success banner */}
      {lastOrder && (
        <div className="bg-forest text-white rounded-lg p-4 mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80 tracking-wide uppercase">Order sent to kitchen ✓</div>
            <div className="font-serif text-2xl mt-0.5">Pickup code: {lastOrder.pickupCode}</div>
            <div className="text-xs opacity-80 mt-0.5">Total: ₹{lastOrder.total.toLocaleString('en-IN')}</div>
          </div>
          <button
            onClick={() => setLastOrder(null)}
            className="text-xs px-3 py-1 bg-white/20 rounded hover:bg-white/30"
          >
            Take another order
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Menu (2 cols) */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-charcoal/10 rounded-lg p-5 max-h-[70vh] overflow-y-auto">
            {categories.map(cat => {
              const catItems = items.filter(i => i.category_id === cat.id);
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id}>
                  <div className="text-xs tracking-widest text-charcoal/50 mt-3 first:mt-0 mb-2 sticky top-0 bg-white py-1">
                    {cat.name.toUpperCase()}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {catItems.map(item => {
                      const qty = cart[item.id]?.qty ?? 0;
                      return (
                        <button
                          key={item.id}
                          onClick={() => inc(item)}
                          className={`text-left p-3 rounded-lg border transition-colors ${
                            qty > 0 ? 'border-forest bg-forest/5' : 'border-charcoal/10 hover:border-charcoal/30'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item.name}</div>
                              <div className="text-xs text-charcoal/60 mt-0.5">₹{item.price}</div>
                            </div>
                            {qty > 0 && (
                              <span className="bg-forest text-white text-xs font-medium w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                                {qty}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart sidebar (1 col) */}
        <div>
          <div className="bg-white border border-charcoal/10 rounded-lg p-5 sticky top-4">
            <h2 className="font-serif text-lg mb-3">Order</h2>

            {/* Customer info */}
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer name *"
                className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
              />
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
              />
            </div>

            {/* Cart items */}
            {cartCount === 0 ? (
              <div className="text-center py-6 text-charcoal/50 text-sm border-t border-charcoal/10">
                Tap menu items to add
              </div>
            ) : (
              <>
                <div className="border-t border-charcoal/10 pt-3 max-h-60 overflow-y-auto">
                  {Object.values(cart).map(line => (
                    <div key={line.item.id} className="py-2 flex justify-between items-center text-sm gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{line.item.name}</div>
                        <div className="text-xs text-charcoal/60">₹{line.item.price}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => dec(line.item.id)} className="w-6 h-6 rounded border border-charcoal/30 text-sm">−</button>
                        <span className="w-5 text-center text-xs font-medium">{line.qty}</span>
                        <button onClick={() => inc(line.item)} className="w-6 h-6 rounded border border-charcoal/30 text-sm">+</button>
                      </div>
                      <div className="text-sm font-medium w-14 text-right shrink-0">₹{line.qty * line.item.price}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-charcoal/10 space-y-1 text-sm">
                  <div className="flex justify-between text-charcoal/70"><span>Subtotal</span><span>₹{subtotal}</span></div>
                  <div className="flex justify-between text-charcoal/70"><span>GST {restaurant.tax_rate}%</span><span>₹{tax}</span></div>
                  <div className="flex justify-between text-base font-medium pt-1 mt-1 border-t border-charcoal/10">
                    <span>Total</span><span>₹{total}</span>
                  </div>
                </div>

                <button
                  onClick={placeOrder}
                  disabled={submitting || !customerName.trim()}
                  className="w-full mt-4 bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Send parcel order to kitchen'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
