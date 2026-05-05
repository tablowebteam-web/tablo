import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import ReservationDetailClient from './ReservationDetailClient';

export const dynamic = 'force-dynamic';

export default async function ReservationDetailPage({ params }: { params: { code: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/customer-login?next=${encodeURIComponent(`/me/reservations/${params.code}`)}`);

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) redirect('/me');

  // Fetch reservation by code (must belong to this customer)
  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, restaurants(name, slug, address)')
    .eq('confirmation_code', params.code.toUpperCase())
    .eq('customer_id', profile.id)
    .maybeSingle();

  if (!reservation) notFound();

  return <ReservationDetailClient reservation={reservation as any} />;
}
