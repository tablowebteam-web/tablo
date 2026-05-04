import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import QRClient from './QRClient';
import AdminHeader from '@/components/AdminHeader';
import type { Restaurant, RestaurantTable } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function QRPage({ params }: { params: { slug: string } }) {
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

  const { data: tables } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('number');

  return (
    <>
      <AdminHeader user={user} />
      <QRClient restaurant={restaurant} tables={(tables ?? []) as RestaurantTable[]} />
    </>
  );
}
