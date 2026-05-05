import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { action, tableId, cancelledReason } = body;

    if (!['cancel', 'arrived', 'no_show', 'completed', 'confirm', 'assign_table'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get the reservation
    const { data: reservation } = await admin
      .from('reservations')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Permission check
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', reservation.restaurant_id)
      .maybeSingle();

    const isOwner = !!membership;
    const isCustomer = profile?.id === reservation.customer_id;

    // Customers can only cancel their own. Members can do anything.
    if (action === 'cancel') {
      if (!isOwner && !isCustomer) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (!isOwner) {
      return NextResponse.json({ error: 'Restaurant staff only' }, { status: 403 });
    }

    const updates: any = {};
    switch (action) {
      case 'cancel':
        updates.status = 'cancelled';
        updates.cancelled_at = new Date().toISOString();
        updates.cancelled_reason = cancelledReason || null;
        break;
      case 'confirm':
        updates.status = 'confirmed';
        break;
      case 'arrived':
        updates.status = 'arrived';
        updates.arrived_at = new Date().toISOString();
        break;
      case 'no_show':
        updates.status = 'no_show';
        break;
      case 'completed':
        updates.status = 'completed';
        break;
      case 'assign_table':
        updates.table_id = tableId || null;
        break;
    }

    const { data, error } = await admin
      .from('reservations')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
