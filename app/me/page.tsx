import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import CustomerProfileClient from './CustomerProfileClient';

export const dynamic = 'force-dynamic';

export default async function CustomerMePage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/customer-login');

  // Get or create profile
  let { data: profile } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    const { data: created } = await supabase
      .from('customer_profiles')
      .insert({ user_id: user.id })
      .select()
      .single();
    profile = created;
  }

  // Active parcel orders (last 4 hours, not yet served/paid)
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { data: activeParcels } = await supabase
    .from('orders')
    .select('id, total, status, pickup_code, created_at, restaurants(name, slug)')
    .eq('customer_id', profile?.id)
    .eq('order_type', 'parcel')
    .gte('created_at', fourHoursAgo)
    .in('status', ['received', 'preparing', 'ready'])
    .order('created_at', { ascending: false });

  // All past orders (last 30)
  const { data: allOrders } = await supabase
    .from('orders')
    .select('id, total, status, created_at, table_number, pickup_code, order_type, restaurants(name, slug)')
    .eq('customer_id', profile?.id)
    .order('created_at', { ascending: false })
    .limit(30);

  // Upcoming reservations (next 30 days, active statuses only)
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcomingReservations } = await supabase
    .from('reservations')
    .select('id, confirmation_code, reservation_date, reservation_time, party_size, status, restaurants(name, slug)')
    .eq('customer_id', profile?.id)
    .gte('reservation_date', today)
    .in('status', ['pending', 'confirmed'])
    .order('reservation_date', { ascending: true })
    .order('reservation_time', { ascending: true })
    .limit(5);

  return (
    <CustomerProfileClient
      userEmail={user.email ?? ''}
      profile={profile!}
      activeParcels={(activeParcels ?? []) as any[]}
      orders={(allOrders ?? []) as any[]}
      upcomingReservations={(upcomingReservations ?? []) as any[]}
    />
  );
}
