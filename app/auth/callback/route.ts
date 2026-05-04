import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Read 'next' from URL OR from cookie (fallback if Supabase stripped query params)
  let next = searchParams.get('next');
  if (!next) {
    next = cookies().get('tablo_login_redirect')?.value ?? null;
  }

  if (code) {
    const supabase = createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Clear the cookie after using it
      const response = NextResponse.redirect(`${origin}${next ?? '/admin'}`);
      response.cookies.delete('tablo_login_redirect');
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
