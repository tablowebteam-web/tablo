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

  // If no profile yet, create empty one (first-time customer)
  if (!profile) {
    const { data: created } = await supabase
      .from('customer_profiles')
      .insert({ user_id: user.id })
      .select()
      .single();
    profile = created;
  }

  // Get order history (orders linked to this customer)
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, status, created_at, table_number, restaurants(name, slug)')
    .eq('customer_id', profile?.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <CustomerProfileClient
      userEmail={user.email ?? ''}
      profile={profile!}
      orders={(orders ?? []) as any[]}
    />
  );
}
