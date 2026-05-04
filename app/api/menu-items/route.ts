import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// Helper: verify user is a member of the restaurant
async function verifyMembership(restaurantId: string) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated', supabase, user: null };

  const { data: membership } = await supabase
    .from('restaurant_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (!membership) return { ok: false, error: 'Not a member', supabase, user };
  return { ok: true, supabase, user };
}

// POST: create new menu item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, categoryId, name, description, price, isVeg, isChefPick, allergens } = body;

    if (!restaurantId || !name || price === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { ok, error, supabase } = await verifyMembership(restaurantId);
    if (!ok) return NextResponse.json({ error }, { status: 403 });

    const { data, error: insertErr } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        category_id: categoryId,
        name,
        description: description ?? null,
        price: Number(price),
        is_veg: !!isVeg,
        is_chef_pick: !!isChefPick,
        is_available: true,
        allergens: allergens ?? null,
        sort_order: 999
      })
      .select()
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
