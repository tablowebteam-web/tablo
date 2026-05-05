import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// POST: Customer claims they have paid
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId,
      tableId,
      tableNumber,
      customerId,
      customerName,
      customerPhone,
      totalAmount,
      upiReference,
      orderIds
    } = body;

    if (!restaurantId || !customerName || !totalAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from('payment_intents')
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        table_number: tableNumber,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        total_amount: Number(totalAmount),
        upi_reference: upiReference,
        order_ids: orderIds,
        status: 'claimed'
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
