import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// GET /api/reservations/slots?restaurantId=...&date=YYYY-MM-DD&partySize=4
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    const date = searchParams.get('date');
    const partySize = Number(searchParams.get('partySize') ?? 2);

    if (!restaurantId || !date) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get restaurant booking config
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('booking_enabled, booking_opens_hours, booking_closes_hours, booking_slot_minutes, booking_lead_time_minutes, booking_advance_days')
      .eq('id', restaurantId)
      .maybeSingle();

    if (!restaurant?.booking_enabled) {
      return NextResponse.json({ slots: [] });
    }

    const opensH = restaurant.booking_opens_hours ?? 11;
    const closesH = restaurant.booking_closes_hours ?? 22;
    const slotMins = restaurant.booking_slot_minutes ?? 30;
    const leadMins = restaurant.booking_lead_time_minutes ?? 60;

    // Get total tables capacity
    const { data: tables } = await admin
      .from('restaurant_tables')
      .select('capacity')
      .eq('restaurant_id', restaurantId);

    const totalCapacity = (tables ?? []).reduce((s, t) => s + Number(t.capacity ?? 0), 0);
    if (totalCapacity === 0) {
      return NextResponse.json({ slots: [] });
    }

    // Get existing reservations for that date
    const { data: existingReservations } = await admin
      .from('reservations')
      .select('reservation_time, party_size, duration_minutes')
      .eq('restaurant_id', restaurantId)
      .eq('reservation_date', date)
      .in('status', ['confirmed', 'pending', 'arrived']);

    // Build all possible slots between opens and closes
    const allSlots: string[] = [];
    for (let hour = opensH; hour < closesH; hour++) {
      for (let min = 0; min < 60; min += slotMins) {
        allSlots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
      }
    }

    // Filter out slots in the past (with lead time)
    const now = new Date();
    const minBookableTime = new Date(now.getTime() + leadMins * 60 * 1000);
    const isToday = date === now.toISOString().slice(0, 10);

    const availableSlots = allSlots.filter(slot => {
      const [h, m] = slot.split(':').map(Number);

      // Check lead time
      if (isToday) {
        const slotDate = new Date();
        slotDate.setHours(h, m, 0, 0);
        if (slotDate < minBookableTime) return false;
      }

      // Calculate occupied capacity at this slot
      // A reservation occupies capacity from its start time to start + duration
      const slotMinutes = h * 60 + m;
      let occupiedSeats = 0;

      for (const r of existingReservations ?? []) {
        const [rh, rm] = (r.reservation_time as string).split(':').map(Number);
        const rStart = rh * 60 + rm;
        const rEnd = rStart + Number(r.duration_minutes ?? 90);

        // Does this reservation overlap with the requested slot?
        // Slot duration assumed = same as restaurant slot duration for simplicity
        const slotEnd = slotMinutes + 90;  // assume guest stays 90 mins
        if (slotMinutes < rEnd && slotEnd > rStart) {
          occupiedSeats += Number(r.party_size);
        }
      }

      // Is there enough capacity left for this party?
      return totalCapacity - occupiedSeats >= partySize;
    });

    return NextResponse.json({ slots: availableSlots });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
