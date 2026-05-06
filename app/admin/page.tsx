import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';
import AdminHeader from '@/components/AdminHeader';
import { permissionsFor, type Role } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('restaurant_members')
    .select('role, restaurants(*)')
    .eq('user_id', user.id);

  const restaurants = (memberships ?? [])
    .map((m: any) => ({ ...m.restaurants, role: m.role as Role }))
    .filter(r => r.id);

  if (restaurants.length === 0) redirect('/onboarding');

  const admin = createAdminClient();
  const restaurantIds = restaurants.map((r: any) => r.id);

  // Pending payments
  const { data: pendingPayments } = await admin
    .from('payment_intents')
    .select('restaurant_id')
    .in('restaurant_id', restaurantIds)
    .eq('status', 'claimed');

  const pendingMap = new Map<string, number>();
  for (const p of pendingPayments ?? []) {
    pendingMap.set(p.restaurant_id, (pendingMap.get(p.restaurant_id) ?? 0) + 1);
  }

  // Today's reservations
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayReservations } = await admin
    .from('reservations')
    .select('restaurant_id')
    .in('restaurant_id', restaurantIds)
    .eq('reservation_date', today)
    .in('status', ['confirmed', 'pending', 'arrived']);

  const reservationsMap = new Map<string, number>();
  for (const r of todayReservations ?? []) {
    reservationsMap.set(r.restaurant_id, (reservationsMap.get(r.restaurant_id) ?? 0) + 1);
  }

  return (
    <main className="min-h-screen">
      <AdminHeader user={user} />
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-serif text-3xl">Your restaurants</h1>
          <Link href="/onboarding" className="px-3 py-2 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">
            + Add restaurant
          </Link>
        </div>

        <div className="space-y-3">
          {restaurants.map((r: any) => {
            const pending = pendingMap.get(r.id) ?? 0;
            const todayBookings = reservationsMap.get(r.id) ?? 0;
            const perms = permissionsFor(r.role);

            return (
              <div key={r.id} className="border border-charcoal/10 rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-xl">{r.name}</span>
                      <span className={`text-[10px] tracking-wider px-2 py-0.5 rounded uppercase ${
                        r.role === 'owner' ? 'bg-forest text-white' :
                        r.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                        'bg-cream text-charcoal'
                      }`}>{r.role}</span>
                    </div>
                    <div className="text-xs text-charcoal/60 mt-1">/r/{r.slug}{r.address ? ` · ${r.address}` : ''}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {perms.view_insights && (
                      <Link href={`/admin/${r.slug}/insights`} className="px-3 py-1.5 text-sm bg-forest text-white rounded hover:bg-forest/90">📊 Insights</Link>
                    )}
                    <Link href={`/admin/${r.slug}/reservations`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5 relative">
                      📅 Reservations
                      {todayBookings > 0 && (
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{todayBookings}</span>
                      )}
                    </Link>
                    {perms.verify_payments && (
                      <Link href={`/admin/${r.slug}/payments`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5 relative">
                        💸 Payments
                        {pending > 0 && (
                          <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{pending}</span>
                        )}
                      </Link>
                    )}
                    <Link href={`/admin/${r.slug}/walk-in`} className="px-3 py-1.5 text-sm bg-amber-700 text-white rounded hover:bg-amber-800">📦 Walk-in</Link>
                    {perms.edit_menu && (
                      <Link href={`/admin/${r.slug}/menu`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">Menu</Link>
                    )}
                    {perms.manage_offers && (
                      <Link href={`/admin/${r.slug}/offers`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">Offers</Link>
                    )}
                    <Link href={`/admin/${r.slug}/orders`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">Orders</Link>
                    {perms.edit_settings && (
                      <Link href={`/admin/${r.slug}/qr`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">QR</Link>
                    )}
                    {perms.manage_team && (
                      <Link href={`/admin/${r.slug}/team`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">👥 Team</Link>
                    )}
                    {perms.edit_settings && (
                      <Link href={`/admin/${r.slug}/settings`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">⚙️</Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
