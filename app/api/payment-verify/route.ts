import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

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

    if (action === 'verify' && intent.order_ids && intent.order_ids.length > 0) {
      // Get restaurant payment mode to know how to handle
      const { data: rest } = await admin
        .from('restaurants')
        .select('payment_mode')
        .eq('id', intent.restaurant_id)
        .maybeSingle();

      if (rest?.payment_mode === 'pay_first') {
        // Pay-first mode: order was already 'received' status but had payment_state='pending'
        // Now mark payment as paid → kitchen will see it (and KEEP status as 'received')
        await admin
          .from('orders')
          .update({ payment_state: 'paid' })
          .in('id', intent.order_ids);
      } else {
        // Pay-after mode: customer is done with their meal, mark order as 'paid' status entirely
        await admin
          .from('orders')
          .update({ status: 'paid', payment_state: 'paid' })
          .in('id', intent.order_ids);
      }
    } else if (action === 'reject' && intent.order_ids && intent.order_ids.length > 0) {
      // For pay-first: if rejected, cancel the orders (they were never paid)
      const { data: rest } = await admin
        .from('restaurants')
        .select('payment_mode')
        .eq('id', intent.restaurant_id)
        .maybeSingle();

      if (rest?.payment_mode === 'pay_first') {
        await admin
          .from('orders')
          .update({ status: 'cancelled' })
          .in('id', intent.order_ids);
      }
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
