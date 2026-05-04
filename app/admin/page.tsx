import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import AdminHeader from '@/components/AdminHeader';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch restaurants the user is a member of
  const { data: memberships } = await supabase
    .from('restaurant_members')
    .select('role, restaurants(*)')
    .eq('user_id', user.id);

  const restaurants = (memberships ?? [])
    .map((m: any) => ({ ...m.restaurants, role: m.role }))
    .filter(r => r.id);

  return (
    <main className="min-h-screen">
      <AdminHeader user={user} />

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-serif text-3xl">Your restaurants</h1>
        </div>

        {restaurants.length === 0 ? (
          <div className="bg-white border border-charcoal/10 rounded-lg p-8 text-center">
            <h2 className="font-serif text-xl mb-2">No restaurants linked yet</h2>
            <p className="text-sm text-charcoal/60 max-w-md mx-auto leading-relaxed">
              Your account ({user.email}) isn't linked to any restaurant. Ask your admin to add you, or run the SQL snippet from <code className="text-xs bg-charcoal/5 px-1 py-0.5 rounded">auth_migration.sql</code> to link yourself to the demo restaurant.
            </p>
            <div className="mt-6 bg-charcoal/5 rounded-md p-3 text-left">
              <code className="text-[11px] font-mono whitespace-pre-wrap block">{`INSERT INTO restaurant_members (restaurant_id, user_id, role)
SELECT '11111111-1111-1111-1111-111111111111', id, 'owner'
FROM auth.users WHERE email = '${user.email}';`}</code>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {restaurants.map((r: any) => (
              <div key={r.id} className="border border-charcoal/10 rounded-lg p-4 bg-white">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-xl">{r.name}</span>
                      <span className="text-[10px] tracking-wider bg-cream text-forest px-2 py-0.5 rounded uppercase">
                        {r.role}
                      </span>
                    </div>
                    <div className="text-xs text-charcoal/60 mt-1">/r/{r.slug} · {r.address}</div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/admin/${r.slug}/menu`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">Menu</Link>
                    <Link href={`/admin/${r.slug}/qr`} className="px-3 py-1.5 text-sm border border-charcoal/20 rounded hover:bg-charcoal/5">QR codes</Link>
                    <Link href={`/admin/${r.slug}/orders`} className="px-3 py-1.5 text-sm bg-charcoal text-white rounded hover:bg-charcoal/90">Orders</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
