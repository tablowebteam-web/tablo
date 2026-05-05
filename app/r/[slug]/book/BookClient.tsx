'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Restaurant } from '@/lib/types';

type Step = 'select' | 'confirm' | 'success';

interface BookingRestaurant extends Restaurant {
  booking_enabled?: boolean;
  booking_opens_hours?: number;
  booking_closes_hours?: number;
  booking_slot_minutes?: number;
  booking_advance_days?: number;
  booking_min_party?: number;
  booking_max_party?: number;
  booking_lead_time_minutes?: number;
}

export default function BookClient({
  restaurant,
  customerProfile,
  userEmail
}: {
  restaurant: BookingRestaurant;
  customerProfile: { id: string; name: string | null; phone: string | null };
  userEmail: string;
}) {
  const [step, setStep] = useState<Step>('select');

  // Today's date in YYYY-MM-DD
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');
  const [name, setName] = useState(customerProfile.name ?? '');
  const [phone, setPhone] = useState(customerProfile.phone ?? '');

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ code: string; date: string; time: string } | null>(null);

  const minParty = restaurant.booking_min_party ?? 1;
  const maxParty = restaurant.booking_max_party ?? 12;
  const advanceDays = restaurant.booking_advance_days ?? 30;

  // Calculate max bookable date
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + advanceDays);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  // Fetch available slots whenever date or party size changes
  useEffect(() => {
    if (!date || !partySize) return;
    setLoadingSlots(true);
    setTime(''); // reset time on date change
    fetch(`/api/reservations/slots?restaurantId=${restaurant.id}&date=${date}&partySize=${partySize}`)
      .then(r => r.json())
      .then(data => {
        setAvailableSlots(data.slots ?? []);
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, partySize, restaurant.id]);

  async function placeBooking() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          customerId: customerProfile.id,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: userEmail,
          date,
          time,
          partySize,
          notes: notes.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Booking failed');
        setSubmitting(false);
        return;
      }
      setConfirmation({
        code: data.confirmation_code,
        date,
        time
      });
      setStep('success');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(d: string): string {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function formatTime(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  if (!restaurant.booking_enabled) {
    return (
      <main className="min-h-screen bg-[#FBFAF7] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-3">📵</div>
          <h1 className="font-serif text-xl mb-2">Online booking is not available</h1>
          <p className="text-sm text-charcoal/60 mb-4">{restaurant.name} doesn't accept online reservations right now.</p>
          <Link href="/" className="text-sm text-forest hover:underline">← Go home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FBFAF7]">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-charcoal/10">
          <Link href="/me" className="text-xs text-charcoal/60">← My profile</Link>
          <div className="font-serif text-2xl mt-1">Reserve a table</div>
          <div className="text-sm text-charcoal/60 mt-0.5">{restaurant.name}</div>
        </div>

        {/* Step: Select */}
        {step === 'select' && (
          <div className="px-5 py-5">
            {/* Date picker */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-charcoal/70 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                min={today}
                max={maxDateStr}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
              />
              <div className="text-[11px] text-charcoal/50 mt-1">
                Book up to {advanceDays} days in advance
              </div>
            </div>

            {/* Party size */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-charcoal/70 mb-1.5">Party size</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPartySize(Math.max(minParty, partySize - 1))}
                  disabled={partySize <= minParty}
                  className="w-10 h-10 rounded-full border border-charcoal/30 text-lg disabled:opacity-30"
                >−</button>
                <div className="flex-1 text-center">
                  <div className="font-serif text-2xl">{partySize}</div>
                  <div className="text-[10px] text-charcoal/60">{partySize === 1 ? 'guest' : 'guests'}</div>
                </div>
                <button
                  onClick={() => setPartySize(Math.min(maxParty, partySize + 1))}
                  disabled={partySize >= maxParty}
                  className="w-10 h-10 rounded-full border border-charcoal/30 text-lg disabled:opacity-30"
                >+</button>
              </div>
              <div className="text-[11px] text-charcoal/50 mt-1 text-center">
                Up to {maxParty} guests · for larger parties, please call the restaurant
              </div>
            </div>

            {/* Time slots */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-charcoal/70 mb-1.5">Available times</label>
              {loadingSlots ? (
                <div className="text-center py-8 text-sm text-charcoal/50">Loading slots…</div>
              ) : availableSlots.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-center">
                  <div className="text-sm font-medium text-amber-900">No slots available</div>
                  <div className="text-xs text-amber-800 mt-1">Try a different date or party size.</div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => setTime(slot)}
                      className={`py-2 text-sm rounded-md border ${
                        time === slot
                          ? 'bg-forest text-white border-forest'
                          : 'bg-white text-charcoal border-charcoal/20 hover:border-charcoal/50'
                      }`}
                    >
                      {formatTime(slot)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {time && (
              <button
                onClick={() => setStep('confirm')}
                className="w-full bg-forest text-white py-3 rounded-md text-sm font-medium hover:bg-forest/90"
              >
                Continue →
              </button>
            )}
          </div>
        )}

        {/* Step: Confirm details */}
        {step === 'confirm' && (
          <div className="px-5 py-5">
            <div className="bg-cream/60 rounded-lg p-4 mb-5">
              <div className="font-serif text-xl mb-1">
                {formatDate(date)} · {formatTime(time)}
              </div>
              <div className="text-sm text-charcoal/70">
                {partySize} {partySize === 1 ? 'guest' : 'guests'}
              </div>
              <button
                onClick={() => setStep('select')}
                className="text-xs text-forest hover:underline mt-2"
              >
                Change
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-charcoal/70 mb-1">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal/70 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
                />
                <div className="text-[11px] text-charcoal/50 mt-1">
                  We may call to confirm closer to your booking time
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal/70 mb-1">Special requests (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anniversary celebration, food allergies, high chair needed…"
                  className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest resize-none"
                  maxLength={300}
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-3">{error}</div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setStep('select')}
                disabled={submitting}
                className="px-4 py-2.5 border border-charcoal/20 rounded-md text-sm"
              >Back</button>
              <button
                onClick={placeBooking}
                disabled={submitting || !name.trim() || !phone.trim()}
                className="flex-1 bg-forest text-white py-2.5 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Booking…' : 'Confirm reservation'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && confirmation && (
          <div className="px-5 py-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="font-serif text-2xl mb-1">Reservation confirmed!</h1>
            <p className="text-sm text-charcoal/60 mb-5">We look forward to seeing you.</p>

            <div className="bg-cream/60 rounded-lg p-4 mb-5 text-left">
              <div className="text-[10px] tracking-widest text-charcoal/50">CONFIRMATION CODE</div>
              <div className="font-serif text-2xl text-forest mt-0.5 mb-3">{confirmation.code}</div>

              <div className="text-xs text-charcoal/60 mb-0.5">Restaurant</div>
              <div className="text-sm font-medium mb-2">{restaurant.name}</div>

              <div className="text-xs text-charcoal/60 mb-0.5">Date & time</div>
              <div className="text-sm font-medium mb-2">{formatDate(confirmation.date)} · {formatTime(confirmation.time)}</div>

              <div className="text-xs text-charcoal/60 mb-0.5">Party size</div>
              <div className="text-sm font-medium">{partySize} {partySize === 1 ? 'guest' : 'guests'}</div>
            </div>

            <p className="text-[11px] text-charcoal/50 mb-5">
              You can view or cancel this reservation from your profile.
            </p>

            <div className="flex flex-col gap-2">
              <Link href="/me" className="block bg-forest text-white py-2.5 rounded-md text-sm font-medium">
                View my reservations
              </Link>
              <Link href="/" className="block text-xs text-charcoal/60 hover:text-charcoal">
                Done
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
