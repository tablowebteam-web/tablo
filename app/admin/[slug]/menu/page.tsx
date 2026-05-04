import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase-server';
import AdminHeader from '@/components/AdminHeader';
import type { Restaurant, MenuCategory, MenuItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MenuAdminPage({ params }: { params: { slug: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: restaurant } = await supabase
    .from('restaurants').select('*').eq('slug', params.slug).single<Restaurant>();
  if (!restaurant) notFound();

  const { data: membership } = await supabase
    .from('restaurant_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: categories } = await supabase
    .from('menu_categories').select('*').eq('restaurant_id', restaurant.id).order('sort_order');
  const { data: items } = await supabase
    .from('menu_items').select('*').eq('restaurant_id', restaurant.id).order('sort_order');

  const cats = (categories ?? []) as MenuCategory[];
  const its = (items ?? []) as MenuItem[];

  return (
    <>
      <AdminHeader user={user} />
      <main className="min-h-screen p-6 max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-6">
          <div>
            <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
            <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Menu</h1>
          </div>
          <button disabled className="px-4 py-2 bg-charcoal/30 text-white rounded text-sm cursor-not-allowed">
            + Add item (coming soon)
          </button>
        </header>

        <div className="space-y-6">
          {cats.map(cat => (
            <div key={cat.id}>
              <div className="text-xs tracking-widest text-charcoal/50 mb-2">{cat.name.toUpperCase()}</div>
              <div className="border border-charcoal/10 rounded-lg overflow-hidden bg-white">
                {its.filter(i => i.category_id === cat.id).map(it => (
                  <div key={it.id} className="px-4 py-3 border-b border-charcoal/10 last:border-b-0 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{it.name}</span>
                        {it.is_chef_pick && <span className="text-[9px] bg-cream text-forest px-1.5 py-0.5 rounded">CHEF</span>}
                        {it.is_veg && <span className="text-[9px] border border-green-700 text-green-700 px-1.5 py-0.5 rounded">VEG</span>}
                      </div>
                      <div className="text-xs text-charcoal/60 mt-0.5">{it.description}</div>
                    </div>
                    <div className="text-sm font-medium">₹{it.price}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
