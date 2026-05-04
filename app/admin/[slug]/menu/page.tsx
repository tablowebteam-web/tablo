import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import MenuEditorClient from './MenuEditorClient';
import AdminHeader from '@/components/AdminHeader';
import type { Restaurant, MenuCategory, MenuItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MenuAdminPage({ params }: { params: { slug: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants').select('*').eq('slug', params.slug).single<Restaurant>();
  if (!restaurant) notFound();

  const { data: membership } = await supabase
    .from('restaurant_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: categories } = await supabase
    .from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order');
  const { data: items } = await supabase
    .from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('sort_order');

  return (
    <>
      <AdminHeader user={user} />
      <MenuEditorClient
        restaurant={restaurant}
        initialCategories={(categories ?? []) as MenuCategory[]}
        initialItems={(items ?? []) as MenuItem[]}
      />
    </>
  );
}
