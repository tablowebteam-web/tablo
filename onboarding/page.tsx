import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import OnboardingClient from './OnboardingClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // If user already has a restaurant, send them to admin
  const { data: memberships } = await supabase
    .from('restaurant_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect('/admin');
  }

  return <OnboardingClient userEmail={user.email ?? ''} />;
}
