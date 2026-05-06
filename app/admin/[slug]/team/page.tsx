import { notFound, redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';
import TeamClient from './TeamClient';
import AdminHeader from '@/components/AdminHeader';
import type { Restaurant } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', params.slug)
    .single<Restaurant>();
  if (!restaurant) notFound();

  // Check current user's role
  const { data: myMembership } = await supabase
    .from('restaurant_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!myMembership) notFound();

  // Use admin client to fetch member emails (RLS would block joining auth.users)
  const admin = createAdminClient();

  const { data: members } = await admin
    .from('restaurant_members')
    .select('id, role, user_id, invited_email, invited_at, accepted_at, created_at')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: true });

  // Look up emails for accepted members
  const userIds = (members ?? []).filter(m => m.user_id).map(m => m.user_id);
  let emailsByUserId: Record<string, string> = {};
  if (userIds.length > 0) {
    // Use the auth admin API to list users by id
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (authData?.users) {
      for (const u of authData.users) {
        if (userIds.includes(u.id)) {
          emailsByUserId[u.id] = u.email ?? '';
        }
      }
    }
  }

  const enrichedMembers = (members ?? []).map(m => ({
    ...m,
    email: m.user_id ? (emailsByUserId[m.user_id] ?? '—') : (m.invited_email ?? '—'),
    is_pending: !m.user_id
  }));

  return (
    <>
      <AdminHeader user={user} />
      <TeamClient
        restaurant={restaurant}
        members={enrichedMembers as any[]}
        myRole={myMembership.role}
        myUserId={user.id}
      />
    </>
  );
}
