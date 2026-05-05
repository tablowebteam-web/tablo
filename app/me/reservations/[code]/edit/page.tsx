import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import EditReservationClient from './EditReservationClient';

export const dynamic = 'force-dynamic';

export default async function EditReservationPage({ params }: { params: { code: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/customer-login?next=${encodeURIComponent(`/me/reservations/${params.code}/edit`)}`);

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) redirect('/me');

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, restaurants(id, name, slug, booking_advance_days, booking_min_party, booking_max_party)')
    .eq('confirmation_code', params.code.toUpperCase())
    .eq('customer_id', profile.id)
    .maybeSingle();

  if (!reservation) notFound();

  // Server-side check: can this be modified?
  const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`);
  const hoursUntil = (reservationDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const canModify = reservation.status === 'confirmed' && hoursUntil >= 2;

  if (!canModify) {
    redirect(`/me/reservations/${params.code}`);
  }

  return <EditReservationClient reservation={reservation as any} />;
}
