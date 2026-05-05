'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  birthday: string | null;
  anniversary: string | null;
}

interface ActiveParcel {
  id: string;
  total: number;
  status: string;
  pickup_code: string | null;
  created_at: string;
  restaurants: { name: string; slug: string } | null;
}

interface OrderRow {
  id: string;
  total: number;
  status: string;
  created_at: string;
  table_number: number | null;
  pickup_code: string | null;
  order_type: string | null;
  restaurants: { name: string; slug: string } | null;
}

interface UpcomingReservation {
  id: string;
  confirmation_code: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  status: string;
  restaurants: { name: string; slug: string } | null;
}

type HistoryTab = 'all' | 'dine_in' | 'parcel';

export default function CustomerProfileClient({
  userEmail,
  profile: initialProfile,
  activeParcels,
  orders,
  upcomingReservations = []
}: {
  userEmail: string;
  profile: Profile;
  activeParcels: ActiveParcel[];
  orders: OrderRow[];
  upcomingReservations?: UpcomingReservation[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get('returnTo');

  const [profile, setProfile] = useState(initialProfile);
  const [name, setName] = useState(profile.name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [birthday, setBirthday] = useState(profile.birthday ?? '');
  const [anniversary, setAnniversary] = useState(profile.anniversary ?? '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('all');
  const [parcels, setParcels] = useState(activeParcels);

  // Realtime updates for active parcel orders
  useEffect(() => {
    if (parcels.length === 0) return;
    const orderIds = parcels.map(p => p.id);
    let mounted = true;

    import('@/lib/supabase').then(({ supabase }) => {
      const channel = supabase
        .channel(`profile-parcels-${profile.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
          if (!mounted) return;
          const updated = payload.new as any;
          if (orderIds.includes(updated.id)) {
            setParcels(prev =>
              prev
                .map(p => p.id === updated.id ? { ...p, status: updated.status, total: Number(updated.total) } : p)
                .filter(p => !['paid', 'cancelled', 'served'].includes(p.status))
            );
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });

    return () => { mounted = false; };
  }, [parcels.map(p => p.id).join(','), profile.id]);

  useEffect(() => {
    if (returnTo) {
      document.cookie = `tablo_return_to=${encodeURIComponent(returnTo)}; path=/; max-age=3600; samesite=lax`;
    }
  }, [returnTo]);

  function show(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function readReturnCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(/(?:^|; )tablo_return_to=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function save(thenRedirect: boolean) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/customer-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          phone: phone.trim() || null,
          birthday: birthday || null,
          anniversary: anniversary || null
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error ?? `Save failed (HTTP ${res.status})`;
        setError(msg);
        show(msg);
        setSaving(false);
        return;
      }
      const updated = await res.json();
      setProfile(updated);
      show('Profile saved ✓');

      if (thenRedirect) {
        const dest = returnTo ?? readReturnCookie();
        if (dest) {
          document.cookie = 'tablo_return_to=; path=/; max-age=0';
          setTimeout(() => router.push(dest), 600);
        }
      }
    } catch (e: any) {
      const msg = e.message ?? 'Network error';
      setError(msg);
      show(msg);
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await fetch('/auth/signout', { method: 'POST' });
    window.location.href = '/';
  }

  const initials = (name || userEmail || 'U').slice(0, 2).toUpperCase();
  const cookieReturnTo = typeof window !== 'undefined' ? readReturnCookie() : null;
  const effectiveReturnTo = returnTo ?? cookieReturnTo;

  // Filter orders by tab
  const filteredOrders = orders.filter(o => {
    if (historyTab === 'all') return true;
    if (historyTab === 'parcel') return o.order_type === 'parcel';
    return o.order_type !== 'parcel'; // dine_in or null (legacy orders)
  });

  return (
    <main className="min-h-screen bg-[#FBFAF7]">
      <header className="bg-white border-b border-charcoal/10">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="26" fill="none" stroke="#0F6E56" strokeWidth="2"/>
              <path d="M 16 22 L 40 22" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M 28 22 L 28 40" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="28" cy="22" r="3" fill="#0F6E56"/>
            </svg>
            <span className="font-serif text-lg">tablo</span>
          </Link>
          <div className="flex items-center gap-3">
            {effectiveReturnTo && (
              <Link href={effectiveReturnTo} className="text-xs text-forest hover:underline">
                ← Back to menu
              </Link>
            )}
            <button onClick={signOut} className="text-xs text-charcoal/60 hover:text-charcoal">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6">
        {effectiveReturnTo && !profile.name && (
          <div className="bg-cream/70 border border-cream rounded-lg p-4 mb-5 text-sm text-forest">
            🎉 <strong>Welcome to Tablo!</strong> Add your details below and we'll bring you back to the menu when you're done.
          </div>
        )}

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-cream text-forest flex items-center justify-center text-base font-medium">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-xl truncate">{name || 'Welcome'}</div>
            <div className="text-xs text-charcoal/60 truncate">{userEmail}</div>
          </div>
        </div>

        {/* ============ ACTIVE PARCEL ORDERS (TOP PRIORITY) ============ */}
        {parcels.length > 0 && (
          <div className="mb-5">
            <h2 className="font-serif text-lg mb-3 flex items-center gap-2">
              📦 Your active parcel orders
              <span className="text-xs bg-forest text-white px-2 py-0.5 rounded-full font-sans">{parcels.length}</span>
            </h2>
            <div className="space-y-2">
              {parcels.map(p => (
                <ActiveParcelCard key={p.id} parcel={p} />
              ))}
            </div>
          </div>
        )}

        {/* ============ PROFILE FORM ============ */}
        <div className="bg-white border border-charcoal/10 rounded-lg p-5 mb-5">
          <h2 className="font-serif text-lg mb-1">Your profile</h2>
          <p className="text-xs text-charcoal/60 mb-4">
            Add your birthday & anniversary to unlock special offers automatically. 🎉
          </p>

          <div className="space-y-3">
            <Field label="Name">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </Field>

            <Field label="Phone">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98470 12345"
                className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Birthday">
                <input
                  type="date"
                  value={birthday ?? ''}
                  onChange={e => setBirthday(e.target.value)}
                  className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                />
              </Field>
              <Field label="Anniversary">
                <input
                  type="date"
                  value={anniversary ?? ''}
                  onChange={e => setAnniversary(e.target.value)}
                  className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                />
              </Field>
            </div>
          </div>

          {error && (
            <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
          )}

          <div className="flex gap-2 mt-5">
            {effectiveReturnTo ? (
              <>
                <button onClick={() => save(false)} disabled={saving} className="px-4 py-2.5 border border-charcoal/20 rounded-md text-sm font-medium hover:bg-charcoal/5 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => save(true)} disabled={saving} className="flex-1 bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save & continue to menu →'}
                </button>
              </>
            ) : (
              <button onClick={() => save(false)} disabled={saving} className="w-full bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            )}
          </div>
        </div>

        {/* ============ UPCOMING RESERVATIONS ============ */}
        {upcomingReservations.length > 0 && (
          <div className="mb-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-serif text-lg flex items-center gap-2">
                📅 Upcoming reservations
              </h2>
              <Link href="/me/reservations" className="text-xs text-forest hover:underline">
                View all →
              </Link>
            </div>
            <div className="space-y-2">
              {upcomingReservations.slice(0, 3).map(r => (
                <Link
                  key={r.id}
                  href={`/me/reservations/${r.confirmation_code}`}
                  className="block bg-white border border-charcoal/15 rounded-lg p-3 hover:border-forest"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{r.restaurants?.name ?? 'Restaurant'}</div>
                      <div className="text-xs text-charcoal/60 mt-0.5">
                        {formatReservationDate(r.reservation_date)} · {formatReservationTime(r.reservation_time)} · {r.party_size} {r.party_size === 1 ? 'guest' : 'guests'}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-medium ${
                      r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {r.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ============ ORDER HISTORY WITH TABS ============ */}
        <div>
          <h2 className="font-serif text-lg mb-3">Order history</h2>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-3">
            {(['all', 'dine_in', 'parcel'] as HistoryTab[]).map(t => {
              const count = orders.filter(o => {
                if (t === 'all') return true;
                if (t === 'parcel') return o.order_type === 'parcel';
                return o.order_type !== 'parcel';
              }).length;
              return (
                <button
                  key={t}
                  onClick={() => setHistoryTab(t)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    historyTab === t
                      ? 'bg-charcoal text-white border-charcoal'
                      : 'bg-white text-charcoal/70 border-charcoal/20'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'dine_in' ? '🍽️ Dine-in' : '📦 Parcel'}
                  <span className={`ml-1.5 ${historyTab === t ? 'text-white/70' : 'text-charcoal/40'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-charcoal/10 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">{historyTab === 'parcel' ? '📦' : '🍽️'}</div>
              <div className="font-serif text-base mb-1">
                {historyTab === 'parcel' ? 'No parcel orders yet' : historyTab === 'dine_in' ? 'No dine-in orders yet' : 'No orders yet'}
              </div>
              <div className="text-xs text-charcoal/60">Your past orders will appear here once you start dining.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map(o => (
                <div key={o.id} className="bg-white border border-charcoal/10 rounded-lg p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-medium text-sm truncate">{o.restaurants?.name ?? 'Restaurant'}</span>
                        {o.order_type === 'parcel' && (
                          <span className="text-[9px] tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">📦 PARCEL</span>
                        )}
                      </div>
                      <div className="text-xs text-charcoal/60">
                        {o.order_type === 'parcel'
                          ? `Pickup ${o.pickup_code ?? '—'}`
                          : `Table ${o.table_number ?? '?'}`}
                        <span className="mx-1.5">·</span>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium">₹{Number(o.total).toLocaleString('en-IN')}</div>
                      <div className={`inline-block text-[10px] px-2 py-0.5 rounded mt-1 capitalize ${
                        o.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                        o.status === 'served' ? 'bg-charcoal/10 text-charcoal/70' :
                        o.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>{o.status}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-charcoal text-white px-4 py-2 rounded-md text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}

function ActiveParcelCard({ parcel }: { parcel: ActiveParcel }) {
  const stages = ['received', 'preparing', 'ready'];
  const stageIdx = stages.indexOf(parcel.status);
  const isReady = parcel.status === 'ready';

  return (
    <div className={`rounded-lg p-4 border-2 ${
      isReady ? 'bg-emerald-50 border-emerald-300 animate-pulse' : 'bg-cream/50 border-cream'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <div className="min-w-0">
          <div className="text-xs text-charcoal/60 truncate">
            {parcel.restaurants?.name ?? 'Restaurant'}
          </div>
          <div className="font-serif text-3xl text-forest leading-tight mt-0.5">
            {parcel.pickup_code ?? '—'}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium">₹{Number(parcel.total).toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-charcoal/50 mt-0.5">
            {timeAgo(parcel.created_at)}
          </div>
        </div>
      </div>

      <div className={`font-serif text-sm mb-3 ${isReady ? 'text-emerald-800 font-bold' : 'text-charcoal'}`}>
        {parcel.status === 'received' && 'Order received — chef will start soon'}
        {parcel.status === 'preparing' && 'Being prepared in the kitchen'}
        {parcel.status === 'ready' && '🎉 Ready! Show this code at the counter'}
      </div>

      <div className="grid grid-cols-3 gap-1 mb-2">
        {stages.map((s, i) => (
          <div key={s}>
            <div className={`h-1 rounded-full ${i <= stageIdx ? 'bg-forest' : 'bg-charcoal/15'}`} />
            <div className={`text-[10px] mt-1.5 capitalize text-center ${i <= stageIdx ? 'text-forest font-medium' : 'text-charcoal/40'}`}>{s}</div>
          </div>
        ))}
      </div>

      {parcel.restaurants?.slug && (
        <Link
          href={`/r/${parcel.restaurants.slug}/parcel`}
          className="text-[11px] text-forest hover:underline block text-center mt-2"
        >
          Order more from {parcel.restaurants.name} →
        </Link>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-charcoal/70 mb-1">{label}</label>
      {children}
    </div>
  );
}

function formatReservationDate(d: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (d === today) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatReservationTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
