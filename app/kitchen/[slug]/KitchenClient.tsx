'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';

interface KOrder {
  id: string;
  table_number: number | null;
  status: string;
  total: number;
  created_at: string;
  notes: string | null;
  order_items: { id: string; name: string; qty: number; notes: string | null }[];
}

export default function KitchenClient({
  restaurant,
  initialOrders
}: {
  restaurant: Restaurant;
  initialOrders: KOrder[];
}) {
  const [orders, setOrders] = useState<KOrder[]>(initialOrders);

  useEffect(() => {
    const channel = supabase
      .channel(`kitchen-${restaurant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        async () => {
          // Refetch on any order change
          const { data } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('restaurant_id', restaurant.id)
            .in('status', ['received', 'preparing', 'ready'])
            .order('created_at', { ascending: true });
          setOrders((data ?? []) as KOrder[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant.id]);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  }

  function elapsed(createdAt: string) {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (mins < 1) return 'just now';
    return `${mins} min${mins !== 1 ? 's' : ''} ago`;
  }

  const queues = {
    received: orders.filter(o => o.status === 'received'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready')
  };

  return (
    <main className="min-h-screen bg-charcoal text-white">
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[2px] text-white/50">TABLO · KITCHEN</div>
          <div className="font-serif text-xl">{restaurant.name}</div>
        </div>
        <div className="text-sm text-white/60">{orders.length} active order{orders.length !== 1 ? 's' : ''}</div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        <Column
          title="Incoming"
          color="bg-amber-500"
          orders={queues.received}
          actionLabel="Start preparing"
          onAction={id => setStatus(id, 'preparing')}
          elapsed={elapsed}
        />
        <Column
          title="Preparing"
          color="bg-blue-500"
          orders={queues.preparing}
          actionLabel="Mark ready"
          onAction={id => setStatus(id, 'ready')}
          elapsed={elapsed}
        />
        <Column
          title="Ready to serve"
          color="bg-emerald-500"
          orders={queues.ready}
          actionLabel="Mark served"
          onAction={id => setStatus(id, 'served')}
          elapsed={elapsed}
        />
      </div>
    </main>
  );
}

function Column({
  title,
  color,
  orders,
  actionLabel,
  onAction,
  elapsed
}: {
  title: string;
  color: string;
  orders: KOrder[];
  actionLabel: string;
  onAction: (id: string) => void;
  elapsed: (s: string) => string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <div className="text-sm font-medium tracking-wide">{title}</div>
        <div className="text-xs text-white/40">· {orders.length}</div>
      </div>
      <div className="space-y-3">
        {orders.length === 0 && (
          <div className="text-center py-12 text-white/30 text-sm border border-dashed border-white/10 rounded-lg">
            None
          </div>
        )}
        {orders.map(o => (
          <div key={o.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-serif text-2xl leading-none">T{o.table_number}</div>
                <div className="text-[11px] text-white/50 mt-1">#{o.id.slice(0, 6)} · {elapsed(o.created_at)}</div>
              </div>
              <div className="text-sm font-medium">₹{o.total}</div>
            </div>
            <div className="space-y-1 mt-3">
              {o.order_items.map(it => (
                <div key={it.id} className="flex justify-between text-sm">
                  <span>{it.name}</span>
                  <span className="text-white/60">×{it.qty}</span>
                </div>
              ))}
            </div>
            {o.notes && (
              <div className="mt-3 p-2 bg-amber-500/10 text-amber-200 text-xs rounded">{o.notes}</div>
            )}
            <button
              onClick={() => onAction(o.id)}
              className="w-full mt-4 bg-white text-charcoal py-2 rounded-md text-sm font-medium hover:bg-white/90"
            >
              {actionLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
