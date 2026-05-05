import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

// PATCH: Restaurant verifies (or rejects) a payment claim
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { paymentIntentId, action, notes } = body;
    if (!paymentIntentId || !['verify', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get the intent
    const { data: intent } = await admin
      .from('payment_intents')
      .select('*')
      .eq('id', paymentIntentId)
      .maybeSingle();

    if (!intent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Verify membership
    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', intent.restaurant_id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    // Update payment intent status
    const newStatus = action === 'verify' ? 'verified' : 'rejected';
    await admin
      .from('payment_intents')
      .update({
        status: newStatus,
        notes,
        verified_by: user.id,
        verified_at: new Date().toISOString()
      })
      .eq('id', paymentIntentId);

    // If verified, mark all the orders as 'paid'
    if (action === 'verify' && intent.order_ids && intent.order_ids.length > 0) {
      await admin
        .from('orders')
        .update({ status: 'paid' })
        .in('id', intent.order_ids);
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
