import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import OrdersClient from './OrdersClient';
import AdminHeader from '@/components/AdminHeader';
import type { Restaurant } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage({ params }: { params: { slug: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS will only return the restaurant if the user is a member
  const { data: restaurant } = await supabase
    .from('restaurants').select('*').eq('slug', params.slug).single<Restaurant>();
  if (!restaurant) notFound();

  // Membership check (defense in depth)
  const { data: membership } = await supabase
    .from('restaurant_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <>
      <AdminHeader user={user} />
      <OrdersClient restaurant={restaurant} initialOrders={orders ?? []} />
    </>
  );
}
