import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { calculateBestOffer, type OfferConfig, type CustomerContext } from '@/lib/discounts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId,
      tableId,
      tableNumber,
      customerId,            // optional, set if customer is logged in
      items,
      subtotal,
      tax: clientTax,        // we'll re-calculate server-side
      total: clientTotal     // we'll re-calculate server-side
    } = body;

    if (!restaurantId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get restaurant for tax rate
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('tax_rate')
      .eq('id', restaurantId)
      .single();
    const taxRate = Number(restaurant?.tax_rate ?? 5);

    // Compute discount if customer is logged in
    let discountAmount = 0;
    let appliedOffer: string | null = null;

    if (customerId) {
      // Get customer profile
      const { data: profile } = await admin
        .from('customer_profiles')
        .select('birthday, anniversary')
        .eq('id', customerId)
        .maybeSingle();

      // Visit count at this restaurant (excluding this new order)
      const { count: visitCount } = await admin
        .from('customer_visits')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('restaurant_id', restaurantId);

      // Get this restaurant's offers
      const { data: offers } = await admin
        .from('restaurant_offers')
        .select('offer_type, enabled, discount_kind, discount_value, description')
        .eq('restaurant_id', restaurantId);

      if (profile && offers && offers.length > 0) {
        const customerCtx: CustomerContext = {
          birthday: profile.birthday,
          anniversary: profile.anniversary,
          visitCount: visitCount ?? 0
        };

        const best = calculateBestOffer(Number(subtotal), customerCtx, offers as OfferConfig[]);
        if (best) {
          discountAmount = best.discountAmount;
          appliedOffer = best.description;
        }
      }
    }

    // Recompute everything server-side (don't trust the client)
    const subtotalNum = Number(subtotal);
    const subtotalAfterDiscount = Math.max(0, subtotalNum - discountAmount);
    const tax = Math.round((subtotalAfterDiscount * taxRate) / 100);
    const total = subtotalAfterDiscount + tax;

    // Insert order
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        table_number: tableNumber,
        customer_id: customerId ?? null,
        status: 'received',
        subtotal: subtotalNum,
        tax,
        total,
        discount_amount: discountAmount,
        applied_offer: appliedOffer
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

    // Record visit if customer logged in (best-effort)
    if (customerId) {
      try {
        await admin.from('customer_visits').insert({
          customer_id: customerId,
          restaurant_id: restaurantId,
          order_id: order.id
        });
      } catch (e) {
        console.error('Visit insert failed:', e);
      }
    }

    return NextResponse.json({
      id: order.id,
      status: order.status,
      discountAmount,
      appliedOffer,
      tax,
      total
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
