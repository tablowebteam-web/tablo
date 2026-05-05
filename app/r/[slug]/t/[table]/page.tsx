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

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant & { payment_mode?: 'pay_after' | 'pay_first' | null }>();
  if (!restaurant) notFound();

  const tableNum = parseInt(params.table, 10);
  const { data: table } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNum)
    .single<RestaurantTable>();
  if (!table) notFound();

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

      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total, table_number, pickup_code, order_type, created_at')
        .eq('customer_id', profile.id)
        .eq('restaurant_id', restaurant.id)
        .gte('created_at', fourHoursAgo)
        .in('status', ['received', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: false })
        .limit(10);

      activeOrders = (orders ?? []).filter(o =>
        o.order_type === 'parcel' || o.table_number === tableNum
      );
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
      paymentMode={restaurant.payment_mode ?? 'pay_after'}
    />
  );
}
