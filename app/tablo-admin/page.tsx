import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';
import TabloAdminClient from './TabloAdminClient';

export const dynamic = 'force-dynamic';

export default async function TabloAdminPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify super admin
  const { data: sa } = await supabase
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sa) {
    // Not a super admin — redirect away
    redirect('/admin');
  }

  // Use admin client to read across all tenants (bypassing RLS for global view)
  const admin = createAdminClient();

  // Fetch all restaurants with their subscription + member count + order stats
  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, slug, name, created_at, owner_email, address')
    .order('created_at', { ascending: false });

  const restaurantIds = (restaurants ?? []).map(r => r.id);

  const { data: subscriptions } = await admin
    .from('subscriptions')
    .select('restaurant_id, plan_id, status, trial_ends_at, current_period_end, notes')
    .in('restaurant_id', restaurantIds.length ? restaurantIds : ['00000000-0000-0000-0000-000000000000']);

  const subMap = new Map(subscriptions?.map(s => [s.restaurant_id, s]) ?? []);

  // Order count per restaurant (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOrders } = await admin
    .from('orders')
    .select('restaurant_id, total, created_at')
    .in('restaurant_id', restaurantIds.length ? restaurantIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('created_at', thirtyDaysAgo)
    .neq('status', 'cancelled');

  const orderStats = new Map<string, { count: number; revenue: number; lastOrder: string | null }>();
  for (const o of recentOrders ?? []) {
    const cur = orderStats.get(o.restaurant_id) ?? { count: 0, revenue: 0, lastOrder: null };
    cur.count += 1;
    cur.revenue += Number(o.total);
    if (!cur.lastOrder || o.created_at > cur.lastOrder) cur.lastOrder = o.created_at;
    orderStats.set(o.restaurant_id, cur);
  }

  // Plans for the dropdown
  const { data: plans } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  // Build the rows
  const rows = (restaurants ?? []).map(r => {
    const sub = subMap.get(r.id);
    const stats = orderStats.get(r.id) ?? { count: 0, revenue: 0, lastOrder: null };
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      address: r.address,
      ownerEmail: r.owner_email,
      createdAt: r.created_at,
      subscription: sub
        ? {
            planId: sub.plan_id,
            status: sub.status,
            trialEndsAt: sub.trial_ends_at,
            currentPeriodEnd: sub.current_period_end,
            notes: sub.notes
          }
        : null,
      orders30d: stats.count,
      revenue30d: Math.round(stats.revenue),
      lastOrder: stats.lastOrder
    };
  });

  // ============ TOP-LEVEL METRICS ============
  const totalRestaurants = rows.length;
  const trialing = rows.filter(r => r.subscription?.status === 'trialing').length;
  const active = rows.filter(r => r.subscription?.status === 'active').length;
  const pastDue = rows.filter(r => r.subscription?.status === 'past_due').length;
  const suspended = rows.filter(r => r.subscription?.status === 'suspended').length;

  const planMap = new Map(plans?.map(p => [p.id, Number(p.price_monthly)]) ?? []);
  const mrr = rows
    .filter(r => r.subscription?.status === 'active')
    .reduce((sum, r) => sum + (planMap.get(r.subscription!.planId ?? 'pro') ?? 0), 0);

  const conversionRate = (trialing + active) > 0
    ? Math.round((active / (trialing + active)) * 100)
    : 0;

  const totalOrders30d = rows.reduce((s, r) => s + r.orders30d, 0);
  const totalRevenue30d = rows.reduce((s, r) => s + r.revenue30d, 0);

  return (
    <TabloAdminClient
      userEmail={user.email ?? ''}
      rows={rows}
      plans={plans ?? []}
      metrics={{
        totalRestaurants,
        trialing,
        active,
        pastDue,
        suspended,
        mrr,
        conversionRate,
        totalOrders30d,
        totalRevenue30d
      }}
    />
  );
}
