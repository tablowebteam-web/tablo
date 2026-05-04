import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GuestOrderClient from './GuestOrderClient';
import type { MenuCategory, MenuItem, Restaurant, RestaurantTable } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function GuestOrderPage({
  params
}: {
  params: { slug: string; table: string };
}) {
  // Look up restaurant by slug
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant>();

  if (!restaurant) notFound();

  // Look up table by number
  const tableNum = parseInt(params.table, 10);
  const { data: table } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNum)
    .single<RestaurantTable>();

  if (!table) notFound();

  // Fetch categories + menu
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

  return (
    <GuestOrderClient
      restaurant={restaurant}
      table={table}
      categories={(categories ?? []) as MenuCategory[]}
      items={(items ?? []) as MenuItem[]}
    />
  );
}
