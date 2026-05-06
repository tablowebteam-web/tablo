import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

async function requireOwner(supabase: any, userId: string, memberId: string) {
  const admin = createAdminClient();

  // Get the member to find their restaurant
  const { data: member } = await admin
    .from('restaurant_members')
    .select('restaurant_id, user_id, role')
    .eq('id', memberId)
    .maybeSingle();
  if (!member) return { error: 'Not found', status: 404 };

  // Verify caller is owner of that restaurant
  const { data: myMembership } = await supabase
    .from('restaurant_members')
    .select('role')
    .eq('user_id', userId)
    .eq('restaurant_id', member.restaurant_id)
    .maybeSingle();
  if (!myMembership || myMembership.role !== 'owner') {
    return { error: 'Only owners can manage team', status: 403 };
  }

  // Can't modify yourself
  if (member.user_id === userId) {
    return { error: "Can't modify your own membership", status: 400 };
  }

  // Can't modify another owner
  if (member.role === 'owner') {
    return { error: "Can't modify another owner", status: 400 };
  }

  return { member };
}

// PATCH — change role
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const check = await requireOwner(supabase, user.id, params.id);
    if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

    const body = await req.json();
    const { role } = body;
    if (!['manager', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role (cannot promote to owner)' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('restaurant_members')
      .update({ role })
      .eq('id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — remove member
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const check = await requireOwner(supabase, user.id, params.id);
    if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

    const admin = createAdminClient();
    const { error } = await admin
      .from('restaurant_members')
      .delete()
      .eq('id', params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
