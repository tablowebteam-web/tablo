'use client';

import { useState } from 'react';
import Link from 'next/link';

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
  const [profile, setProfile] = useState(initialProfile);
  const [name, setName] = useState(profile.name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [birthday, setBirthday] = useState(profile.birthday ?? '');
  const [anniversary, setAnniversary] = useState(profile.anniversary ?? '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function show(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
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
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      show('Save failed: ' + (err.error ?? 'unknown'));
      return;
    }
    const updated = await res.json();
    setProfile(updated);
    show('Profile saved ✓');
  }

  async function signOut() {
    await fetch('/auth/signout', { method: 'POST' });
    window.location.href = '/';
  }

  const initials = (name || userEmail || 'U').slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-[#FBFAF7]">
      {/* Header */}
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
          <button onClick={signOut} className="text-xs text-charcoal/60 hover:text-charcoal">Sign out</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6">
        {/* Profile header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-cream text-forest flex items-center justify-center text-base font-medium">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-serif text-xl truncate">{name || 'Welcome'}</div>
            <div className="text-xs text-charcoal/60 truncate">{userEmail}</div>
          </div>
        </div>

        {/* Profile form */}
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

          <button
            onClick={save}
            disabled={saving}
            className="w-full mt-5 bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>

        {/* Order history */}
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
                      <div className="font-medium text-sm truncate">
                        {o.restaurants?.name ?? 'Restaurant'}
                      </div>
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
