'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Restaurant } from '@/lib/types';

export default function SettingsClient({ restaurant }: { restaurant: Restaurant & { upi_id?: string | null; upi_payee_name?: string | null } }) {
  const [upiId, setUpiId] = useState(restaurant.upi_id ?? '');
  const [upiPayeeName, setUpiPayeeName] = useState(restaurant.upi_payee_name ?? restaurant.name);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function show(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function save() {
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
    show('Settings saved ✓');
  }

  // Validate UPI ID format
  const upiValid = !upiId || /^[\w.-]+@[\w]+$/.test(upiId);

  return (
    <main className="min-h-screen p-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
        <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Settings</h1>
        <p className="text-sm text-charcoal/60 mt-1">Configure how your restaurant accepts payments.</p>
      </header>

      {/* UPI Settings */}
      <div className="bg-white border border-charcoal/10 rounded-lg p-5 mb-4">
        <h2 className="font-serif text-lg mb-1">💸 UPI payments</h2>
        <p className="text-xs text-charcoal/60 mb-4">
          When customers tap "Request bill", they'll see your UPI QR code to pay directly to your bank.
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
              <div className="text-[11px] text-red-700 mt-1">Format should be like: name@bank (e.g., john@hdfc, 9847@upi)</div>
            )}
            <div className="text-[11px] text-charcoal/50 mt-1">
              Examples: <code className="bg-charcoal/5 px-1 rounded">sahiba@hdfc</code> · <code className="bg-charcoal/5 px-1 rounded">9847012345@paytm</code> · <code className="bg-charcoal/5 px-1 rounded">restaurant@okaxis</code>
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
              This is what customers see in their UPI app when paying.
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <button
            onClick={save}
            disabled={saving || !upiValid}
            className="px-4 py-2 bg-forest text-white text-sm rounded hover:bg-forest/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save UPI settings'}
          </button>
        </div>

        {!restaurant.upi_id && !upiId && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
            <strong>Heads up:</strong> Until you add your UPI ID, customers won't see the "Pay" button on their bill. They'll have to pay at the counter manually.
          </div>
        )}
      </div>

      <div className="bg-white border border-charcoal/10 rounded-lg p-5 mb-4">
        <h2 className="font-serif text-lg mb-2">How customers will pay</h2>
        <ol className="text-sm text-charcoal/70 space-y-2 ml-5 list-decimal">
          <li>Customer finishes their meal and taps <strong>"Request bill"</strong> on their phone</li>
          <li>They see the consolidated bill + a UPI QR code + "Pay via UPI" button</li>
          <li>They scan the QR (or tap the button on phone) to open GPay/PhonePe with amount pre-filled</li>
          <li>They pay → your bank gets the money instantly</li>
          <li>They tap <strong>"I've paid"</strong> + enter UPI reference (last 4 digits)</li>
          <li>You get a notification → check your UPI app → tap <strong>"Verify payment"</strong> in admin</li>
        </ol>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-charcoal text-white px-4 py-2 rounded-md text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
