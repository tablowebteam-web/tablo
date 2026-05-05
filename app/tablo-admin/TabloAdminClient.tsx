'use client';

import { useState } from 'react';
import Link from 'next/link';

interface RestaurantRow {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  ownerEmail: string | null;
  createdAt: string;
  subscription: {
    planId: string;
    status: string;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    notes: string | null;
  } | null;
  orders30d: number;
  revenue30d: number;
  lastOrder: string | null;
}

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
}

interface Metrics {
  totalRestaurants: number;
  trialing: number;
  active: number;
  pastDue: number;
  suspended: number;
  mrr: number;
  conversionRate: number;
  totalOrders30d: number;
  totalRevenue30d: number;
}

const STATUS_STYLES: Record<string, string> = {
  trialing: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  past_due: 'bg-orange-100 text-orange-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-charcoal/10 text-charcoal/60'
};

export default function TabloAdminClient({
  userEmail,
  rows,
  plans,
  metrics
}: {
  userEmail: string;
  rows: RestaurantRow[];
  plans: Plan[];
  metrics: Metrics;
}) {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<RestaurantRow | null>(null);

  const filtered = rows.filter(r => {
    if (filter !== 'all' && r.subscription?.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return r.name.toLowerCase().includes(s) ||
        r.slug.toLowerCase().includes(s) ||
        (r.ownerEmail ?? '').toLowerCase().includes(s);
    }
    return true;
  });

  async function signOut() {
    await fetch('/auth/signout', { method: 'POST' });
    window.location.href = '/login';
  }

  function daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const ms = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  return (
    <main className="min-h-screen bg-[#FBFAF7]">
      {/* Top bar — distinctive dark theme to signal "internal admin" */}
      <header className="bg-charcoal text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="26" fill="none" stroke="#1D9E75" strokeWidth="2"/>
              <path d="M 16 22 L 40 22" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M 28 22 L 28 40" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="28" cy="22" r="3" fill="#1D9E75"/>
            </svg>
            <span className="font-serif text-lg">tablo</span>
            <span className="text-[10px] tracking-[2px] bg-emerald text-white px-2 py-0.5 rounded">COMPANY</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/60">{userEmail}</span>
            <button onClick={signOut} className="text-xs text-white/60 hover:text-white">Sign out</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-6 flex justify-between items-end flex-wrap gap-3">
          <div>
            <h1 className="font-serif text-3xl">Tablo Operations</h1>
            <p className="text-sm text-charcoal/60 mt-1">All restaurants on Tablo. Internal use only.</p>
          </div>
        </header>

        {/* TOP METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label="Total restaurants"
            value={metrics.totalRestaurants.toString()}
            sub={`${metrics.trialing} trialing · ${metrics.active} paying`}
          />
          <MetricCard
            label="MRR"
            value={`₹${metrics.mrr.toLocaleString('en-IN')}`}
            sub={`${metrics.active} active subscriptions`}
            highlight
          />
          <MetricCard
            label="Trial → Paid"
            value={`${metrics.conversionRate}%`}
            sub="Conversion rate"
          />
          <MetricCard
            label="Past due"
            value={metrics.pastDue.toString()}
            sub={`${metrics.suspended} suspended`}
            warning={metrics.pastDue > 0}
          />
        </div>

        {/* Restaurant volume */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white border border-charcoal/10 rounded-lg p-4">
            <div className="text-xs text-charcoal/60 mb-1">Total orders processed (30d)</div>
            <div className="font-serif text-2xl">{metrics.totalOrders30d.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-charcoal/50 mt-0.5">Across all customer restaurants</div>
          </div>
          <div className="bg-white border border-charcoal/10 rounded-lg p-4">
            <div className="text-xs text-charcoal/60 mb-1">Customer revenue processed (30d)</div>
            <div className="font-serif text-2xl">₹{metrics.totalRevenue30d.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-charcoal/50 mt-0.5">Money flowing through Tablo</div>
          </div>
        </div>

        {/* FILTERS */}
        <div className="bg-white border border-charcoal/10 rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-charcoal/10 flex-wrap gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'trialing', 'active', 'past_due', 'suspended'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    filter === s
                      ? 'bg-charcoal text-white border-charcoal'
                      : 'bg-white text-charcoal/70 border-charcoal/20'
                  }`}
                >
                  {s === 'all' ? 'All' : s.replace('_', ' ')}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, slug, email…"
              className="px-3 py-1.5 border border-charcoal/15 rounded-md text-xs w-56 focus:outline-none focus:border-forest"
            />
          </div>

          {/* TABLE */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-charcoal/50">No restaurants match your filter.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-charcoal/5 text-xs uppercase tracking-wider text-charcoal/60">
                <tr>
                  <th className="text-left px-4 py-2.5">Restaurant</th>
                  <th className="text-left px-4 py-2.5">Owner</th>
                  <th className="text-left px-4 py-2.5">Plan</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-right px-4 py-2.5">30d orders</th>
                  <th className="text-right px-4 py-2.5">30d revenue</th>
                  <th className="text-left px-4 py-2.5">Trial / next bill</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const status = r.subscription?.status ?? 'trialing';
                  const trialDaysLeft = daysUntil(r.subscription?.trialEndsAt ?? null);
                  const periodDaysLeft = daysUntil(r.subscription?.currentPeriodEnd ?? null);

                  return (
                    <tr key={r.id} className="border-t border-charcoal/10">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-charcoal/50">/r/{r.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-charcoal/70 text-xs truncate max-w-[180px]">{r.ownerEmail ?? '—'}</td>
                      <td className="px-4 py-3 text-charcoal/70 text-xs capitalize">{r.subscription?.planId ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLES[status] ?? ''}`}>
                          {status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-charcoal/70">{r.orders30d}</td>
                      <td className="px-4 py-3 text-right text-charcoal/70">₹{r.revenue30d.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-charcoal/70">
                        {status === 'trialing' && trialDaysLeft !== null && (
                          <span className={trialDaysLeft <= 3 ? 'text-amber-700 font-medium' : ''}>
                            Trial: {trialDaysLeft >= 0 ? `${trialDaysLeft}d left` : 'expired'}
                          </span>
                        )}
                        {status === 'active' && periodDaysLeft !== null && (
                          <span>Next bill: {periodDaysLeft}d</span>
                        )}
                        {status === 'past_due' && periodDaysLeft !== null && (
                          <span className="text-red-700 font-medium">Overdue {Math.abs(periodDaysLeft)}d</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditing(r)}
                          className="text-xs px-2 py-1 border border-charcoal/20 rounded hover:bg-charcoal/5"
                        >
                          Manage
                        </button>
                        <Link
                          href={`/admin/${r.slug}/insights`}
                          target="_blank"
                          className="text-xs px-2 py-1 ml-1 border border-charcoal/20 rounded hover:bg-charcoal/5 inline-block"
                        >
                          ↗
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <ManageSubscriptionModal
          row={editing}
          plans={plans}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            window.location.reload();
          }}
        />
      )}
    </main>
  );
}

function MetricCard({
  label,
  value,
  sub,
  highlight,
  warning
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 ${
      highlight ? 'bg-forest text-white border-forest' :
      warning ? 'bg-amber-50 border-amber-200' :
      'bg-white border-charcoal/10'
    }`}>
      <div className={`text-xs mb-1 ${highlight ? 'text-white/70' : warning ? 'text-amber-800' : 'text-charcoal/60'}`}>
        {label}
      </div>
      <div className="font-serif text-2xl">{value}</div>
      <div className={`text-[11px] mt-0.5 ${highlight ? 'text-white/60' : warning ? 'text-amber-700' : 'text-charcoal/50'}`}>
        {sub}
      </div>
    </div>
  );
}

function ManageSubscriptionModal({
  row,
  plans,
  onClose,
  onSaved
}: {
  row: RestaurantRow;
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const sub = row.subscription;
  const [planId, setPlanId] = useState(sub?.planId ?? 'pro');
  const [status, setStatus] = useState(sub?.status ?? 'trialing');
  const [trialEndsAt, setTrialEndsAt] = useState(sub?.trialEndsAt?.slice(0, 10) ?? '');
  const [periodEnd, setPeriodEnd] = useState(sub?.currentPeriodEnd?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(sub?.notes ?? '');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paymentRef, setPaymentRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveSubscription() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/tablo-admin/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: row.id,
          planId,
          status,
          trialEndsAt: trialEndsAt || null,
          currentPeriodEnd: periodEnd || null,
          notes
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error ?? 'Save failed');
        setSaving(false);
        return;
      }
      onSaved();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  async function recordPayment() {
    if (!paymentAmount || isNaN(Number(paymentAmount))) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/tablo-admin/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: row.id,
          amount: Number(paymentAmount),
          method: paymentMethod,
          reference: paymentRef
        })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error ?? 'Payment record failed');
        setSaving(false);
        return;
      }
      onSaved();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-lg p-6 my-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-serif text-2xl mb-1">{row.name}</h2>
        <p className="text-xs text-charcoal/60 mb-5">/r/{row.slug} · Owner: {row.ownerEmail ?? '—'}</p>

        <div className="bg-charcoal/5 rounded-md p-3 mb-5 text-xs grid grid-cols-2 gap-2">
          <div>
            <div className="text-charcoal/50">Created</div>
            <div className="font-medium">{new Date(row.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>
          <div>
            <div className="text-charcoal/50">Last order</div>
            <div className="font-medium">{row.lastOrder ? new Date(row.lastOrder).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'}</div>
          </div>
        </div>

        {/* SUBSCRIPTION CONFIG */}
        <h3 className="text-xs tracking-widest text-charcoal/50 mb-2">SUBSCRIPTION</h3>
        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plan">
              <select value={planId} onChange={e => setPlanId(e.target.value)} className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm bg-white">
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} (₹{Number(p.price_monthly).toLocaleString('en-IN')}/mo)</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm bg-white">
                <option value="trialing">Trialing</option>
                <option value="active">Active (paid)</option>
                <option value="past_due">Past due</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Trial ends">
              <input type="date" value={trialEndsAt} onChange={e => setTrialEndsAt(e.target.value)} className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm" />
            </Field>
            <Field label="Current period ends">
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm" />
            </Field>
          </div>

          <Field label="Notes (visible only to Tablo team)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm resize-none" placeholder="Paid via UPI on 5/5, txn 12345…" />
          </Field>

          <button onClick={saveSubscription} disabled={saving} className="px-4 py-2 bg-forest text-white text-sm rounded hover:bg-forest/90 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save subscription'}
          </button>
        </div>

        {/* RECORD A PAYMENT */}
        <h3 className="text-xs tracking-widest text-charcoal/50 mb-2 mt-6 pt-5 border-t border-charcoal/10">RECORD MANUAL PAYMENT</h3>
        <div className="space-y-3 mb-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)">
              <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="9999" className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm" />
            </Field>
            <Field label="Method">
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm bg-white">
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="razorpay">Razorpay (manual)</option>
              </select>
            </Field>
          </div>
          <Field label="Reference (transaction ID)">
            <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="UPI ref / txn ID" className="w-full px-3 py-2 border border-charcoal/15 rounded-md text-sm" />
          </Field>

          <button onClick={recordPayment} disabled={saving || !paymentAmount} className="px-4 py-2 bg-charcoal text-white text-sm rounded hover:bg-charcoal/90 disabled:opacity-50">
            {saving ? 'Recording…' : 'Record payment & extend 30 days'}
          </button>
        </div>

        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">{error}</div>}

        <div className="flex justify-end mt-5 pt-4 border-t border-charcoal/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-charcoal/60 hover:text-charcoal">Close</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-charcoal/70 mb-1">{label}</label>
      {children}
    </div>
  );
}
