'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Restaurant } from '@/lib/types';

interface PaymentIntent {
  id: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  upi_reference: string | null;
  status: string;
  order_ids: string[] | null;
  notes: string | null;
  created_at: string;
  verified_at: string | null;
}

export default function PaymentsClient({
  restaurant,
  initialIntents
}: {
  restaurant: Restaurant;
  initialIntents: PaymentIntent[];
}) {
  const [intents, setIntents] = useState(initialIntents);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  // Realtime
  useEffect(() => {
    let mounted = true;
    import('@/lib/supabase').then(({ supabase }) => {
      const channel = supabase
        .channel(`payments-${restaurant.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_intents', filter: `restaurant_id=eq.${restaurant.id}` }, async () => {
          if (!mounted) return;
          const { data } = await supabase
            .from('payment_intents')
            .select('*')
            .eq('restaurant_id', restaurant.id)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false });
          if (data) setIntents(data as PaymentIntent[]);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });
    return () => { mounted = false; };
  }, [restaurant.id]);

  async function handleAction(id: string, action: 'verify' | 'reject') {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch('/api/payment-verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: id, action })
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

  const filtered = filter === 'pending'
    ? intents.filter(i => i.status === 'claimed')
    : intents;

  const pendingCount = intents.filter(i => i.status === 'claimed').length;

  function timeAgo(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="mb-5 flex justify-between items-end flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
          <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Payments</h1>
          <p className="text-sm text-charcoal/60 mt-1">Verify customer UPI payments and mark orders as paid.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/${restaurant.slug}/settings`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded">⚙️ UPI settings</Link>
          <Link href={`/admin/${restaurant.slug}/orders`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded">View orders</Link>
        </div>
      </header>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1.5 text-xs rounded-full border ${
            filter === 'pending' ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-charcoal/70 border-charcoal/20'
          }`}
        >
          ⏳ Pending verification
          {pendingCount > 0 && (
            <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full ${
              filter === 'pending' ? 'bg-white text-charcoal' : 'bg-amber-200 text-amber-900'
            }`}>{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs rounded-full border ${
            filter === 'all' ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-charcoal/70 border-charcoal/20'
          }`}
        >
          All payments (last 7 days)
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-charcoal/50 text-sm bg-white border border-charcoal/10 rounded-lg">
          {filter === 'pending'
            ? '✅ No pending payments — you\'re all caught up!'
            : 'No payment claims in the last 7 days.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(intent => (
            <div
              key={intent.id}
              className={`bg-white border rounded-lg p-4 ${
                intent.status === 'claimed' ? 'border-amber-300 shadow-sm' :
                intent.status === 'verified' ? 'border-emerald-200' :
                'border-charcoal/10 opacity-60'
              }`}
            >
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{intent.customer_name ?? 'Anonymous'}</span>
                    {intent.table_number && (
                      <span className="text-xs bg-charcoal/10 text-charcoal/70 px-2 py-0.5 rounded">Table {intent.table_number}</span>
                    )}
                    <StatusBadge status={intent.status} />
                  </div>
                  <div className="text-xs text-charcoal/60">
                    {intent.customer_phone && <span>{intent.customer_phone} · </span>}
                    {timeAgo(intent.created_at)}
                  </div>
                  {intent.upi_reference && (
                    <div className="mt-2 text-sm">
                      <span className="text-xs text-charcoal/50">UPI ref: </span>
                      <span className="font-mono bg-charcoal/5 px-2 py-0.5 rounded">{intent.upi_reference}</span>
                    </div>
                  )}
                  {intent.notes && (
                    <div className="mt-1 text-xs text-charcoal/60 italic">{intent.notes}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-serif text-2xl">₹{Number(intent.total_amount).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {intent.status === 'claimed' && (
                <div className="mt-3 pt-3 border-t border-charcoal/10 flex justify-between items-center flex-wrap gap-2">
                  <div className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded">
                    Check your UPI app for ₹{Number(intent.total_amount).toLocaleString('en-IN')} from this customer
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(intent.id, 'reject')}
                      disabled={busy === intent.id}
                      className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                    >
                      Not received
                    </button>
                    <button
                      onClick={() => handleAction(intent.id, 'verify')}
                      disabled={busy === intent.id}
                      className="px-4 py-1.5 text-xs bg-forest text-white rounded hover:bg-forest/90 disabled:opacity-50 font-medium"
                    >
                      ✓ Verify & mark paid
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    claimed: 'bg-amber-100 text-amber-800',
    verified: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800'
  };
  const labels: Record<string, string> = {
    claimed: 'Pending',
    verified: 'Verified ✓',
    rejected: 'Rejected'
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide ${styles[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  );
}
