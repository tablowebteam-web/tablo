import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const {
      restaurantId,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      date,
      time,
      partySize,
      notes
    } = body;

    if (!restaurantId || !date || !time || !partySize || !customerName || !customerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify this customer profile belongs to the user
    const { data: profile } = await supabase
      .from('customer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', customerId)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: 'Profile mismatch' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Get restaurant booking settings
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('booking_enabled, booking_auto_confirm')
      .eq('id', restaurantId)
      .maybeSingle();

    if (!restaurant?.booking_enabled) {
      return NextResponse.json({ error: 'Bookings not enabled' }, { status: 400 });
    }

    const initialStatus = restaurant.booking_auto_confirm ? 'confirmed' : 'pending';

    const { data: reservation, error } = await admin
      .from('reservations')
      .insert({
        restaurant_id: restaurantId,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        reservation_date: date,
        reservation_time: time,
        party_size: Number(partySize),
        notes: notes || null,
        status: initialStatus
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(reservation);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
