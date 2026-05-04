import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase';
import { calculateBestOffer, type OfferConfig, type CustomerContext } from '@/lib/discounts';

// GET /api/offer-preview?restaurantId=xxx&subtotal=1500
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ offer: null }); // not logged in = no offer preview

    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    const subtotal = Number(searchParams.get('subtotal') ?? 0);
    if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 });

    const admin = createAdminClient();

    // Get the customer profile linked to this auth user
    const { data: profile } = await admin
      .from('customer_profiles')
      .select('id, birthday, anniversary')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ offer: null });

    // Visit count
    const { count: visitCount } = await admin
      .from('customer_visits')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', profile.id)
      .eq('restaurant_id', restaurantId);

    // Offers
    const { data: offers } = await admin
      .from('restaurant_offers')
      .select('offer_type, enabled, discount_kind, discount_value, description')
      .eq('restaurant_id', restaurantId);

    if (!offers || offers.length === 0) return NextResponse.json({ offer: null });

    const customer: CustomerContext = {
      birthday: profile.birthday,
      anniversary: profile.anniversary,
      visitCount: visitCount ?? 0
    };

    // For preview, use a fake subtotal of ₹1000 if none provided (we just want to show eligibility)
    const previewSubtotal = subtotal > 0 ? subtotal : 1000;
    const best = calculateBestOffer(previewSubtotal, customer, offers as OfferConfig[]);

    return NextResponse.json({ offer: best, visitCount: visitCount ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
