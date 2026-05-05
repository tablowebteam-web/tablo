import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import ParcelOrderClient from './ParcelOrderClient';
import type { MenuCategory, MenuItem, Restaurant } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ParcelPage({ params }: { params: { slug: string } }) {
  const supabase = createServerSupabase();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant>();
  if (!restaurant) notFound();

  // Require login for parcel orders
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/customer-login?next=${encodeURIComponent(`/r/${params.slug}/parcel`)}`);
  }

  // Get customer profile
  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('id, name, phone')
    .eq('user_id', user.id)
    .maybeSingle();

  // If no profile yet, redirect to /me to fill it in
  if (!profile) {
    redirect(`/me?returnTo=${encodeURIComponent(`/r/${params.slug}/parcel`)}`);
  }

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

  // Active parcel orders for this customer (last 4 hours)
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { data: activeOrders } = await supabase
    .from('orders')
    .select('id, status, total, pickup_code, created_at, order_type')
    .eq('customer_id', profile.id)
    .eq('restaurant_id', restaurant.id)
    .eq('order_type', 'parcel')
    .gte('created_at', fourHoursAgo)
    .in('status', ['received', 'preparing', 'ready'])
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <ParcelOrderClient
      restaurant={restaurant}
      categories={(categories ?? []) as MenuCategory[]}
      items={(items ?? []) as MenuItem[]}
      customerProfile={profile}
      initialActiveOrders={activeOrders ?? []}
    />
  );
}
