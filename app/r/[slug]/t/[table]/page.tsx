import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import GuestOrderClient from './GuestOrderClient';
import type { MenuCategory, MenuItem, Restaurant, RestaurantTable } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function GuestOrderPage({
  params
}: {
  params: { slug: string; table: string };
}) {
  const supabase = createServerSupabase();

  // Restaurant
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant>();
  if (!restaurant) notFound();

  // Table
  const tableNum = parseInt(params.table, 10);
  const { data: table } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNum)
    .single<RestaurantTable>();
  if (!table) notFound();

  // Menu
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('sort_order');

  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('is_available', true)
    .order('sort_order');

  // Optional: customer profile if logged in
  const { data: { user } } = await supabase.auth.getUser();
  let customerProfile: { id: string; name: string | null } | null = null;
  let activeOrders: any[] = [];

  if (user) {
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id, name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile) {
      customerProfile = profile;

      // Fetch active orders for this customer at this restaurant in the last 4 hours
      // (covers the typical dining window — anything older is unlikely to be relevant)
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total, table_number, created_at')
        .eq('customer_id', profile.id)
        .eq('restaurant_id', restaurant.id)
        .eq('table_number', tableNum)
        .gte('created_at', fourHoursAgo)
        .in('status', ['received', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: false })
        .limit(5);
      activeOrders = orders ?? [];
    }
  }

  return (
    <GuestOrderClient
      restaurant={restaurant}
      table={table}
      categories={(categories ?? []) as MenuCategory[]}
      items={(items ?? []) as MenuItem[]}
      customerProfile={customerProfile}
      initialActiveOrders={activeOrders}
    />
  );
}
