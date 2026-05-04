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

interface OrderRow {
  id: string;
  total: number;
  status: string;
  created_at: string;
  table_number: number | null;
  restaurants: { name: string; slug: string } | null;
}

export default function CustomerProfileClient({
  userEmail,
  profile: initialProfile,
  orders
}: {
  userEmail: string;
  profile: Profile;
  orders: OrderRow[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get('returnTo'); // e.g. /r/sahiba/t/7

  const [profile, setProfile] = useState(initialProfile);
  const [name, setName] = useState(profile.name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [birthday, setBirthday] = useState(profile.birthday ?? '');
  const [anniversary, setAnniversary] = useState(profile.anniversary ?? '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If we have a returnTo, also stash it in a cookie so the user can pick a "Continue to menu" path even after refresh
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
          // Clear cookie and go
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
        {/* Welcome banner — only on first visit when there's a returnTo */}
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
            <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-5">
            {effectiveReturnTo ? (
              <>
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  className="px-4 py-2.5 border border-charcoal/20 rounded-md text-sm font-medium hover:bg-charcoal/5 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => save(true)}
                  disabled={saving}
                  className="flex-1 bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save & continue to menu →'}
                </button>
              </>
            ) : (
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="w-full bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-serif text-lg mb-3">Order history</h2>

          {orders.length === 0 ? (
            <div className="bg-white border border-charcoal/10 rounded-lg p-8 text-center">
              <div className="text-4xl mb-2">🍽️</div>
              <div className="font-serif text-base mb-1">No orders yet</div>
              <div className="text-xs text-charcoal/60">Your past orders will appear here once you start dining.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o.id} className="bg-white border border-charcoal/10 rounded-lg p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{o.restaurants?.name ?? 'Restaurant'}</div>
                      <div className="text-xs text-charcoal/60 mt-0.5">
                        Table {o.table_number ?? '?'} · {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-charcoal/70 mb-1">{label}</label>
      {children}
    </div>
  );
}
