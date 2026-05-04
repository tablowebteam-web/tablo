import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { restaurant_id, offer_type, enabled, discount_kind, discount_value, description } = body;

    if (!restaurant_id || !offer_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const admin = createAdminClient();

    const { data, error } = await admin
      .from('restaurant_offers')
      .upsert(
        {
          restaurant_id,
          offer_type,
          enabled: !!enabled,
          discount_kind: discount_kind ?? 'percent',
          discount_value: Number(discount_value) || 0,
          description: description?.trim() || null
        },
        { onConflict: 'restaurant_id,offer_type' }
      )
      .select()
      .single();

    if (error) {
      console.error('Offer save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Save failed' }, { status: 500 });
  }
}
