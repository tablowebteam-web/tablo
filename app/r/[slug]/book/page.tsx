import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import BookClient from './BookClient';
import type { Restaurant } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function BookPage({ params }: { params: { slug: string } }) {
  const supabase = createServerSupabase();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant & {
      booking_enabled?: boolean;
      booking_opens_hours?: number;
      booking_closes_hours?: number;
      booking_slot_minutes?: number;
      booking_advance_days?: number;
      booking_min_party?: number;
      booking_max_party?: number;
      booking_lead_time_minutes?: number;
    }>();
  if (!restaurant) notFound();

  // Login required
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/customer-login?next=${encodeURIComponent(`/r/${params.slug}/book`)}`);
  }

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('id, name, phone')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile || !profile.name || !profile.phone) {
    redirect(`/me?returnTo=${encodeURIComponent(`/r/${params.slug}/book`)}`);
  }

  return (
    <BookClient
      restaurant={restaurant}
      customerProfile={profile}
      userEmail={user.email ?? ''}
    />
  );
}
