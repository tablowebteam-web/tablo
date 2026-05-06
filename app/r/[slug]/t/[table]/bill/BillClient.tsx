'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Restaurant, RestaurantTable } from '@/lib/types';

interface OrderItem { name: string; qty: number; price: number }
interface BillOrder {
  id: string;
  total: number;
  subtotal: number;
  tax: number;
  discount_amount: number | null;
  applied_offer: string | null;
  status: string;
  created_at: string;
  customer_name: string | null;
  customer_id: string | null;
  order_type: string | null;
  pickup_code: string | null;
  order_items: OrderItem[];
}

export default function BillClient({
  restaurant,
  table,
  orders,
  customerProfile
}: {
  restaurant: Restaurant & { upi_id?: string | null; upi_payee_name?: string | null };
  table: RestaurantTable;
  orders: BillOrder[];
  customerProfile: { id: string; name: string | null; phone: string | null } | null;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [step, setStep] = useState<'view' | 'claim' | 'claimed'>('view');
  const [reference, setReference] = useState('');
  const [name, setName] = useState(customerProfile?.name ?? '');
  const [phone, setPhone] = useState(customerProfile?.phone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate combined total
  const totalAmount = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalSubtotal = orders.reduce((s, o) => s + Number(o.subtotal), 0);
  const totalTax = orders.reduce((s, o) => s + Number(o.tax), 0);
  const totalDiscount = orders.reduce((s, o) => s + Number(o.discount_amount ?? 0), 0);

  // Build UPI URL
  const upiUrl = restaurant.upi_id
    ? `upi://pay?pa=${encodeURIComponent(restaurant.upi_id)}&pn=${encodeURIComponent(restaurant.upi_payee_name ?? restaurant.name)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(`Table ${table.number} - ${restaurant.name}`)}`
    : null;

  // Generate QR code
  useEffect(() => {
    if (!upiUrl) return;
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(upiUrl, {
        margin: 2,
        width: 320,
        color: { dark: '#0F6E56', light: '#FFFFFF' }
      }).then(setQrDataUrl).catch(() => {});
    });
  }, [upiUrl]);

  async function claimPayment() {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/payment-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          tableId: table.id,
          tableNumber: table.number,
          customerId: customerProfile?.id ?? null,
          customerName: name.trim(),
          customerPhone: phone.trim() || null,
          totalAmount,
          upiReference: reference.trim() || null,
          orderIds: orders.map(o => o.id)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit');
        setSubmitting(false);
        return;
      }
      setStep('claimed');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (orders.length === 0) {
    return (
      <main className="min-h-screen bg-[#FBFAF7] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <h1 className="font-serif text-xl mb-2">No bill to show yet</h1>
          <p className="text-sm text-charcoal/60 mb-4">You haven't placed any orders at this table.</p>
          <Link href={`/r/${restaurant.slug}/t/${table.number}`} className="text-sm text-forest hover:underline">
            ← Back to menu
          </Link>
        </div>
      </main>
    );
  }

  if (step === 'claimed') {
    return (
      <main className="min-h-screen bg-[#FBFAF7] p-4">
        <div className="max-w-md mx-auto bg-white rounded-lg p-6 mt-6 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="font-serif text-2xl mb-1">Thank you!</h1>
          <p className="text-sm text-charcoal/60 mb-4">
            We've notified the restaurant. They'll verify your payment and confirm shortly.
          </p>
          <div className="bg-cream/50 rounded p-3 text-sm text-charcoal/80">
            <div className="text-xs text-charcoal/60 mb-1">Amount paid</div>
            <div className="font-serif text-2xl">₹{totalAmount.toLocaleString('en-IN')}</div>
            {reference && (
              <div className="text-xs text-charcoal/60 mt-2">UPI ref: {reference}</div>
            )}
          </div>
          <Link
            href={`/receipt/ord_${orders.map(o => o.id).join(',')}`}
            target="_blank"
            className="block mt-5 bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90"
          >
            🧾 Download receipt (PDF)
          </Link>
          <Link href={`/r/${restaurant.slug}/t/${table.number}`} className="block mt-3 text-sm text-charcoal/60 hover:text-charcoal">
            ← Back to menu
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FBFAF7]">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-charcoal/10">
          <Link href={`/r/${restaurant.slug}/t/${table.number}`} className="text-xs text-charcoal/60">← Menu</Link>
          <div className="font-serif text-2xl mt-1">{restaurant.name}</div>
          <div className="text-xs text-charcoal/60 mt-0.5">Table {table.number} · Bill</div>
        </div>

        {/* Bill */}
        <div className="px-5 py-5">
          <h2 className="font-serif text-xl mb-3">Your bill</h2>

          {orders.map((order, i) => (
            <div key={order.id} className="mb-5">
              <div className="text-[11px] tracking-widest text-charcoal/50 mb-2 flex justify-between">
                <span>{order.order_type === 'parcel' ? `📦 PARCEL ${order.pickup_code ?? ''}` : `ORDER ${i + 1}`}</span>
                <span>{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
              </div>
              <div className="space-y-1.5">
                {order.order_items.map((it, j) => (
                  <div key={j} className="flex justify-between text-sm">
                    <span className="flex-1 truncate pr-2">{it.name} × {it.qty}</span>
                    <span className="text-charcoal/70 shrink-0">₹{(it.price * it.qty).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t border-charcoal/10 pt-3 mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between text-charcoal/70">
              <span>Subtotal</span><span>₹{totalSubtotal.toLocaleString('en-IN')}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-forest font-medium">
                <span>Discount</span><span>−₹{totalDiscount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-charcoal/70">
              <span>GST</span><span>₹{totalTax.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xl font-medium pt-3 mt-3 border-t border-charcoal/20">
              <span className="font-serif">Total</span>
              <span className="font-serif">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        {step === 'view' && (
          <div className="px-5 pb-8">
            {restaurant.upi_id && qrDataUrl ? (
              <>
                <div className="bg-cream/50 rounded-lg p-4 text-center">
                  <h3 className="font-serif text-lg mb-1">Pay via UPI</h3>
                  <p className="text-xs text-charcoal/60 mb-3">Scan with GPay, PhonePe, Paytm or any UPI app</p>

                  <div className="bg-white p-3 rounded inline-block mx-auto">
                    <img src={qrDataUrl} alt="UPI QR" className="w-48 h-48" />
                  </div>

                  <div className="mt-3 text-xs text-charcoal/60">
                    Or pay to: <strong className="text-charcoal">{restaurant.upi_id}</strong>
                  </div>
                </div>

                <a
                  href={upiUrl!}
                  className="block w-full mt-4 bg-forest text-white py-3 rounded-md text-sm font-medium text-center hover:bg-forest/90"
                >
                  📱 Open in UPI app
                </a>
                <div className="text-[10px] text-charcoal/50 text-center mt-1">Works on phones with GPay, PhonePe etc. installed</div>

                <button
                  onClick={() => setStep('claim')}
                  className="w-full mt-4 bg-charcoal text-white py-3 rounded-md text-sm font-medium hover:bg-charcoal/90"
                >
                  ✓ I've paid
                </button>
              </>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">💳</div>
                <h3 className="font-serif text-lg mb-1">Pay at the counter</h3>
                <p className="text-sm text-charcoal/70">
                  Please pay <strong>₹{totalAmount.toLocaleString('en-IN')}</strong> at the counter.
                </p>
                <p className="text-xs text-charcoal/60 mt-2">Online payment isn't set up for this restaurant yet.</p>
              </div>
            )}
          </div>
        )}

        {step === 'claim' && (
          <div className="px-5 pb-8">
            <div className="bg-white border border-charcoal/15 rounded-lg p-5">
              <h3 className="font-serif text-xl mb-1">Confirm your payment</h3>
              <p className="text-xs text-charcoal/60 mb-4">
                Please enter your details so the restaurant can verify your payment of <strong>₹{totalAmount.toLocaleString('en-IN')}</strong>.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-charcoal/70 mb-1">Your name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-charcoal/70 mb-1">Phone (optional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 98470 12345"
                    className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-charcoal/70 mb-1">UPI reference / last 4 digits</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="e.g. 1234 or full ref ID"
                    maxLength={50}
                    className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
                  />
                  <div className="text-[10px] text-charcoal/50 mt-1">
                    Find this in your UPI app's payment confirmation. Helps verify faster.
                  </div>
                </div>

                {error && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setStep('view')}
                    disabled={submitting}
                    className="px-4 py-2.5 border border-charcoal/20 rounded-md text-sm font-medium hover:bg-charcoal/5"
                  >
                    Back
                  </button>
                  <button
                    onClick={claimPayment}
                    disabled={submitting || !name.trim()}
                    className="flex-1 bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting…' : 'Notify restaurant'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
