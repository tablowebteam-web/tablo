import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: sa } = await supabase
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!sa) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const { restaurantId, amount, method, reference } = body;
    if (!restaurantId || !amount) {
      return NextResponse.json({ error: 'Missing restaurantId or amount' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get current subscription
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, current_period_end')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

    // Record payment
    const { error: payErr } = await admin.from('subscription_payments').insert({
      subscription_id: sub.id,
      amount: Number(amount),
      method,
      reference: reference || null,
      recorded_by: user.id,
      paid_at: new Date().toISOString()
    });
    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

    // Extend subscription: set status=active, push period_end forward 30 days
    const now = new Date();
    const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    // If period hadn't ended yet, extend from current end. Otherwise extend from today.
    const baseDate = currentEnd && currentEnd > now ? currentEnd : now;
    const newPeriodEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error: subErr } = await admin
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_start: baseDate.toISOString(),
        current_period_end: newPeriodEnd.toISOString()
      })
      .eq('id', sub.id);

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, newPeriodEnd: newPeriodEnd.toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
