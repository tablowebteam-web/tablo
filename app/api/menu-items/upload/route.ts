import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const menuItemId = formData.get('menuItemId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!menuItemId) return NextResponse.json({ error: 'No menu item id' }, { status: 400 });

    // Size check (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    // MIME check
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, WebP, or GIF.' }, { status: 400 });
    }

    // Look up the menu item to get its restaurant_id
    const { data: item } = await supabase
      .from('menu_items')
      .select('id, restaurant_id, image_url')
      .eq('id', menuItemId)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });

    // Verify membership
    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', item.restaurant_id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    // Use the admin client for upload (RLS on storage is permissive but server upload is more reliable)
    const admin = createAdminClient();

    // Path: {restaurant_id}/{menu_item_id}-{timestamp}.{ext}
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${item.id}-${Date.now()}.${ext}`;
    const path = `${item.restaurant_id}/${filename}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await admin.storage
      .from('menu-photos')
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadErr) {
      return NextResponse.json({ error: 'Upload failed: ' + uploadErr.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage.from('menu-photos').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Update menu_item with new image URL
    const { data: updated, error: updateErr } = await admin
      .from('menu_items')
      .update({ image_url: publicUrl })
      .eq('id', item.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Try to delete old photo (best-effort, don't fail the request if delete fails)
    if (item.image_url) {
      try {
        // Extract path from old URL (everything after /menu-photos/)
        const oldPath = item.image_url.split('/menu-photos/')[1];
        if (oldPath) {
          await admin.storage.from('menu-photos').remove([oldPath]);
        }
      } catch {
        // Ignore — old file might not exist
      }
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Upload error' }, { status: 500 });
  }
}

// DELETE — remove the photo from a menu item
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const menuItemId = searchParams.get('menuItemId');
    if (!menuItemId) return NextResponse.json({ error: 'No menu item id' }, { status: 400 });

    const { data: item } = await supabase
      .from('menu_items')
      .select('id, restaurant_id, image_url')
      .eq('id', menuItemId)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('restaurant_id', item.restaurant_id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const admin = createAdminClient();

    // Delete file from storage
    if (item.image_url) {
      const oldPath = item.image_url.split('/menu-photos/')[1];
      if (oldPath) {
        await admin.storage.from('menu-photos').remove([oldPath]);
      }
    }

    // Clear image_url on menu item
    const { data: updated, error } = await admin
      .from('menu_items')
      .update({ image_url: null })
      .eq('id', item.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Delete error' }, { status: 500 });
  }
}
