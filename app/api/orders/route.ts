import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId,
      tableId,
      tableNumber,
      customerId,            // NEW: optional, set if customer is logged in
      items,
      subtotal,
      tax,
      total
    } = body;

    if (!restaurantId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Insert order (with optional customer link)
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        table_number: tableNumber,
        customer_id: customerId ?? null,
        status: 'received',
        subtotal,
        tax,
        total
      })
      .select()
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: orderErr?.message ?? 'Order insert failed' }, { status: 500 });
    }

    // Insert order items
    const orderItems = items.map((it: any) => ({
      order_id: order.id,
      menu_item_id: it.menuItemId,
      name: it.name,
      price: it.price,
      qty: it.qty
    }));
    const { error: itemsErr } = await admin.from('order_items').insert(orderItems);
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

    // Record visit if customer is logged in (best-effort)
    if (customerId) {
      try {
        await admin.from('customer_visits').insert({
          customer_id: customerId,
          restaurant_id: restaurantId,
          order_id: order.id
        });
      } catch (e) {
        // Don't fail the order just because visit insert failed
        console.error('Visit insert failed:', e);
      }
    }

    return NextResponse.json({ id: order.id, status: order.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
