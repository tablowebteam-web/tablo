'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Reservation {
  id: string;
  confirmation_code: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  notes: string | null;
  customer_name: string;
  customer_phone: string;
  restaurants: {
    id: string;
    name: string;
    slug: string;
    booking_advance_days?: number;
    booking_min_party?: number;
    booking_max_party?: number;
  } | null;
}

export default function EditReservationClient({ reservation }: { reservation: Reservation }) {
  const router = useRouter();

  const [date, setDate] = useState(reservation.reservation_date);
  const [time, setTime] = useState(reservation.reservation_time);
  const [partySize, setPartySize] = useState(reservation.party_size);
  const [notes, setNotes] = useState(reservation.notes ?? '');

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const advanceDays = reservation.restaurants?.booking_advance_days ?? 30;
  const minParty = reservation.restaurants?.booking_min_party ?? 1;
  const maxParty = reservation.restaurants?.booking_max_party ?? 12;

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + advanceDays);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  // Fetch available slots when date or party size changes
  useEffect(() => {
    if (!date || !partySize || !reservation.restaurants?.id) return;
    setLoadingSlots(true);
    fetch(`/api/reservations/slots?restaurantId=${reservation.restaurants.id}&date=${date}&partySize=${partySize}&excludeReservationId=${reservation.id}`)
      .then(r => r.json())
      .then(data => {
        setAvailableSlots(data.slots ?? []);
        // Keep current time selected if still in available slots
        if (!(data.slots ?? []).includes(time)) {
          setTime('');
        }
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, partySize, reservation.restaurants?.id, reservation.id]);

  function formatTime(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  const hasChanges =
    date !== reservation.reservation_date ||
    time !== reservation.reservation_time ||
    partySize !== reservation.party_size ||
    notes !== (reservation.notes ?? '');

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modify',
          date,
          time,
          partySize,
          notes
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error ?? 'Update failed');
        setSubmitting(false);
        return;
      }
      router.push(`/me/reservations/${reservation.confirmation_code}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FBFAF7]">
      <header className="bg-white border-b border-charcoal/10">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <Link href={`/me/reservations/${reservation.confirmation_code}`} className="text-xs text-charcoal/60">← Cancel changes</Link>
          <span className="font-serif text-lg">tablo</span>
          <span className="w-12" />
        </div>
      </header>

      <div className="max-w-md mx-auto p-5">
        <h1 className="font-serif text-2xl mb-1">Modify reservation</h1>
        <p className="text-sm text-charcoal/60 mb-5">{reservation.restaurants?.name}</p>

        {/* Current details for reference */}
        <div className="bg-cream/50 rounded-lg p-3 mb-5 text-xs">
          <div className="text-charcoal/50 mb-1">Currently booked for:</div>
          <div className="font-medium text-charcoal">
            {new Date(reservation.reservation_date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            {' · '}{formatTime(reservation.reservation_time)}
            {' · '}{reservation.party_size} {reservation.party_size === 1 ? 'guest' : 'guests'}
          </div>
        </div>

        {/* Date */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-charcoal/70 mb-1.5">New date</label>
          <input
            type="date"
            value={date}
            min={today}
            max={maxDateStr}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
          />
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

        {/* Notes */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-charcoal/70 mb-1.5">Special requests</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest resize-none"
            maxLength={300}
          />
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">{error}</div>
        )}

        <div className="flex gap-2">
          <Link
            href={`/me/reservations/${reservation.confirmation_code}`}
            className="px-4 py-2.5 border border-charcoal/20 rounded-md text-sm"
          >
            Cancel
          </Link>
          <button
            onClick={save}
            disabled={submitting || !time || !hasChanges}
            className="flex-1 bg-forest text-white py-2.5 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Saving…' : hasChanges ? 'Save changes' : 'No changes to save'}
          </button>
        </div>
      </div>
    </main>
  );
}
