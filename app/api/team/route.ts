import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

// GET — list members
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 });

    // Verify the user is a member
    const { data: myMembership } = await supabase
      .from('restaurant_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!myMembership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const admin = createAdminClient();

    const { data: members } = await admin
      .from('restaurant_members')
      .select('id, role, user_id, invited_email, invited_at, accepted_at, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true });

    // Look up emails
    const userIds = (members ?? []).filter(m => m.user_id).map(m => m.user_id);
    let emailsByUserId: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (authData?.users) {
        for (const u of authData.users) {
          if (userIds.includes(u.id)) {
            emailsByUserId[u.id] = u.email ?? '';
          }
        }
      }
    }

    const enriched = (members ?? []).map(m => ({
      ...m,
      email: m.user_id ? (emailsByUserId[m.user_id] ?? '—') : (m.invited_email ?? '—'),
      is_pending: !m.user_id
    }));

    return NextResponse.json({ members: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — invite a new member
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { restaurantId, email, role } = body;

    if (!restaurantId || !email || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (!['manager', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Verify the user is owner
    const { data: myMembership } = await supabase
      .from('restaurant_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (!myMembership || myMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can invite' }, { status: 403 });
    }

    const admin = createAdminClient();
    const cleanEmail = email.toLowerCase().trim();

    // Check if user with this email already exists
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = authData?.users?.find(u => u.email?.toLowerCase() === cleanEmail);

    // Check if there's already a membership for this email/user
    if (existingUser) {
      const { data: existing } = await admin
        .from('restaurant_members')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', existingUser.id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'This user is already on the team' }, { status: 400 });
      }
    } else {
      const { data: existingInvite } = await admin
        .from('restaurant_members')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('invited_email', cleanEmail)
        .maybeSingle();
      if (existingInvite) {
        return NextResponse.json({ error: 'This email is already invited' }, { status: 400 });
      }
    }

    // Create the membership
    const { data, error } = await admin
      .from('restaurant_members')
      .insert({
        restaurant_id: restaurantId,
        user_id: existingUser?.id ?? null,
        invited_email: existingUser ? null : cleanEmail,
        role,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        accepted_at: existingUser ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
