import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import ReceiptClient from './ReceiptClient';

export const dynamic = 'force-dynamic';

export default async function ReceiptPage({
  params,
  searchParams
}: {
  params: { code: string };
  searchParams: { split?: string };
}) {
  const supabase = createServerSupabase();

  // Code can be either a payment_intent ID or comma-separated order IDs
  // Format: "pay_<uuid>" for payment intents, or "ord_<uuid1>,<uuid2>" for direct order list
  const code = params.code;
  let orders: any[] = [];
  let restaurant: any = null;
  let table: any = null;
  let paymentInfo: any = null;

  if (code.startsWith('pay_')) {
    const intentId = code.slice(4);
    const { data: intent } = await supabase
      .from('payment_intents')
      .select('*, restaurants(*)')
      .eq('id', intentId)
      .maybeSingle();
    if (!intent) notFound();

    restaurant = intent.restaurants;
    paymentInfo = intent;

    if (intent.order_ids && intent.order_ids.length > 0) {
      const { data: orderRows } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .in('id', intent.order_ids)
        .order('created_at', { ascending: true });
      orders = orderRows ?? [];
    }

    if (intent.table_number) {
      const { data: tbl } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', intent.restaurant_id)
        .eq('number', intent.table_number)
        .maybeSingle();
      table = tbl;
    }
  } else if (code.startsWith('ord_')) {
    const orderIds = code.slice(4).split(',');
    const { data: orderRows } = await supabase
      .from('orders')
      .select('*, order_items(*), restaurants(*)')
      .in('id', orderIds)
      .order('created_at', { ascending: true });
    orders = orderRows ?? [];
    if (orders.length > 0) {
      restaurant = orders[0].restaurants;
      if (orders[0].table_number) {
        const { data: tbl } = await supabase
          .from('restaurant_tables')
          .select('*')
          .eq('restaurant_id', orders[0].restaurant_id)
          .eq('number', orders[0].table_number)
          .maybeSingle();
        table = tbl;
      }
    }
  } else {
    notFound();
  }

  if (!restaurant || orders.length === 0) notFound();

  const splitInto = searchParams.split ? Math.max(1, parseInt(searchParams.split, 10)) : 1;

  return (
    <ReceiptClient
      restaurant={restaurant}
      orders={orders}
      table={table}
      paymentInfo={paymentInfo}
      splitInto={splitInto}
      receiptCode={code}
    />
  );
}
