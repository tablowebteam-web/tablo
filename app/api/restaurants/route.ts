import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

// POST: create new restaurant, link owner, create tables + initial category
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const {
      name,
      slug,
      address,
      phone,
      taxRate,
      tagline,
      tableCount,
      firstCategoryName
    } = body;

    // Validation
    if (!name || !slug) {
      return NextResponse.json({ error: 'Restaurant name and slug are required' }, { status: 400 });
    }

    // Slug format check: lowercase, alphanumeric, dashes only
    const slugRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({
        error: 'Slug must be 3-32 characters, lowercase letters/numbers/dashes only, and cannot start or end with a dash'
      }, { status: 400 });
    }

    const tableCountNum = Math.max(1, Math.min(100, Number(tableCount) || 4));
    const taxRateNum = Math.max(0, Math.min(50, Number(taxRate) || 5));

    const admin = createAdminClient();

    // Check slug uniqueness
    const { data: existingSlug } = await admin
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json({
        error: `The URL "/r/${slug}" is already taken. Try another.`
      }, { status: 409 });
    }

    // 1. Create restaurant
    const { data: restaurant, error: restErr } = await admin
      .from('restaurants')
      .insert({
        name,
        slug,
        tagline: tagline ?? null,
        address: address ?? null,
        phone: phone ?? null,
        tax_rate: taxRateNum,
        currency: 'INR',
        owner_email: user.email
      })
      .select()
      .single();

    if (restErr || !restaurant) {
      return NextResponse.json({ error: restErr?.message ?? 'Failed to create restaurant' }, { status: 500 });
    }

    // 2. Link membership (this user is the owner)
    const { error: memErr } = await admin.from('restaurant_members').insert({
      restaurant_id: restaurant.id,
      user_id: user.id,
      role: 'owner'
    });

    if (memErr) {
      // Rollback the restaurant
      await admin.from('restaurants').delete().eq('id', restaurant.id);
      return NextResponse.json({ error: 'Failed to link membership: ' + memErr.message }, { status: 500 });
    }

    // 3. Create tables (numbered 1, 2, 3, ...)
    const tableRows = Array.from({ length: tableCountNum }, (_, i) => ({
      restaurant_id: restaurant.id,
      number: i + 1,
      capacity: 2,
      qr_token: `tok_t${i + 1}_${restaurant.id.slice(0, 8)}_${Date.now().toString(36)}`
    }));
    const { error: tablesErr } = await admin.from('restaurant_tables').insert(tableRows);
    if (tablesErr) {
      // Best-effort: tables aren't critical to having a working restaurant. Log but don't fail.
      console.error('Failed to create tables:', tablesErr);
    }

    // 4. Create first category
    if (firstCategoryName && firstCategoryName.trim()) {
      await admin.from('menu_categories').insert({
        restaurant_id: restaurant.id,
        name: firstCategoryName.trim(),
        sort_order: 1
      });
    }

    return NextResponse.json({
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Signup error' }, { status: 500 });
  }
}

// GET: check if a slug is available
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'No slug' }, { status: 400 });

    const slugRegex = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ available: false, reason: 'invalid' });
    }

    const admin = createAdminClient();
    const { data } = await admin
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    return NextResponse.json({ available: !data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
