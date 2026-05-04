'use client';

import Link from 'next/link';
import type { Restaurant } from '@/lib/types';

interface KPIs {
  todayRevenue: number;
  yesterdayRevenue: number;
  todayOrderCount: number;
  todayAvgOrderValue: number;
  todayDiscounts: number;
  activeTables: number;
}

interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
}

interface Dish {
  name: string;
  qty: number;
  revenue: number;
}

export default function InsightsClient({
  restaurant,
  kpis,
  dailyRevenue,
  topDishes,
  hourCounts,
  peakHourIndex,
  customers,
  topRegulars
}: {
  restaurant: Restaurant;
  kpis: KPIs;
  dailyRevenue: DailyPoint[];
  topDishes: Dish[];
  hourCounts: number[];
  peakHourIndex: number;
  customers: { total: number; new: number; returning: number };
  topRegulars: { name: string; visitCount: number }[];
}) {
  const revenueChange = kpis.yesterdayRevenue > 0
    ? Math.round(((kpis.todayRevenue - kpis.yesterdayRevenue) / kpis.yesterdayRevenue) * 100)
    : null;

  const maxDailyRevenue = Math.max(...dailyRevenue.map(d => d.revenue), 1);
  const maxHourCount = Math.max(...hourCounts, 1);
  const totalRevenue30d = dailyRevenue.reduce((s, d) => s + d.revenue, 0);
  const totalOrders30d = dailyRevenue.reduce((s, d) => s + d.orders, 0);
  const avgDaily = Math.round(totalRevenue30d / 30);

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex justify-between items-start flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
          <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Insights</h1>
          <p className="text-sm text-charcoal/60 mt-1">Last 30 days of business at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/${restaurant.slug}/orders`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">Orders</Link>
          <Link href={`/admin/${restaurant.slug}/menu`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">Menu</Link>
        </div>
      </header>

      {/* TOP KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Today's revenue"
          value={`₹${kpis.todayRevenue.toLocaleString('en-IN')}`}
          sub={
            revenueChange !== null
              ? <span className={revenueChange >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {revenueChange >= 0 ? '↑' : '↓'} {Math.abs(revenueChange)}% vs yesterday
                </span>
              : <span className="text-charcoal/50">No yesterday data</span>
          }
        />
        <KpiCard
          label="Today's orders"
          value={kpis.todayOrderCount.toString()}
          sub={
            kpis.todayAvgOrderValue > 0
              ? <span className="text-charcoal/50">avg ₹{kpis.todayAvgOrderValue.toLocaleString('en-IN')} / order</span>
              : <span className="text-charcoal/50">—</span>
          }
        />
        <KpiCard
          label="Active tables"
          value={kpis.activeTables.toString()}
          sub={<span className="text-charcoal/50">orders in last hour</span>}
        />
        <KpiCard
          label="Discounts today"
          value={`₹${kpis.todayDiscounts.toLocaleString('en-IN')}`}
          sub={<span className="text-charcoal/50">offered to customers</span>}
        />
      </div>

      {/* MAIN GRID */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Revenue chart - takes 2 columns */}
        <div className="lg:col-span-2 bg-white border border-charcoal/10 rounded-lg p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-serif text-lg">Revenue · last 30 days</h2>
              <p className="text-xs text-charcoal/60 mt-0.5">
                Total: <strong className="text-charcoal">₹{totalRevenue30d.toLocaleString('en-IN')}</strong>
                <span className="mx-1.5">·</span>
                Avg ₹{avgDaily.toLocaleString('en-IN')}/day
                <span className="mx-1.5">·</span>
                {totalOrders30d} orders
              </p>
            </div>
          </div>
          <RevenueChart data={dailyRevenue} maxValue={maxDailyRevenue} />
        </div>

        {/* Customer breakdown */}
        <div className="bg-white border border-charcoal/10 rounded-lg p-5">
          <h2 className="font-serif text-lg mb-1">Customers</h2>
          <p className="text-xs text-charcoal/60 mb-4">Last 30 days</p>

          <div className="text-center py-3">
            <div className="font-serif text-4xl">{customers.total}</div>
            <div className="text-xs text-charcoal/60 mt-1">Unique customers</div>
          </div>

          {customers.total > 0 && (
            <>
              {/* New vs returning bar */}
              <div className="mt-3">
                <div className="flex h-2 rounded-full overflow-hidden bg-charcoal/10">
                  <div
                    className="bg-forest"
                    style={{ width: `${(customers.returning / customers.total) * 100}%` }}
                  />
                  <div
                    className="bg-cream border-l border-white"
                    style={{ width: `${(customers.new / customers.total) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] mt-2">
                  <span className="text-forest">● Returning ({customers.returning})</span>
                  <span className="text-charcoal/60">● New ({customers.new})</span>
                </div>
              </div>
            </>
          )}

          {/* Top regulars */}
          {topRegulars.length > 0 && (
            <div className="mt-5 pt-4 border-t border-charcoal/10">
              <div className="text-xs tracking-widest text-charcoal/50 mb-2">TOP REGULARS</div>
              <div className="space-y-2">
                {topRegulars.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="truncate">
                      <span className="text-charcoal/40 mr-1.5">{i + 1}.</span>
                      {r.name}
                    </span>
                    <span className="text-charcoal/60 text-xs shrink-0">{r.visitCount} visits</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customers.total === 0 && (
            <div className="text-center text-xs text-charcoal/50 mt-4">
              No customer signups yet. Once diners log in, you'll see them here.
            </div>
          )}
        </div>
      </div>

      {/* SECONDARY GRID */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top dishes */}
        <div className="bg-white border border-charcoal/10 rounded-lg p-5">
          <h2 className="font-serif text-lg mb-1">Top dishes</h2>
          <p className="text-xs text-charcoal/60 mb-4">Best sellers in the last 30 days</p>

          {topDishes.length === 0 ? (
            <div className="text-center text-xs text-charcoal/50 py-8">No orders yet.</div>
          ) : (
            <div className="space-y-2.5">
              {topDishes.map((d, i) => {
                const widthPct = (d.qty / topDishes[0].qty) * 100;
                return (
                  <div key={d.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="truncate flex items-center gap-2 min-w-0">
                        <span className="text-charcoal/40 text-xs shrink-0">{i + 1}.</span>
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="text-charcoal/60 text-xs shrink-0 ml-2">
                        {d.qty} · ₹{d.revenue.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="h-1.5 bg-charcoal/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-forest rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Peak hours */}
        <div className="bg-white border border-charcoal/10 rounded-lg p-5">
          <h2 className="font-serif text-lg mb-1">Peak hours</h2>
          <p className="text-xs text-charcoal/60 mb-4">
            When orders come in (last 30 days). Busiest: <strong className="text-forest">{formatHour(peakHourIndex)}</strong>
          </p>
          <PeakHoursChart hourCounts={hourCounts} maxValue={maxHourCount} peakIdx={peakHourIndex} />
        </div>
      </div>
    </main>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="bg-white border border-charcoal/10 rounded-lg p-4">
      <div className="text-xs text-charcoal/60 mb-1">{label}</div>
      <div className="font-serif text-2xl mb-0.5">{value}</div>
      <div className="text-[11px]">{sub}</div>
    </div>
  );
}

function RevenueChart({ data, maxValue }: { data: DailyPoint[]; maxValue: number }) {
  const W = 700;
  const H = 180;
  const padding = { top: 10, right: 5, bottom: 24, left: 5 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const barWidth = chartW / data.length;
  const barInner = barWidth * 0.7;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Bars */}
        {data.map((d, i) => {
          const x = padding.left + i * barWidth + (barWidth - barInner) / 2;
          const barH = maxValue > 0 ? (d.revenue / maxValue) * chartH : 0;
          const y = padding.top + chartH - barH;
          const dayOfWeek = new Date(d.date + 'T12:00:00').getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const fill = d.revenue === 0 ? '#E5E3DB' : (isWeekend ? '#0F6E56' : '#1D9E75');
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={barInner} height={barH} fill={fill} rx="2">
                <title>{d.date}: ₹{d.revenue.toLocaleString('en-IN')} ({d.orders} orders)</title>
              </rect>
            </g>
          );
        })}

        {/* X-axis labels: show every 5th day */}
        {data.map((d, i) => {
          if (i % 5 !== 0 && i !== data.length - 1) return null;
          const x = padding.left + i * barWidth + barWidth / 2;
          const dt = new Date(d.date + 'T12:00:00');
          const label = `${dt.getDate()}/${dt.getMonth() + 1}`;
          return (
            <text key={`l-${d.date}`} x={x} y={H - 8} textAnchor="middle" fontSize="10" fill="#888780">
              {label}
            </text>
          );
        })}
      </svg>

      <div className="flex gap-3 mt-2 text-[10px] text-charcoal/60">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald" />Weekday</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-forest" />Weekend</span>
      </div>
    </div>
  );
}

function PeakHoursChart({ hourCounts, maxValue, peakIdx }: { hourCounts: number[]; maxValue: number; peakIdx: number }) {
  return (
    <div className="space-y-1">
      {hourCounts.map((count, h) => {
        const widthPct = maxValue > 0 ? (count / maxValue) * 100 : 0;
        const isPeak = h === peakIdx && count > 0;
        const showLabel = h % 3 === 0 || isPeak;
        return (
          <div key={h} className={`flex items-center gap-2 ${showLabel ? '' : 'opacity-70'}`}>
            <div className="w-12 text-[10px] text-charcoal/60 text-right shrink-0 tabular-nums">
              {showLabel ? formatHour(h) : ''}
            </div>
            <div className="flex-1 h-3 bg-charcoal/5 rounded relative">
              <div
                className={`absolute left-0 top-0 h-full rounded ${isPeak ? 'bg-forest' : 'bg-emerald/60'}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <div className="w-8 text-[10px] text-charcoal/60 tabular-nums">{count > 0 ? count : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}
