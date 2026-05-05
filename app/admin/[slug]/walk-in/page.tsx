import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import WalkInClient from './WalkInClient';
import AdminHeader from '@/components/AdminHeader';
import type { MenuCategory, MenuItem, Restaurant } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function WalkInPage({ params }: { params: { slug: string } }) {
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
    <>
      <AdminHeader user={user} />
      <WalkInClient
        restaurant={restaurant}
        categories={(categories ?? []) as MenuCategory[]}
        items={(items ?? []) as MenuItem[]}
      />
    </>
  );
}
