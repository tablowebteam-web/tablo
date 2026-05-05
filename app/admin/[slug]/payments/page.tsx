import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import PaymentsClient from './PaymentsClient';
import AdminHeader from '@/components/AdminHeader';
import type { Restaurant } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage({ params }: { params: { slug: string } }) {
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

  // Fetch recent payment intents (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: intents } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false });

  return (
    <>
      <AdminHeader user={user} />
      <PaymentsClient restaurant={restaurant} initialIntents={intents ?? []} />
    </>
  );
}
