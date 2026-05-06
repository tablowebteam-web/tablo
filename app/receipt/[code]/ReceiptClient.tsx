'use client';

import { useState } from 'react';
import Link from 'next/link';

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface Order {
  id: string;
  total: number;
  subtotal: number;
  tax: number;
  discount_amount: number | null;
  applied_offer: string | null;
  status: string;
  created_at: string;
  table_number: number | null;
  pickup_code: string | null;
  order_type: string | null;
  customer_name: string | null;
  order_items: OrderItem[];
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  tax_rate: number;
  tagline: string | null;
  upi_id?: string | null;
}

interface PaymentInfo {
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  upi_reference: string | null;
  status: string;
  verified_at: string | null;
}

export default function ReceiptClient({
  restaurant,
  orders,
  table,
  paymentInfo,
  splitInto,
  receiptCode
}: {
  restaurant: Restaurant;
  orders: Order[];
  table: { number: number; capacity: number } | null;
  paymentInfo: PaymentInfo | null;
  splitInto: number;
  receiptCode: string;
}) {
  const [splitCount, setSplitCount] = useState(splitInto);

  // Combined totals
  const totalSubtotal = orders.reduce((s, o) => s + Number(o.subtotal), 0);
  const totalTax = orders.reduce((s, o) => s + Number(o.tax), 0);
  const totalDiscount = orders.reduce((s, o) => s + Number(o.discount_amount ?? 0), 0);
  const grandTotal = orders.reduce((s, o) => s + Number(o.total), 0);
  const perPerson = splitCount > 1 ? Math.round(grandTotal / splitCount) : grandTotal;

  // Aggregate items across all orders for cleaner display
  const itemMap = new Map<string, { name: string; qty: number; price: number; total: number }>();
  for (const order of orders) {
    for (const item of order.order_items) {
      const key = `${item.name}|${item.price}`;
      const cur = itemMap.get(key) ?? { name: item.name, qty: 0, price: item.price, total: 0 };
      cur.qty += item.qty;
      cur.total += item.qty * item.price;
      itemMap.set(key, cur);
    }
  }
  const aggregatedItems = Array.from(itemMap.values());

  function handlePrint() {
    window.print();
  }

  function changeSplit(n: number) {
    const newCount = Math.max(1, n);
    setSplitCount(newCount);
    // Update URL without reload
    const url = new URL(window.location.href);
    if (newCount === 1) url.searchParams.delete('split');
    else url.searchParams.set('split', String(newCount));
    window.history.replaceState({}, '', url.toString());
  }

  function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  return (
    <main className="min-h-screen bg-[#F5F2EC] py-6 print:bg-white print:py-0">
      {/* Print/Split controls — hidden on print */}
      <div className="max-w-[400px] mx-auto px-4 mb-4 print:hidden">
        <div className="flex justify-between items-center mb-3">
          <Link href="/" className="text-xs text-charcoal/60 hover:text-charcoal">← Home</Link>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-forest text-white text-sm rounded-md hover:bg-forest/90 font-medium"
          >
            🖨️ Save / Print PDF
          </button>
        </div>

        <div className="bg-white rounded-lg p-3 border border-charcoal/10">
          <label className="text-xs font-medium text-charcoal/70 mb-2 block">Split bill among:</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeSplit(splitCount - 1)}
              disabled={splitCount <= 1}
              className="w-8 h-8 rounded-full border border-charcoal/30 disabled:opacity-30"
            >−</button>
            <div className="flex-1 text-center">
              <div className="font-serif text-xl">{splitCount}</div>
              <div className="text-[10px] text-charcoal/60">{splitCount === 1 ? 'no split' : 'people'}</div>
            </div>
            <button
              onClick={() => changeSplit(splitCount + 1)}
              className="w-8 h-8 rounded-full border border-charcoal/30"
            >+</button>
          </div>
          {splitCount > 1 && (
            <div className="text-xs text-forest font-medium text-center mt-2">
              Each pays ₹{perPerson.toLocaleString('en-IN')}
            </div>
          )}
        </div>

        <div className="text-[10px] text-charcoal/50 text-center mt-2">
          On mobile: Print → "Save as PDF" to download
        </div>
      </div>

      {/* THE RECEIPT — designed for print */}
      <div className="max-w-[400px] mx-auto bg-white p-6 print:p-4 print:max-w-full print:shadow-none shadow-sm">
        {/* Header */}
        <div className="text-center pb-4 border-b border-charcoal/20">
          <div className="text-[10px] tracking-[3px] text-charcoal/50 mb-1">TABLO</div>
          <h1 className="font-serif text-2xl">{restaurant.name}</h1>
          {restaurant.tagline && <div className="text-[11px] text-charcoal/60 italic mt-0.5">{restaurant.tagline}</div>}
          {restaurant.address && <div className="text-[11px] text-charcoal/60 mt-1">{restaurant.address}</div>}
        </div>

        {/* Receipt info */}
        <div className="grid grid-cols-2 gap-2 py-3 text-[11px] border-b border-charcoal/10">
          <div>
            <div className="text-charcoal/50">Receipt</div>
            <div className="font-mono text-charcoal">{receiptCode.toUpperCase().slice(0, 16)}</div>
          </div>
          <div className="text-right">
            <div className="text-charcoal/50">Date</div>
            <div className="text-charcoal">{formatDateTime(orders[0].created_at)}</div>
          </div>
          {table && (
            <div>
              <div className="text-charcoal/50">Table</div>
              <div className="text-charcoal">{table.number}</div>
            </div>
          )}
          {orders.some(o => o.order_type === 'parcel') && (
            <div className="text-right">
              <div className="text-charcoal/50">Type</div>
              <div className="text-charcoal">📦 Parcel</div>
            </div>
          )}
          {paymentInfo?.customer_name && (
            <div className="col-span-2">
              <div className="text-charcoal/50">Customer</div>
              <div className="text-charcoal">{paymentInfo.customer_name}</div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="py-3">
          <div className="text-[10px] tracking-[2px] text-charcoal/50 mb-2">ITEMS</div>
          <div className="space-y-1.5">
            {aggregatedItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-charcoal">{item.name}</div>
                  <div className="text-[10px] text-charcoal/50">₹{item.price} × {item.qty}</div>
                </div>
                <div className="font-medium text-charcoal shrink-0 ml-2">₹{item.total.toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-charcoal/20 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-charcoal/70">
            <span>Subtotal</span>
            <span>₹{totalSubtotal.toLocaleString('en-IN')}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-forest">
              <span>Discount</span>
              <span>−₹{totalDiscount.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex justify-between text-charcoal/70">
            <span>GST ({restaurant.tax_rate}%)</span>
            <span>₹{totalTax.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-base font-medium pt-2 mt-2 border-t border-charcoal/30">
            <span className="font-serif text-lg">TOTAL</span>
            <span className="font-serif text-lg">₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>

          {splitCount > 1 && (
            <div className="mt-3 pt-3 border-t-2 border-charcoal/30 border-dashed">
              <div className="bg-cream/60 rounded p-3 text-center">
                <div className="text-[11px] text-charcoal/60">Split among {splitCount} people</div>
                <div className="font-serif text-xl text-forest mt-1">₹{perPerson.toLocaleString('en-IN')} per person</div>
              </div>
            </div>
          )}
        </div>

        {/* Payment info */}
        {paymentInfo && paymentInfo.status === 'verified' && (
          <div className="border-t border-charcoal/10 pt-3 mt-3 text-[11px] text-charcoal/60">
            <div className="flex justify-between mb-0.5">
              <span>Payment status</span>
              <span className="text-emerald-700 font-medium">✓ PAID</span>
            </div>
            {paymentInfo.upi_reference && (
              <div className="flex justify-between">
                <span>UPI ref</span>
                <span className="font-mono">{paymentInfo.upi_reference}</span>
              </div>
            )}
            {paymentInfo.verified_at && (
              <div className="flex justify-between">
                <span>Paid at</span>
                <span>{formatDateTime(paymentInfo.verified_at)}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 mt-3 border-t border-charcoal/10">
          <div className="text-[11px] text-charcoal/60">Thank you for dining with us!</div>
          <div className="text-[10px] text-charcoal/40 mt-2">Powered by Tablo · tablo.app</div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          @page { margin: 10mm; size: 80mm auto; }
        }
      `}</style>
    </main>
  );
}
