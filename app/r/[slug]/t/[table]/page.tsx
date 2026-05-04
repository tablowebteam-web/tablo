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
  if (user) {
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id, name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profile) customerProfile = profile;
  }

  return (
    <GuestOrderClient
      restaurant={restaurant}
      table={table}
      categories={(categories ?? []) as MenuCategory[]}
      items={(items ?? []) as MenuItem[]}
      customerProfile={customerProfile}
    />
  );
}
