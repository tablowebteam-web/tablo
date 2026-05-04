'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';

interface OrderRow {
  id: string;
  table_number: number | null;
  status: string;
  total: number;
  created_at: string;
  order_items: { id: string; name: string; qty: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-amber-100 text-amber-800',
  preparing: 'bg-blue-100 text-blue-800',
  ready: 'bg-emerald-100 text-emerald-800',
  served: 'bg-charcoal/10 text-charcoal/70',
  paid: 'bg-charcoal text-white',
  cancelled: 'bg-red-100 text-red-800'
};

export default function OrdersClient({
  restaurant,
  initialOrders
}: {
  restaurant: Restaurant;
  initialOrders: OrderRow[];
}) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);

  useEffect(() => {
    const ch = supabase
      .channel(`admin-${restaurant.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        async () => {
          const { data } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('restaurant_id', restaurant.id)
            .order('created_at', { ascending: false })
            .limit(50);
          setOrders((data ?? []) as OrderRow[]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurant.id]);

  const todayRevenue = orders
    .filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total), 0);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex justify-between items-center mb-6">
        <div>
          <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
          <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Orders</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/${restaurant.slug}/menu`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded">Menu</Link>
          <Link href={`/admin/${restaurant.slug}/qr`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded">QR codes</Link>
          <Link href={`/kitchen/${restaurant.slug}`} className="px-3 py-1.5 text-sm bg-charcoal text-white rounded">Kitchen view</Link>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Today's revenue" value={`₹${todayRevenue.toLocaleString('en-IN')}`} />
        <Stat label="Active orders" value={orders.filter(o => ['received','preparing','ready'].includes(o.status)).length.toString()} />
        <Stat label="Total orders shown" value={orders.length.toString()} />
      </div>

      <div className="border border-charcoal/10 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-charcoal/5 text-xs uppercase tracking-wider text-charcoal/60">
            <tr>
              <th className="text-left px-4 py-2.5">Time</th>
              <th className="text-left px-4 py-2.5">Table</th>
              <th className="text-left px-4 py-2.5">Items</th>
              <th className="text-right px-4 py-2.5">Total</th>
              <th className="text-left px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="border-t border-charcoal/10">
                <td className="px-4 py-3 text-charcoal/70">{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-4 py-3 font-medium">T{o.table_number}</td>
                <td className="px-4 py-3 text-charcoal/70">{o.order_items.map(i => `${i.name} ×${i.qty}`).join(', ')}</td>
                <td className="px-4 py-3 text-right font-medium">₹{o.total}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[o.status] ?? ''}`}>
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-charcoal/50">No orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-charcoal/10 rounded-lg p-4">
      <div className="text-xs text-charcoal/60 mb-1">{label}</div>
      <div className="font-serif text-2xl">{value}</div>
    </div>
  );
}
