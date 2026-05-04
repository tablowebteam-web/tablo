import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// POST: create new category
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, name } = body;
    if (!restaurantId || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { data, error } = await supabase
      .from('menu_categories')
      .insert({ restaurant_id: restaurantId, name, sort_order: 999 })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
