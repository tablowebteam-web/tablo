'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Reservation {
  id: string;
  confirmation_code: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  arrived_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  restaurants: { name: string; slug: string; address: string | null } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; description: string }> = {
  pending: { label: 'Pending confirmation', color: 'bg-amber-100 text-amber-800', description: 'Restaurant will confirm shortly.' },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-800', description: 'You\'re all set! We look forward to welcoming you.' },
  arrived: { label: 'You\'ve arrived', color: 'bg-blue-100 text-blue-800', description: 'Enjoy your meal!' },
  completed: { label: 'Completed', color: 'bg-charcoal/10 text-charcoal/60', description: 'Hope you had a wonderful time.' },
  no_show: { label: 'No-show', color: 'bg-red-100 text-red-800', description: 'You didn\'t make it to this booking.' },
  cancelled: { label: 'Cancelled', color: 'bg-charcoal/10 text-charcoal/40', description: 'This reservation was cancelled.' }
};

export default function ReservationDetailClient({ reservation: initialReservation }: { reservation: Reservation }) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initialReservation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`);
  const now = new Date();
  const hoursUntilBooking = (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Permissions based on time and status
  const canModify = reservation.status === 'confirmed' && hoursUntilBooking >= 2;
  const canCancel = ['pending', 'confirmed'].includes(reservation.status) && hoursUntilBooking >= 24;
  const isPast = reservationDateTime < now;
  const isActive = ['pending', 'confirmed', 'arrived'].includes(reservation.status);

  function formatDate(d: string): string {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatTime(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', cancelledReason: cancelReason.trim() || null })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error ?? 'Cancel failed');
        setBusy(false);
        return;
      }
      const data = await res.json();
      setReservation({ ...reservation, ...data });
      setShowCancelModal(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Build calendar URL (.ics-style)
  const calendarUrl = (() => {
    const dt = reservationDateTime;
    const dtEnd = new Date(dt.getTime() + 90 * 60 * 1000); // 90 min default
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      `Reservation at ${reservation.restaurants?.name ?? 'Restaurant'}`
    )}&dates=${fmt(dt)}/${fmt(dtEnd)}&details=${encodeURIComponent(
      `Confirmation: ${reservation.confirmation_code}\nParty of ${reservation.party_size}\n\nReservation made via Tablo`
    )}&location=${encodeURIComponent(reservation.restaurants?.address ?? '')}`;
    return url;
  })();

  // Maps URL
  const mapsUrl = reservation.restaurants?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(reservation.restaurants.address)}`
    : null;

  // Phone (would need to be on restaurant — for now skip)

  const status = STATUS_LABELS[reservation.status];

  return (
    <main className="min-h-screen bg-[#FBFAF7]">
      <header className="bg-white border-b border-charcoal/10">
        <div className="max-w-md mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/me/reservations" className="text-xs text-charcoal/60">← My reservations</Link>
          <span className="font-serif text-lg">tablo</span>
          <span className="w-12" />
        </div>
      </header>

      <div className="max-w-md mx-auto p-5">
        {/* Status banner */}
        <div className={`rounded-lg p-4 mb-4 ${status.color.split(' ')[0]} ${status.color.split(' ')[1]}`}>
          <div className="text-[10px] tracking-widest uppercase opacity-80 mb-1">{status.label}</div>
          <div className="text-sm">{status.description}</div>
        </div>

        {/* Confirmation card */}
        <div className="bg-white border border-charcoal/15 rounded-lg p-5 mb-4">
          <div className="text-[10px] tracking-widest text-charcoal/50">CONFIRMATION CODE</div>
          <div className="font-serif text-2xl text-forest mt-0.5 mb-4 font-mono tracking-wider">{reservation.confirmation_code}</div>

          <div className="space-y-3 text-sm">
            <Detail label="Restaurant" value={reservation.restaurants?.name ?? '—'} />
            {reservation.restaurants?.address && (
              <Detail label="Address" value={reservation.restaurants.address} />
            )}
            <Detail label="Date" value={formatDate(reservation.reservation_date)} />
            <Detail label="Time" value={formatTime(reservation.reservation_time)} />
            <Detail label="Party size" value={`${reservation.party_size} ${reservation.party_size === 1 ? 'guest' : 'guests'}`} />
            <Detail label="Booked under" value={reservation.customer_name} />
            <Detail label="Phone" value={reservation.customer_phone} />
            {reservation.notes && <Detail label="Special requests" value={`"${reservation.notes}"`} />}
            {reservation.cancelled_reason && (
              <Detail label="Cancellation reason" value={reservation.cancelled_reason} />
            )}
          </div>
        </div>

        {/* Quick actions (when active) */}
        {isActive && !isPast && (
          <div className="bg-white border border-charcoal/15 rounded-lg p-4 mb-4">
            <h3 className="text-xs tracking-widest text-charcoal/50 mb-3">QUICK ACTIONS</h3>
            <div className="grid grid-cols-2 gap-2">
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener"
                  className="flex flex-col items-center justify-center py-3 border border-charcoal/15 rounded-md hover:bg-charcoal/5 text-charcoal"
                >
                  <span className="text-xl mb-1">📍</span>
                  <span className="text-xs">Directions</span>
                </a>
              )}
              <a
                href={calendarUrl}
                target="_blank"
                rel="noopener"
                className="flex flex-col items-center justify-center py-3 border border-charcoal/15 rounded-md hover:bg-charcoal/5 text-charcoal"
              >
                <span className="text-xl mb-1">📅</span>
                <span className="text-xs">Add to calendar</span>
              </a>
            </div>
          </div>
        )}

        {/* Modify / Cancel */}
        {isActive && !isPast && (
          <div className="bg-white border border-charcoal/15 rounded-lg p-4 mb-4">
            <h3 className="text-xs tracking-widest text-charcoal/50 mb-3">MANAGE BOOKING</h3>

            {canModify ? (
              <Link
                href={`/me/reservations/${reservation.confirmation_code}/edit`}
                className="block w-full bg-forest text-white text-center py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 mb-2"
              >
                ✏️ Modify reservation
              </Link>
            ) : (
              <div className="text-xs text-charcoal/50 text-center mb-2 p-2 bg-charcoal/5 rounded">
                Modifications closed (less than 2 hours before booking).<br/>
                Please call the restaurant directly.
              </div>
            )}

            {canCancel ? (
              <button
                onClick={() => setShowCancelModal(true)}
                className="block w-full border border-red-200 text-red-700 text-center py-2.5 rounded-md text-sm hover:bg-red-50"
              >
                Cancel reservation
              </button>
            ) : reservation.status !== 'cancelled' && reservation.status !== 'completed' && (
              <div className="text-xs text-charcoal/50 text-center p-2 bg-charcoal/5 rounded">
                Cancellation closed (less than 24 hours before booking).<br/>
                Please call the restaurant directly.
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-4">{error}</div>
        )}

        {/* Booking timestamp */}
        <div className="text-[11px] text-charcoal/50 text-center mt-6">
          Booked on {new Date(reservation.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      </div>

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-lg max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <h2 className="font-serif text-xl mb-2">Cancel reservation?</h2>
            <p className="text-sm text-charcoal/60 mb-4">
              Your booking on {formatDate(reservation.reservation_date)} at {formatTime(reservation.reservation_time)} will be cancelled.
            </p>

            <label className="block text-xs font-medium text-charcoal/70 mb-1">Reason (optional)</label>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Helps the restaurant understand"
              rows={2}
              className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm resize-none mb-4"
              maxLength={200}
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={busy}
                className="flex-1 px-4 py-2 border border-charcoal/20 rounded-md text-sm"
              >
                Keep booking
              </button>
              <button
                onClick={cancel}
                disabled={busy}
                className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-charcoal/60">{label}</div>
      <div className="text-sm text-charcoal">{value}</div>
    </div>
  );
}
