import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import MyReservationsClient from './MyReservationsClient';

export const dynamic = 'force-dynamic';

export default async function MyReservationsPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/customer-login?next=%2Fme%2Freservations');

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) redirect('/me');

  // Fetch all reservations for this customer
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, confirmation_code, reservation_date, reservation_time, party_size, status, customer_name, restaurants(name, slug, address)')
    .eq('customer_id', profile.id)
    .order('reservation_date', { ascending: false })
    .order('reservation_time', { ascending: false })
    .limit(50);

  return <MyReservationsClient reservations={(reservations ?? []) as any[]} />;
}
