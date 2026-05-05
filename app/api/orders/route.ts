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
      customerId,
      customerName,
      customerPhone,
      orderType = 'dine_in',
      items,
      subtotal,
      notes
    } = body;

    if (!restaurantId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate dine_in vs parcel constraints
    if (orderType === 'dine_in' && !tableId) {
      return NextResponse.json({ error: 'Dine-in orders need a table' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get restaurant tax rate
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('tax_rate')
      .eq('id', restaurantId)
      .single();
    const taxRate = Number(restaurant?.tax_rate ?? 5);

    // Compute discount if customer logged in
    let discountAmount = 0;
    let appliedOffer: string | null = null;

    if (customerId) {
      const { data: profile } = await admin
        .from('customer_profiles')
        .select('birthday, anniversary')
        .eq('id', customerId)
        .maybeSingle();

      const { count: visitCount } = await admin
        .from('customer_visits')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('restaurant_id', restaurantId);

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

    const subtotalNum = Number(subtotal);
    const subtotalAfterDiscount = Math.max(0, subtotalNum - discountAmount);
    const tax = Math.round((subtotalAfterDiscount * taxRate) / 100);
    const total = subtotalAfterDiscount + tax;

    // Generate pickup code for parcel orders
    let pickupCode: string | null = null;
    if (orderType === 'parcel') {
      const { data: codeResult } = await admin
        .rpc('generate_pickup_code', { p_restaurant_id: restaurantId });
      pickupCode = codeResult ?? `P-${Date.now().toString().slice(-4)}`;
    }

    // Insert order
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        restaurant_id: restaurantId,
        table_id: orderType === 'dine_in' ? tableId : null,
        table_number: orderType === 'dine_in' ? tableNumber : null,
        customer_id: customerId ?? null,
        customer_name: customerName ?? null,
        customer_phone: customerPhone ?? null,
        order_type: orderType,
        pickup_code: pickupCode,
        notes: notes ?? null,
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

    // Record visit if customer logged in
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
      orderType,
      pickupCode,
      discountAmount,
      appliedOffer,
      tax,
      total
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}
