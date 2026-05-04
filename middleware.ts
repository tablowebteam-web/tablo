import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        }
      }
    }
  );

  // Refresh session if it exists
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Restaurant owner /admin routes — must be authenticated
  if (path.startsWith('/admin') && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  // Customer-only routes — must be authenticated
  if (path.startsWith('/me') && !user) {
    const loginUrl = new URL('/customer-login', request.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  // If user is logged in and visits /login, send to /admin (owner flow)
  if (path === '/login' && user) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // If user is logged in and visits /customer-login, send to /me (customer flow)
  if (path === '/customer-login' && user) {
    return NextResponse.redirect(new URL('/me', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};
