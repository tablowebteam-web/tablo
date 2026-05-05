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
  internal_notes: string | null;
  status: string;
  confirmation_code: string;
  table_id: string | null;
  arrived_at: string | null;
  cancelled_reason: string | null;
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
  const [editingNotes, setEditingNotes] = useState<Reservation | null>(null);
  const [decliningRes, setDecliningRes] = useState<Reservation | null>(null);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);

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

  async function handleAction(id: string, action: string, extraBody?: any) {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraBody })
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

  function buildWhatsAppLink(r: Reservation): string {
    const phone = r.customer_phone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const msg = encodeURIComponent(
      `Hi ${r.customer_name}! This is ${restaurant.name}. Reminder of your booking on ${formatDate(r.reservation_date)} at ${formatTime(r.reservation_time)} for ${r.party_size} guests. Code: ${r.confirmation_code}`
    );
    return `https://wa.me/${fullPhone}?text=${msg}`;
  }

  function isOverdue(r: Reservation): boolean {
    if (r.status !== 'confirmed') return false;
    const dt = new Date(`${r.reservation_date}T${r.reservation_time}`);
    return Date.now() - dt.getTime() > 30 * 60 * 1000;
  }

  const todayCount = reservations.filter(r => r.reservation_date === today && !['cancelled', 'no_show'].includes(r.status)).length;
  const upcomingCount = reservations.filter(r => r.reservation_date > today && !['cancelled'].includes(r.status)).length;
  const pendingCount = reservations.filter(r => r.status === 'pending').length;

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="mb-5 flex justify-between items-end flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
          <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Reservations</h1>
          <p className="text-sm text-charcoal/60 mt-1">Manage table bookings.</p>
        </div>
        <Link href={`/r/${restaurant.slug}/book`} target="_blank" className="px-3 py-1.5 text-sm border border-charcoal/20 rounded">
          Booking page ↗
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-charcoal/10 rounded-lg p-4">
          <div className="text-xs text-charcoal/60">Today</div>
          <div className="font-serif text-2xl">{todayCount}</div>
        </div>
        <div className="bg-white border border-charcoal/10 rounded-lg p-4">
          <div className="text-xs text-charcoal/60">Upcoming (30d)</div>
          <div className="font-serif text-2xl">{upcomingCount}</div>
        </div>
        <div className={`border rounded-lg p-4 ${pendingCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-charcoal/10'}`}>
          <div className="text-xs text-charcoal/60">⏳ Pending</div>
          <div className="font-serif text-2xl">{pendingCount}</div>
        </div>
      </div>

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

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-charcoal/50 text-sm bg-white border border-charcoal/10 rounded-lg">
          No reservations.
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([date, items]) => (
            <div key={date}>
              <h2 className="font-serif text-lg mb-2">{formatDate(date)}</h2>
              <div className="bg-white border border-charcoal/10 rounded-lg divide-y divide-charcoal/10">
                {items.map(r => {
                  const overdue = isOverdue(r);
                  return (
                    <div key={r.id} className={`p-4 ${overdue ? 'bg-red-50/40' : ''}`}>
                      {/* HEADER ROW */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium">{r.customer_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-medium ${STATUS_STYLES[r.status] ?? ''}`}>
                          {r.status.replace('_', ' ')}
                        </span>
                        {overdue && (
                          <span className="text-[10px] bg-red-200 text-red-900 px-2 py-0.5 rounded font-medium">
                            ⚠️ {Math.floor((Date.now() - new Date(`${r.reservation_date}T${r.reservation_time}`).getTime()) / 60000)} min overdue
                          </span>
                        )}
                        <span className="text-[10px] text-charcoal/40 ml-auto">Code: {r.confirmation_code}</span>
                      </div>

                      {/* DETAILS */}
                      <div className="text-sm text-charcoal/70 mb-2">
                        🕐 {formatTime(r.reservation_time)} · 👥 {r.party_size} {r.party_size === 1 ? 'guest' : 'guests'}
                        {r.table_id && (
                          <span className="ml-2 text-charcoal/50">
                            · 🪑 Table {tables.find(t => t.id === r.table_id)?.number ?? '?'}
                          </span>
                        )}
                      </div>

                      {/* CONTACT */}
                      <div className="flex gap-3 mb-2 text-xs flex-wrap">
                        <a href={`tel:${r.customer_phone.replace(/\s/g, '')}`} className="text-forest hover:underline flex items-center gap-1">
                          📞 {r.customer_phone}
                        </a>
                        <a href={buildWhatsAppLink(r)} target="_blank" rel="noopener" className="text-emerald-700 hover:underline">
                          💬 WhatsApp reminder
                        </a>
                      </div>

                      {/* NOTES */}
                      {r.notes && (
                        <div className="text-xs text-charcoal/70 mt-1 italic mb-1">💬 Customer: "{r.notes}"</div>
                      )}
                      {r.internal_notes && (
                        <div className="text-xs text-amber-900 mt-1 bg-amber-50 px-2 py-1 rounded inline-block mb-1">
                          🔒 Internal: {r.internal_notes}
                        </div>
                      )}

                      {/* ACTIONS — separated by status */}
                      <div className="mt-3 pt-3 border-t border-charcoal/10 flex flex-wrap gap-2">
                        {/* PENDING — needs decision */}
                        {r.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleAction(r.id, 'confirm')}
                              disabled={busy === r.id}
                              className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 font-medium"
                            >
                              ✓ Confirm booking
                            </button>
                            <button
                              onClick={() => setDecliningRes(r)}
                              disabled={busy === r.id}
                              className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50"
                            >
                              ✗ Decline
                            </button>
                          </>
                        )}

                        {/* CONFIRMED — guest hasn't arrived */}
                        {r.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => handleAction(r.id, 'arrived')}
                              disabled={busy === r.id}
                              className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 font-medium"
                            >
                              👤 Mark arrived
                            </button>
                            <button
                              onClick={() => handleAction(r.id, 'no_show')}
                              disabled={busy === r.id}
                              className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50"
                            >
                              🚫 No-show
                            </button>
                            <button
                              onClick={() => setEditingRes(r)}
                              disabled={busy === r.id}
                              className="px-3 py-1.5 text-xs border border-charcoal/20 rounded hover:bg-charcoal/5"
                            >
                              ✏️ Modify
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Cancel this booking?')) handleAction(r.id, 'cancel', { cancelledReason: 'Cancelled by restaurant' });
                              }}
                              disabled={busy === r.id}
                              className="px-3 py-1.5 text-xs text-charcoal/60 hover:text-charcoal"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {/* ARRIVED — guest is eating */}
                        {r.status === 'arrived' && (
                          <button
                            onClick={() => handleAction(r.id, 'completed')}
                            disabled={busy === r.id}
                            className="px-3 py-1.5 text-xs bg-charcoal text-white rounded hover:bg-charcoal/90 disabled:opacity-50 font-medium"
                          >
                            ✓ Mark completed
                          </button>
                        )}

                        {/* TABLE ASSIGNMENT — for confirmed/arrived */}
                        {(r.status === 'confirmed' || r.status === 'arrived') && tables.length > 0 && (
                          <select
                            value={r.table_id ?? ''}
                            onChange={e => handleAction(r.id, 'assign_table', { tableId: e.target.value || null })}
                            disabled={busy === r.id}
                            className="px-2 py-1 text-xs border border-charcoal/20 rounded bg-white"
                          >
                            <option value="">🪑 No table</option>
                            {tables.map(t => (
                              <option key={t.id} value={t.id}>Table {t.number} ({t.capacity} seats)</option>
                            ))}
                          </select>
                        )}

                        {/* INTERNAL NOTES — always available */}
                        {!['cancelled', 'completed', 'no_show'].includes(r.status) && (
                          <button
                            onClick={() => setEditingNotes(r)}
                            className="px-3 py-1.5 text-xs border border-charcoal/20 rounded hover:bg-charcoal/5"
                          >
                            🔒 {r.internal_notes ? 'Edit note' : 'Add note'}
                          </button>
                        )}
                      </div>

                      {r.cancelled_reason && (
                        <div className="text-xs text-charcoal/60 mt-2 italic">
                          Cancelled: {r.cancelled_reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INTERNAL NOTES MODAL */}
      {editingNotes && (
        <NotesModal
          reservation={editingNotes}
          onClose={() => setEditingNotes(null)}
          onSave={async (text) => {
            await handleAction(editingNotes.id, 'update_internal_notes', { internalNotes: text });
            setEditingNotes(null);
          }}
        />
      )}

      {/* DECLINE MODAL */}
      {decliningRes && (
        <DeclineModal
          reservation={decliningRes}
          onClose={() => setDecliningRes(null)}
          onConfirm={async (reason) => {
            await handleAction(decliningRes.id, 'decline', { declinedReason: reason });
            setDecliningRes(null);
          }}
        />
      )}

      {/* MODIFY MODAL */}
      {editingRes && (
        <ModifyModal
          reservation={editingRes}
          onClose={() => setEditingRes(null)}
          onSave={async (date, time, partySize, notes) => {
            await handleAction(editingRes.id, 'admin_modify', { date, time, partySize, notes });
            setEditingRes(null);
          }}
        />
      )}
    </main>
  );
}

function NotesModal({
  reservation,
  onClose,
  onSave
}: {
  reservation: Reservation;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(reservation.internal_notes ?? '');
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-xl mb-1">Internal note</h2>
        <p className="text-xs text-charcoal/60 mb-3">Only visible to your staff. Customer doesn't see this.</p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="VIP guest, allergic to nuts, prefers window seat…"
          rows={4}
          maxLength={500}
          className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm resize-none focus:outline-none focus:border-forest"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 border border-charcoal/20 rounded-md text-sm" disabled={saving}>Cancel</button>
          <button
            onClick={async () => { setSaving(true); await onSave(text); }}
            disabled={saving}
            className="flex-1 bg-forest text-white py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeclineModal({
  reservation,
  onClose,
  onConfirm
}: {
  reservation: Reservation;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-xl mb-1">Decline this booking?</h2>
        <p className="text-sm text-charcoal/60 mb-3">
          {reservation.customer_name} will be notified that their booking was declined.
        </p>
        <label className="block text-xs font-medium text-charcoal/70 mb-1">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Fully booked at this time, kitchen closed early..."
          rows={3}
          className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm resize-none mb-4"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-charcoal/20 rounded-md text-sm" disabled={busy}>Keep</button>
          <button
            onClick={async () => { setBusy(true); await onConfirm(reason); }}
            disabled={busy}
            className="flex-1 bg-red-600 text-white py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Declining…' : 'Decline booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModifyModal({
  reservation,
  onClose,
  onSave
}: {
  reservation: Reservation;
  onClose: () => void;
  onSave: (date: string, time: string, partySize: number, notes: string | null) => Promise<void>;
}) {
  const [date, setDate] = useState(reservation.reservation_date);
  const [time, setTime] = useState(reservation.reservation_time);
  const [partySize, setPartySize] = useState(reservation.party_size);
  const [notes, setNotes] = useState(reservation.notes ?? '');
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-xl mb-1">Modify reservation</h2>
        <p className="text-xs text-charcoal/60 mb-4">For {reservation.customer_name}</p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-charcoal/70 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal/70 mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal/70 mb-1">Party size</label>
            <input
              type="number"
              min="1"
              max="50"
              value={partySize}
              onChange={e => setPartySize(Number(e.target.value))}
              className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal/70 mb-1">Customer notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm resize-none"
            />
          </div>
        </div>

        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
          💡 Admin override: Changes are saved without availability check. Use carefully.
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 border border-charcoal/20 rounded-md text-sm" disabled={busy}>Cancel</button>
          <button
            onClick={async () => { setBusy(true); await onSave(date, time, partySize, notes || null); }}
            disabled={busy}
            className="flex-1 bg-forest text-white py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
