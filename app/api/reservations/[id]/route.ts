import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { action, tableId, cancelledReason, date, time, partySize, notes } = body;

    const validActions = ['cancel', 'arrived', 'no_show', 'completed', 'confirm', 'assign_table', 'modify'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const admin = createAdminClient();

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

    // Customer-only allowed actions: cancel, modify
    if (!isOwner && !isCustomer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (isCustomer && !isOwner && !['cancel', 'modify'].includes(action)) {
      return NextResponse.json({ error: 'Restaurant staff only' }, { status: 403 });
    }

    // Time-based deadline checks (only for customer-initiated actions)
    const reservationDateTime = new Date(`${reservation.reservation_date}T${reservation.reservation_time}`);
    const hoursUntil = (reservationDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (isCustomer && !isOwner) {
      if (action === 'cancel' && hoursUntil < 24) {
        return NextResponse.json({ error: 'Cannot cancel less than 24 hours before. Please call the restaurant.' }, { status: 400 });
      }
      if (action === 'modify' && hoursUntil < 2) {
        return NextResponse.json({ error: 'Cannot modify less than 2 hours before. Please call the restaurant.' }, { status: 400 });
      }
      // Status checks
      if (action === 'cancel' && !['pending', 'confirmed'].includes(reservation.status)) {
        return NextResponse.json({ error: 'This reservation can no longer be cancelled' }, { status: 400 });
      }
      if (action === 'modify' && reservation.status !== 'confirmed') {
        return NextResponse.json({ error: 'This reservation can no longer be modified' }, { status: 400 });
      }
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
      case 'modify': {
        if (!date || !time || !partySize) {
          return NextResponse.json({ error: 'Missing date/time/partySize' }, { status: 400 });
        }

        // If modifying date or time, re-check slot availability
        const dateChanged = date !== reservation.reservation_date;
        const timeChanged = time !== reservation.reservation_time;
        const partyChanged = Number(partySize) !== reservation.party_size;

        if (dateChanged || timeChanged || partyChanged) {
          // Get restaurant config
          const { data: rest } = await admin
            .from('restaurants')
            .select('booking_slot_minutes')
            .eq('id', reservation.restaurant_id)
            .single();

          // Check capacity at the new slot — count seats occupied EXCLUDING this reservation
          const { data: tables } = await admin
            .from('restaurant_tables')
            .select('capacity')
            .eq('restaurant_id', reservation.restaurant_id);
          const totalCapacity = (tables ?? []).reduce((s, t) => s + Number(t.capacity ?? 0), 0);

          const { data: otherReservations } = await admin
            .from('reservations')
            .select('reservation_time, party_size, duration_minutes')
            .eq('restaurant_id', reservation.restaurant_id)
            .eq('reservation_date', date)
            .neq('id', params.id)
            .in('status', ['confirmed', 'pending', 'arrived']);

          const [h, m] = time.split(':').map(Number);
          const slotStart = h * 60 + m;
          const slotEnd = slotStart + 90;
          let occupied = 0;
          for (const r of otherReservations ?? []) {
            const [rh, rm] = (r.reservation_time as string).split(':').map(Number);
            const rStart = rh * 60 + rm;
            const rEnd = rStart + Number(r.duration_minutes ?? 90);
            if (slotStart < rEnd && slotEnd > rStart) {
              occupied += Number(r.party_size);
            }
          }

          if (totalCapacity - occupied < Number(partySize)) {
            return NextResponse.json({ error: 'No availability at that time. Please pick another slot.' }, { status: 400 });
          }
        }

        updates.reservation_date = date;
        updates.reservation_time = time;
        updates.party_size = Number(partySize);
        if (notes !== undefined) updates.notes = notes || null;
        // Reset table assignment if date/time changed
        if (dateChanged || timeChanged) {
          updates.table_id = null;
        }
        break;
      }
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
