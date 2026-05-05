import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { restaurantId, upi_id, upi_payee_name, payment_mode } = body;
    if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 });

    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const admin = createAdminClient();

    const updates: any = {};
    if (upi_id !== undefined) updates.upi_id = upi_id;
    if (upi_payee_name !== undefined) updates.upi_payee_name = upi_payee_name;
    if (payment_mode !== undefined) {
      if (!['pay_after', 'pay_first'].includes(payment_mode)) {
        return NextResponse.json({ error: 'Invalid payment_mode' }, { status: 400 });
      }
      updates.payment_mode = payment_mode;
    }

    const { data, error } = await admin
      .from('restaurants')
      .update(updates)
      .eq('id', restaurantId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
