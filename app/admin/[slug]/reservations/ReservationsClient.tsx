'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Restaurant, RestaurantTable } from '@/lib/types';

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  duration_minutes: number;
  notes: string | null;
  status: string;
  confirmation_code: string;
  table_id: string | null;
  arrived_at: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  arrived: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-charcoal/10 text-charcoal/60',
  no_show: 'bg-red-100 text-red-800',
  cancelled: 'bg-charcoal/10 text-charcoal/40 line-through'
};

export default function ReservationsClient({
  restaurant,
  initialReservations,
  tables
}: {
  restaurant: Restaurant;
  initialReservations: Reservation[];
  tables: RestaurantTable[];
}) {
  const [reservations, setReservations] = useState(initialReservations);
  const [filter, setFilter] = useState<'today' | 'upcoming' | 'past' | 'all'>('today');
  const [busy, setBusy] = useState<string | null>(null);

  // Realtime
  useEffect(() => {
    let mounted = true;
    import('@/lib/supabase').then(({ supabase }) => {
      const channel = supabase
        .channel(`reservations-${restaurant.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `restaurant_id=eq.${restaurant.id}` }, async () => {
          if (!mounted) return;
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          const { data } = await supabase
            .from('reservations')
            .select('*')
            .eq('restaurant_id', restaurant.id)
            .gte('reservation_date', sevenDaysAgo)
            .lte('reservation_date', thirtyDaysAhead)
            .order('reservation_date', { ascending: true })
            .order('reservation_time', { ascending: true });
          if (data) setReservations(data as Reservation[]);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });
    return () => { mounted = false; };
  }, [restaurant.id]);

  async function handleAction(id: string, action: string, tableId?: string) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tableId })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert('Failed: ' + (e.error ?? 'unknown'));
      }
    } catch (e: any) {
      alert('Network error: ' + e.message);
    } finally {
      setBusy(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const filtered = reservations.filter(r => {
    if (filter === 'today') return r.reservation_date === today;
    if (filter === 'upcoming') return r.reservation_date > today;
    if (filter === 'past') return r.reservation_date < today;
    return true;
  });

  // Group by date
  const grouped = new Map<string, Reservation[]>();
  for (const r of filtered) {
    const arr = grouped.get(r.reservation_date) ?? [];
    arr.push(r);
    grouped.set(r.reservation_date, arr);
  }

  function formatDate(d: string): string {
    if (d === today) return 'Today';
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function formatTime(t: string): string {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  // Counts
  const todayCount = reservations.filter(r => r.reservation_date === today && !['cancelled', 'no_show'].includes(r.status)).length;
  const upcomingCount = reservations.filter(r => r.reservation_date > today && !['cancelled'].includes(r.status)).length;

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="mb-5 flex justify-between items-end flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
          <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Reservations</h1>
          <p className="text-sm text-charcoal/60 mt-1">Manage table bookings and guest arrivals.</p>
        </div>
        <Link href={`/r/${restaurant.slug}/book`} target="_blank" className="px-3 py-1.5 text-sm border border-charcoal/20 rounded">
          Booking page ↗
        </Link>
      </header>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white border border-charcoal/10 rounded-lg p-4">
          <div className="text-xs text-charcoal/60">Today</div>
          <div className="font-serif text-2xl">{todayCount}</div>
          <div className="text-[11px] text-charcoal/50">bookings · {reservations.filter(r => r.reservation_date === today && r.status === 'arrived').length} arrived</div>
        </div>
        <div className="bg-white border border-charcoal/10 rounded-lg p-4">
          <div className="text-xs text-charcoal/60">Upcoming (30 days)</div>
          <div className="font-serif text-2xl">{upcomingCount}</div>
          <div className="text-[11px] text-charcoal/50">future bookings</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['today', 'upcoming', 'past', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-full border capitalize ${
              filter === f ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-charcoal/70 border-charcoal/20'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-charcoal/50 text-sm bg-white border border-charcoal/10 rounded-lg">
          No reservations in this view.
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([date, items]) => (
            <div key={date}>
              <h2 className="font-serif text-lg mb-2">{formatDate(date)}</h2>
              <div className="bg-white border border-charcoal/10 rounded-lg divide-y divide-charcoal/10">
                {items.map(r => (
                  <div key={r.id} className="p-4">
                    <div className="flex justify-between items-start gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">{r.customer_name}</span>
                          <span className="text-xs text-charcoal/60">{r.customer_phone}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-charcoal/70">
                          🕐 {formatTime(r.reservation_time)} · 👥 {r.party_size} {r.party_size === 1 ? 'guest' : 'guests'}
                          {r.table_id && (
                            <span className="ml-2 text-charcoal/50">
                              · Table {tables.find(t => t.id === r.table_id)?.number ?? '?'}
                            </span>
                          )}
                        </div>
                        {r.notes && (
                          <div className="text-xs text-charcoal/60 mt-1 italic">"{r.notes}"</div>
                        )}
                        <div className="text-[10px] text-charcoal/40 mt-1">Code: {r.confirmation_code}</div>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        {/* Action buttons based on status */}
                        {(r.status === 'confirmed' || r.status === 'pending') && (
                          <>
                            <button
                              onClick={() => handleAction(r.id, 'arrived')}
                              disabled={busy === r.id}
                              className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                            >
                              ✓ Arrived
                            </button>
                            <button
                              onClick={() => handleAction(r.id, 'no_show')}
                              disabled={busy === r.id}
                              className="px-3 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                            >
                              No-show
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Cancel this reservation?')) handleAction(r.id, 'cancel');
                              }}
                              disabled={busy === r.id}
                              className="px-3 py-1 text-xs text-charcoal/60 hover:text-charcoal disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {r.status === 'arrived' && (
                          <button
                            onClick={() => handleAction(r.id, 'completed')}
                            disabled={busy === r.id}
                            className="px-3 py-1 text-xs bg-charcoal text-white rounded hover:bg-charcoal/90 disabled:opacity-50"
                          >
                            Mark complete
                          </button>
                        )}
                        {/* Table assignment */}
                        {(r.status === 'confirmed' || r.status === 'arrived') && tables.length > 0 && (
                          <select
                            value={r.table_id ?? ''}
                            onChange={e => handleAction(r.id, 'assign_table', e.target.value || undefined)}
                            disabled={busy === r.id}
                            className="px-2 py-1 text-xs border border-charcoal/20 rounded bg-white"
                          >
                            <option value="">No table</option>
                            {tables.map(t => (
                              <option key={t.id} value={t.id}>Table {t.number} ({t.capacity})</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
