'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Restaurant } from '@/lib/types';

export default function SettingsClient({
  restaurant
}: {
  restaurant: Restaurant & {
    upi_id?: string | null;
    upi_payee_name?: string | null;
    payment_mode?: 'pay_after' | 'pay_first' | null;
  };
}) {
  const [upiId, setUpiId] = useState(restaurant.upi_id ?? '');
  const [upiPayeeName, setUpiPayeeName] = useState(restaurant.upi_payee_name ?? restaurant.name);
  const [paymentMode, setPaymentMode] = useState<'pay_after' | 'pay_first'>(restaurant.payment_mode ?? 'pay_after');
  const [saving, setSaving] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function show(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function saveUpi() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/restaurant-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        upi_id: upiId.trim() || null,
        upi_payee_name: upiPayeeName.trim() || null
      })
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e.error ?? 'Save failed');
      return;
    }
    show('UPI settings saved ✓');
  }

  async function savePaymentMode(newMode: 'pay_after' | 'pay_first') {
    if (savingMode) return;
    if (newMode === 'pay_first' && !upiId.trim() && !restaurant.upi_id) {
      setError('Please add your UPI ID first before enabling pay-first mode');
      return;
    }
    setSavingMode(true);
    setError(null);
    const res = await fetch('/api/restaurant-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        payment_mode: newMode
      })
    });
    setSavingMode(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e.error ?? 'Save failed');
      return;
    }
    setPaymentMode(newMode);
    show(`Switched to ${newMode === 'pay_first' ? 'pay-first' : 'pay-after'} mode ✓`);
  }

  const upiValid = !upiId || /^[\w.-]+@[\w]+$/.test(upiId);

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
        <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Settings</h1>
        <p className="text-sm text-charcoal/60 mt-1">Configure how your restaurant accepts payments.</p>
      </header>

      {/* PAYMENT MODE TOGGLE */}
      <div className="bg-white border border-charcoal/10 rounded-lg p-5 mb-4">
        <h2 className="font-serif text-lg mb-1">⚡ Payment timing</h2>
        <p className="text-xs text-charcoal/60 mb-4">
          Choose when customers pay for their orders.
        </p>

        <div className="space-y-2">
          <label className={`block border-2 rounded-lg p-4 cursor-pointer transition-colors ${
            paymentMode === 'pay_after' ? 'border-forest bg-forest/5' : 'border-charcoal/15 hover:border-charcoal/30'
          }`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="payment_mode"
                value="pay_after"
                checked={paymentMode === 'pay_after'}
                onChange={() => savePaymentMode('pay_after')}
                disabled={savingMode}
                className="mt-1 accent-forest"
              />
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center gap-2">
                  🍽️ Pay at end
                  <span className="text-[10px] bg-cream text-forest px-2 py-0.5 rounded uppercase tracking-wide">Fine dining</span>
                </div>
                <div className="text-xs text-charcoal/60 mt-1">
                  Customer eats first → requests bill at the end → pays before leaving. Best for fine dining, casual dining, anywhere people stay 1+ hours.
                </div>
              </div>
            </div>
          </label>

          <label className={`block border-2 rounded-lg p-4 cursor-pointer transition-colors ${
            paymentMode === 'pay_first' ? 'border-forest bg-forest/5' : 'border-charcoal/15 hover:border-charcoal/30'
          }`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="payment_mode"
                value="pay_first"
                checked={paymentMode === 'pay_first'}
                onChange={() => savePaymentMode('pay_first')}
                disabled={savingMode}
                className="mt-1 accent-forest"
              />
              <div className="flex-1">
                <div className="font-medium text-sm flex items-center gap-2">
                  ⚡ Pay first
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase tracking-wide">Fast food</span>
                </div>
                <div className="text-xs text-charcoal/60 mt-1">
                  Customer pays UPI → restaurant verifies → THEN order goes to kitchen. Best for fast food, quick service, takeaway, busy cafes where you want guaranteed payment before cooking.
                </div>
              </div>
            </div>
          </label>
        </div>

        {paymentMode === 'pay_first' && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
            <strong>Pay-first mode is ON.</strong> Orders won't reach the kitchen until you verify the customer's UPI payment in <Link href={`/admin/${restaurant.slug}/payments`} className="underline">Payments</Link>.
          </div>
        )}

        {savingMode && <div className="text-xs text-charcoal/50 mt-2">Saving…</div>}
      </div>

      {/* UPI Settings */}
      <div className="bg-white border border-charcoal/10 rounded-lg p-5 mb-4">
        <h2 className="font-serif text-lg mb-1">💸 UPI account</h2>
        <p className="text-xs text-charcoal/60 mb-4">
          Where customer payments go. Required for both payment modes.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-charcoal/70 mb-1">Your UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={e => setUpiId(e.target.value.toLowerCase())}
              placeholder="yourname@hdfc"
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none ${
                upiValid ? 'border-charcoal/15 focus:border-forest' : 'border-red-400 focus:border-red-500'
              }`}
            />
            {!upiValid && upiId && (
              <div className="text-[11px] text-red-700 mt-1">Format should be like: name@bank</div>
            )}
            <div className="text-[11px] text-charcoal/50 mt-1">
              Examples: <code className="bg-charcoal/5 px-1 rounded">sahiba@hdfc</code> · <code className="bg-charcoal/5 px-1 rounded">9847012345@paytm</code>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal/70 mb-1">Payee name</label>
            <input
              type="text"
              value={upiPayeeName}
              onChange={e => setUpiPayeeName(e.target.value)}
              placeholder={restaurant.name}
              className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
            />
            <div className="text-[11px] text-charcoal/50 mt-1">
              Shown in the customer's UPI app.
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <button
            onClick={saveUpi}
            disabled={saving || !upiValid}
            className="px-4 py-2 bg-forest text-white text-sm rounded hover:bg-forest/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save UPI'}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border border-charcoal/10 rounded-lg p-5">
        <h2 className="font-serif text-lg mb-2">How it works</h2>
        {paymentMode === 'pay_after' ? (
          <ol className="text-sm text-charcoal/70 space-y-2 ml-5 list-decimal">
            <li>Customer scans QR → orders → kitchen cooks → customer eats</li>
            <li>Customer taps <strong>"Request bill"</strong> when ready to pay</li>
            <li>Customer scans UPI QR or taps "Open in UPI app"</li>
            <li>Customer pays → taps <strong>"I've paid"</strong> + UPI ref</li>
            <li>You verify in <Link href={`/admin/${restaurant.slug}/payments`} className="text-forest underline">Payments</Link> → order marked paid ✓</li>
          </ol>
        ) : (
          <ol className="text-sm text-charcoal/70 space-y-2 ml-5 list-decimal">
            <li>Customer scans QR → adds items → taps <strong>"Pay & send to kitchen"</strong></li>
            <li>Customer pays via UPI → submits UPI reference</li>
            <li>Order shows in <Link href={`/admin/${restaurant.slug}/payments`} className="text-forest underline">Payments</Link> as "Pending verification"</li>
            <li>You check your UPI app → tap <strong>"Verify"</strong> in admin</li>
            <li>✨ Order automatically reaches the kitchen!</li>
          </ol>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-charcoal text-white px-4 py-2 rounded-md text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
