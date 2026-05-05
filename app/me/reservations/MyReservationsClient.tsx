'use client';

import Link from 'next/link';

interface ReservationRow {
  id: string;
  confirmation_code: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  status: string;
  customer_name: string;
  restaurants: { name: string; slug: string; address: string | null } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending confirmation', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-800' },
  arrived: { label: 'Arrived', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completed', color: 'bg-charcoal/10 text-charcoal/60' },
  no_show: { label: 'No-show', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', color: 'bg-charcoal/10 text-charcoal/40' }
};

export default function MyReservationsClient({ reservations }: { reservations: ReservationRow[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  function reservationDateTime(r: ReservationRow): Date {
    return new Date(`${r.reservation_date}T${r.reservation_time}`);
  }

  const upcoming = reservations.filter(r =>
    !['cancelled', 'completed', 'no_show'].includes(r.status) &&
    reservationDateTime(r) >= now
  );
  const past = reservations.filter(r =>
    ['cancelled', 'completed', 'no_show'].includes(r.status) ||
    reservationDateTime(r) < now
  );

  function formatDate(d: string): string {
    if (d === today) return 'Today';
    const dt = new Date(d + 'T12:00:00');
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
    return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function formatTime(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  return (
    <main className="min-h-screen bg-[#FBFAF7]">
      <header className="bg-white border-b border-charcoal/10">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/me" className="text-xs text-charcoal/60">← Back to profile</Link>
          <span className="font-serif text-lg">tablo</span>
          <span className="w-12" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6">
        <h1 className="font-serif text-2xl mb-5">📅 My reservations</h1>

        {/* Upcoming */}
        <h2 className="text-xs tracking-widest text-charcoal/50 mb-2">UPCOMING</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white border border-charcoal/10 rounded-lg p-6 text-center mb-6">
            <div className="text-3xl mb-2">📅</div>
            <div className="text-sm text-charcoal/60">No upcoming reservations</div>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {upcoming.map(r => (
              <Link
                key={r.id}
                href={`/me/reservations/${r.confirmation_code}`}
                className="block bg-white border border-charcoal/15 rounded-lg p-4 hover:border-forest transition-colors"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{r.restaurants?.name ?? 'Restaurant'}</div>
                    <div className="text-xs text-charcoal/60 mt-0.5">
                      {formatDate(r.reservation_date)} · {formatTime(r.reservation_time)} · {r.party_size} {r.party_size === 1 ? 'guest' : 'guests'}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-medium ${STATUS_LABELS[r.status]?.color ?? ''}`}>
                        {STATUS_LABELS[r.status]?.label ?? r.status}
                      </span>
                      <span className="text-[10px] text-charcoal/40 font-mono">{r.confirmation_code}</span>
                    </div>
                  </div>
                  <div className="text-charcoal/40">→</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Past */}
        {past.length > 0 && (
          <>
            <h2 className="text-xs tracking-widest text-charcoal/50 mb-2">PAST</h2>
            <div className="space-y-2">
              {past.map(r => (
                <Link
                  key={r.id}
                  href={`/me/reservations/${r.confirmation_code}`}
                  className="block bg-white border border-charcoal/10 rounded-lg p-3 opacity-70 hover:opacity-100"
                >
                  <div className="flex justify-between items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{r.restaurants?.name ?? 'Restaurant'}</div>
                      <div className="text-xs text-charcoal/60 mt-0.5">
                        {formatDate(r.reservation_date)} · {formatTime(r.reservation_time)}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide ${STATUS_LABELS[r.status]?.color ?? ''}`}>
                      {STATUS_LABELS[r.status]?.label ?? r.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
