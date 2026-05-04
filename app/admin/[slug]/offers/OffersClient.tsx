'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Restaurant } from '@/lib/types';

interface Offer {
  id?: string;
  restaurant_id: string;
  offer_type: 'birthday' | 'anniversary' | 'first_visit' | 'regular_customer';
  enabled: boolean;
  discount_kind: 'percent' | 'amount';
  discount_value: number;
  description: string | null;
}

const OFFER_DEFS = [
  { type: 'birthday' as const, icon: '🎂', title: 'Birthday discount', helper: "Applied on the customer's birthday", suggested: { kind: 'percent' as const, value: 10 } },
  { type: 'anniversary' as const, icon: '💍', title: 'Anniversary discount', helper: "Applied on the customer's wedding anniversary", suggested: { kind: 'percent' as const, value: 15 } },
  { type: 'first_visit' as const, icon: '👋', title: 'First-time visitor offer', helper: 'Applied when a customer dines with you for the first time', suggested: { kind: 'percent' as const, value: 10 } },
  { type: 'regular_customer' as const, icon: '🏆', title: 'Regular customer reward', helper: 'Applied from the 4th visit onwards (3+ previous visits)', suggested: { kind: 'percent' as const, value: 5 } }
];

export default function OffersClient({
  restaurant,
  initialOffers
}: {
  restaurant: Restaurant;
  initialOffers: Offer[];
}) {
  const existingMap = new Map(initialOffers.map(o => [o.offer_type, o]));

  const [offers, setOffers] = useState<Record<string, Offer>>(() => {
    const map: Record<string, Offer> = {};
    for (const def of OFFER_DEFS) {
      const existing = existingMap.get(def.type);
      map[def.type] = existing ?? {
        restaurant_id: restaurant.id,
        offer_type: def.type,
        enabled: false,
        discount_kind: def.suggested.kind,
        discount_value: def.suggested.value,
        description: null
      };
    }
    return map;
  });

  const [savingType, setSavingType] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function show(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function update(type: string, patch: Partial<Offer>) {
    setOffers(o => ({ ...o, [type]: { ...o[type], ...patch } }));
  }

  async function save(type: string) {
    if (savingType) return;
    setSavingType(type);
    const offer = offers[type];

    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offer)
    });

    setSavingType(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      show('Save failed: ' + (err.error ?? 'unknown'));
      return;
    }
    const updated = await res.json();
    setOffers(o => ({ ...o, [type]: updated }));
    show(`${OFFER_DEFS.find(d => d.type === type)?.title} ${updated.enabled ? 'saved' : 'disabled'}`);
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
        <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Offers</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Auto-apply discounts to delight returning guests and celebrate special days.
        </p>
      </header>

      <div className="bg-cream/40 border border-cream rounded-lg p-4 mb-6 text-sm text-forest">
        <strong>How it works:</strong> When a logged-in customer places an order, Tablo checks all enabled offers and applies the best one automatically. The discount appears on their bill with a friendly note like "🎂 Happy birthday: 10% off".
      </div>

      <div className="space-y-3">
        {OFFER_DEFS.map(def => {
          const offer = offers[def.type];
          const isSaving = savingType === def.type;
          return (
            <div
              key={def.type}
              className={`bg-white border rounded-lg p-5 transition-colors ${
                offer.enabled ? 'border-forest/40 shadow-sm' : 'border-charcoal/10'
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3 min-w-0 flex-1">
                  <span className="text-2xl shrink-0">{def.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-lg leading-tight">{def.title}</h3>
                    <p className="text-xs text-charcoal/60 mt-0.5">{def.helper}</p>
                  </div>
                </div>
                <Toggle checked={offer.enabled} onChange={v => update(def.type, { enabled: v })} />
              </div>

              {offer.enabled && (
                <div className="mt-4 pt-4 border-t border-charcoal/10 space-y-3">
                  <div className="flex gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-medium text-charcoal/70 mb-1">Discount type</label>
                      <select
                        value={offer.discount_kind}
                        onChange={e => update(def.type, { discount_kind: e.target.value as 'percent' | 'amount' })}
                        className="px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest bg-white"
                      >
                        <option value="percent">Percentage off</option>
                        <option value="amount">Fixed ₹ amount off</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-charcoal/70 mb-1">
                        {offer.discount_kind === 'percent' ? 'Percent' : 'Amount (₹)'}
                      </label>
                      <input
                        type="number"
                        value={offer.discount_value}
                        onChange={e => update(def.type, { discount_value: Number(e.target.value) })}
                        min="0"
                        step={offer.discount_kind === 'percent' ? '1' : '50'}
                        max={offer.discount_kind === 'percent' ? '100' : undefined}
                        className="w-28 px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-charcoal/70 mb-1">
                      Custom message (optional)
                    </label>
                    <input
                      type="text"
                      value={offer.description ?? ''}
                      onChange={e => update(def.type, { description: e.target.value })}
                      placeholder={`e.g. "Happy birthday — dessert is on us!"`}
                      className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
                      maxLength={120}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => save(def.type)}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-forest text-white text-sm rounded-md hover:bg-forest/90 disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-charcoal text-white px-4 py-2 rounded-md text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-forest' : 'bg-charcoal/20'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
