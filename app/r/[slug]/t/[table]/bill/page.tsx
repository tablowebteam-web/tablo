import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import BillClient from './BillClient';
import type { Restaurant, RestaurantTable } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function BillPage({
  params
}: {
  params: { slug: string; table: string };
}) {
  const supabase = createServerSupabase();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant & { upi_id?: string | null; upi_payee_name?: string | null }>();
  if (!restaurant) notFound();

  const tableNum = parseInt(params.table, 10);
  const { data: table } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('number', tableNum)
    .single<RestaurantTable>();
  if (!table) notFound();

  // Get all unpaid orders at this table in last 4 hours
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, subtotal, tax, discount_amount, applied_offer, status, created_at, customer_name, order_type, pickup_code, customer_id, order_items(name, qty, price)')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', tableNum)
    .gte('created_at', fourHoursAgo)
    .neq('status', 'paid')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });

  // Get customer profile if logged in
  const { data: { user } } = await supabase.auth.getUser();
  let customerProfile: { id: string; name: string | null; phone: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from('customer_profiles')
      .select('id, name, phone')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) customerProfile = data;
  }

  return (
    <BillClient
      restaurant={restaurant}
      table={table}
      orders={(orders ?? []) as any[]}
      customerProfile={customerProfile}
    />
  );
}
