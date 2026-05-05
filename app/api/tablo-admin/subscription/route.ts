import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

async function requireSuperAdmin() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  const { data: sa } = await supabase
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!sa) return { ok: false, error: 'Forbidden — super admin only' };
  return { ok: true, user };
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

  try {
    const body = await req.json();
    const { restaurantId, planId, status, trialEndsAt, currentPeriodEnd, notes } = body;
    if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 });

    const admin = createAdminClient();

    // Upsert subscription (in case it doesn't exist yet)
    const { data, error } = await admin
      .from('subscriptions')
      .upsert(
        {
          restaurant_id: restaurantId,
          plan_id: planId,
          status,
          trial_ends_at: trialEndsAt,
          current_period_end: currentPeriodEnd,
          notes
        },
        { onConflict: 'restaurant_id' }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
