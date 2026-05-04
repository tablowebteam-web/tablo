import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// PATCH: update existing menu item
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Get the item to find its restaurant
    const { data: item } = await supabase
      .from('menu_items')
      .select('restaurant_id')
      .eq('id', params.id)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    // Verify membership
    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', item.restaurant_id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const body = await req.json();
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.price !== undefined) updates.price = Number(body.price);
    if (body.categoryId !== undefined) updates.category_id = body.categoryId;
    if (body.isVeg !== undefined) updates.is_veg = !!body.isVeg;
    if (body.isChefPick !== undefined) updates.is_chef_pick = !!body.isChefPick;
    if (body.isAvailable !== undefined) updates.is_available = !!body.isAvailable;
    if (body.allergens !== undefined) updates.allergens = body.allergens;
    if (body.sortOrder !== undefined) updates.sort_order = Number(body.sortOrder);

    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: remove menu item
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: item } = await supabase
      .from('menu_items')
      .select('restaurant_id')
      .eq('id', params.id)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', item.restaurant_id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { error } = await supabase.from('menu_items').delete().eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
