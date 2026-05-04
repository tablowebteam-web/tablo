import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import KitchenClient from './KitchenClient';
import type { Restaurant } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function KitchenPage({ params }: { params: { slug: string } }) {
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant>();

  if (!restaurant) notFound();

  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('restaurant_id', restaurant.id)
    .in('status', ['received', 'preparing', 'ready'])
    .order('created_at', { ascending: true });

  return <KitchenClient restaurant={restaurant} initialOrders={orders ?? []} />;
}
