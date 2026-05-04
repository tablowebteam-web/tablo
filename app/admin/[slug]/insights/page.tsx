import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import InsightsClient from './InsightsClient';
import AdminHeader from '@/components/AdminHeader';
import type { Restaurant } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface OrderRow {
  id: string;
  total: number;
  subtotal: number;
  discount_amount: number | null;
  status: string;
  created_at: string;
  customer_id: string | null;
  table_number: number | null;
  order_items: { id: string; name: string; qty: number; price: number }[];
}

export default async function InsightsPage({ params }: { params: { slug: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant>();
  if (!restaurant) notFound();

  const { data: membership } = await supabase
    .from('restaurant_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!membership) notFound();

  // Fetch last 30 days of non-cancelled orders with their items
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, subtotal, discount_amount, status, created_at, customer_id, table_number, order_items(id, name, qty, price)')
    .eq('restaurant_id', restaurant.id)
    .neq('status', 'cancelled')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  const allOrders = (orders ?? []) as OrderRow[];

  // ============ COMPUTE METRICS ============

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const oneHourAgo = now.getTime() - 60 * 60 * 1000;

  const todayOrders = allOrders.filter(o => new Date(o.created_at).getTime() >= todayStart);
  const yesterdayOrders = allOrders.filter(o => {
    const t = new Date(o.created_at).getTime();
    return t >= yesterdayStart && t < todayStart;
  });

  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
  const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + Number(o.total), 0);
  const todayOrderCount = todayOrders.length;
  const todayAvgOrderValue = todayOrderCount > 0 ? Math.round(todayRevenue / todayOrderCount) : 0;
  const todayDiscounts = todayOrders.reduce((s, o) => s + Number(o.discount_amount ?? 0), 0);

  // Active tables: orders not yet "served" or "paid", in last hour
  const activeOrders = allOrders.filter(o => {
    const t = new Date(o.created_at).getTime();
    return t >= oneHourAgo && ['received', 'preparing', 'ready'].includes(o.status);
  });
  const activeTables = new Set(activeOrders.map(o => o.table_number).filter(Boolean)).size;

  // Daily revenue for last 30 days (for the bar chart)
  const dailyRevenue: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const dayOrders = allOrders.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= dayStart && t < dayEnd;
    });
    const dayRevenue = dayOrders.reduce((s, o) => s + Number(o.total), 0);
    dailyRevenue.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      revenue: Math.round(dayRevenue),
      orders: dayOrders.length
    });
  }

  // Top dishes (last 30 days)
  const dishCounts = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const order of allOrders) {
    for (const item of order.order_items ?? []) {
      const cur = dishCounts.get(item.name) ?? { name: item.name, qty: 0, revenue: 0 };
      cur.qty += item.qty;
      cur.revenue += item.qty * Number(item.price);
      dishCounts.set(item.name, cur);
    }
  }
  const topDishes = Array.from(dishCounts.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Peak hours (24-hour distribution, last 30 days)
  const hourCounts: number[] = Array(24).fill(0);
  for (const order of allOrders) {
    const h = new Date(order.created_at).getHours();
    hourCounts[h] += 1;
  }
  const peakHourIndex = hourCounts.indexOf(Math.max(...hourCounts));

  // Customer insights
  const uniqueCustomerIds = new Set<string>();
  const customerOrderCount = new Map<string, number>();
  for (const order of allOrders) {
    if (order.customer_id) {
      uniqueCustomerIds.add(order.customer_id);
      customerOrderCount.set(order.customer_id, (customerOrderCount.get(order.customer_id) ?? 0) + 1);
    }
  }
  const totalCustomers = uniqueCustomerIds.size;
  const returningCustomers = Array.from(customerOrderCount.values()).filter(c => c >= 2).length;
  const newCustomers = totalCustomers - returningCustomers;

  // Top regulars — fetch their names
  const topCustomerIds = Array.from(customerOrderCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  let topRegulars: { name: string; visitCount: number }[] = [];
  if (topCustomerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('customer_profiles')
      .select('id, name')
      .in('id', topCustomerIds);
    topRegulars = topCustomerIds
      .map(id => {
        const p = profiles?.find(p => p.id === id);
        return {
          name: p?.name ?? 'Anonymous',
          visitCount: customerOrderCount.get(id) ?? 0
        };
      })
      .filter(r => r.visitCount > 0);
  }

  return (
    <>
      <AdminHeader user={user} />
      <InsightsClient
        restaurant={restaurant}
        kpis={{
          todayRevenue: Math.round(todayRevenue),
          yesterdayRevenue: Math.round(yesterdayRevenue),
          todayOrderCount,
          todayAvgOrderValue,
          todayDiscounts: Math.round(todayDiscounts),
          activeTables
        }}
        dailyRevenue={dailyRevenue}
        topDishes={topDishes}
        hourCounts={hourCounts}
        peakHourIndex={peakHourIndex}
        customers={{
          total: totalCustomers,
          new: newCustomers,
          returning: returningCustomers
        }}
        topRegulars={topRegulars}
      />
    </>
  );
}
