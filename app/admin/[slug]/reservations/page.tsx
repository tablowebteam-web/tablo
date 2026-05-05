import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import ReservationsClient from './ReservationsClient';
import AdminHeader from '@/components/AdminHeader';
import type { Restaurant, RestaurantTable } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage({ params }: { params: { slug: string } }) {
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

  // Get reservations for next 30 days + past 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: reservations } = await supabase
    .from('reservations')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .gte('reservation_date', sevenDaysAgo)
    .lte('reservation_date', thirtyDaysAhead)
    .order('reservation_date', { ascending: true })
    .order('reservation_time', { ascending: true });

  const { data: tables } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('number');

  return (
    <>
      <AdminHeader user={user} />
      <ReservationsClient
        restaurant={restaurant}
        initialReservations={(reservations ?? []) as any[]}
        tables={(tables ?? []) as RestaurantTable[]}
      />
    </>
  );
}
