'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import type { Restaurant, RestaurantTable } from '@/lib/types';

export default function QRClient({
  restaurant,
  tables
}: {
  restaurant: Restaurant;
  tables: RestaurantTable[];
}) {
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [parcelQr, setParcelQr] = useState<string | null>(null);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    // Table QRs
    Promise.all(
      tables.map(async t => {
        const url = `${baseUrl}/r/${restaurant.slug}/t/${t.number}`;
        const dataUrl = await QRCode.toDataURL(url, {
          margin: 2,
          width: 400,
          color: { dark: '#0F6E56', light: '#FFFFFF' }
        });
        return [t.id, dataUrl] as const;
      })
    ).then(pairs => {
      const map: Record<string, string> = {};
      pairs.forEach(([id, url]) => { map[id] = url; });
      setQrs(map);
    });

    // Parcel QR (separate color so staff can tell them apart visually)
    QRCode.toDataURL(`${baseUrl}/r/${restaurant.slug}/parcel`, {
      margin: 2,
      width: 400,
      color: { dark: '#9A3412', light: '#FFFFFF' }   // amber/orange for parcel
    }).then(setParcelQr);
  }, [restaurant.slug, tables, baseUrl]);

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex justify-between items-center mb-6 print:hidden flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
          <h1 className="font-serif text-3xl mt-1">QR codes for {restaurant.name}</h1>
          <p className="text-sm text-charcoal/60 mt-1">Print these and place them at each table + the parcel counter.</p>
        </div>
        <button onClick={() => window.print()} className="px-4 py-2 bg-charcoal text-white rounded text-sm">
          Print all
        </button>
      </header>

      {/* Parcel QR — featured at top, distinctive style */}
      <div className="mb-6">
        <div className="text-xs tracking-widest text-charcoal/50 mb-2 print:hidden">PARCEL / TAKEAWAY</div>
        <div className="border-2 border-amber-700 rounded-lg p-6 text-center bg-amber-50/50 max-w-sm mx-auto">
          <div className="text-[10px] tracking-[2px] text-amber-900">TABLO · TAKEAWAY</div>
          <div className="font-serif text-xl mt-1 mb-1 text-charcoal">{restaurant.name}</div>
          <div className="text-[11px] text-amber-900 font-medium tracking-wide mb-3">📦 PARCEL · TAKEAWAY ORDER</div>
          {parcelQr && (
            <img src={parcelQr} alt="Parcel QR" className="w-full max-w-[200px] mx-auto" />
          )}
          <div className="font-serif text-base mt-3 text-amber-900">Scan to order takeaway</div>
          <div className="text-[10px] text-amber-800/70 mt-1">Sign in to track your order & unlock offers</div>
        </div>
      </div>

      <div className="text-xs tracking-widest text-charcoal/50 mb-2 print:hidden">DINE-IN TABLES</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tables.map(t => (
          <div key={t.id} className="border border-charcoal/15 rounded-lg p-6 text-center bg-white">
            <div className="text-[10px] tracking-[2px] text-charcoal/50">TABLO</div>
            <div className="font-serif text-2xl mt-1 mb-3">{restaurant.name}</div>
            {qrs[t.id] && (
              <img src={qrs[t.id]} alt={`QR for table ${t.number}`} className="w-full max-w-[200px] mx-auto" />
            )}
            <div className="font-serif text-3xl mt-3">Table {t.number}</div>
            <div className="text-xs text-charcoal/60 mt-2">Scan to view menu & order</div>
          </div>
        ))}
      </div>
    </main>
  );
}
