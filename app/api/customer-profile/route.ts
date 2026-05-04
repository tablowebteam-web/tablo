import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();

    // Build updates object — only include fields that were sent
    const updates: any = { user_id: user.id };
    if (body.name !== undefined) updates.name = body.name || null;
    if (body.phone !== undefined) updates.phone = body.phone || null;
    if (body.birthday !== undefined) updates.birthday = body.birthday || null;
    if (body.anniversary !== undefined) updates.anniversary = body.anniversary || null;

    // Use admin client to bypass RLS edge cases on upsert
    const admin = createAdminClient();

    // Try true upsert (insert or update on conflict) — most reliable approach
    const { data, error } = await admin
      .from('customer_profiles')
      .upsert(updates, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('Profile save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Profile save exception:', e);
    return NextResponse.json({ error: e.message ?? 'Save failed' }, { status: 500 });
  }
}
