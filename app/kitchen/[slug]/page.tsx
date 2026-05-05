import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import KitchenClient from './KitchenClient';
import type { Restaurant } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function KitchenPage({ params }: { params: { slug: string } }) {
  const supabase = createServerSupabase();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant>();
  if (!restaurant) notFound();

  // Only fetch orders that should be visible to kitchen
  // Excludes: paid/cancelled (already done), pending payment in pay-first mode
  const { data: orders } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('restaurant_id', restaurant.id)
    .in('status', ['received', 'preparing', 'ready'])
    .neq('payment_state', 'pending')   // <-- kitchen doesn't see unpaid pay-first orders
    .order('created_at', { ascending: true });

  return <KitchenClient restaurant={restaurant} initialOrders={(orders ?? []) as any[]} />;
}
