import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser client — for use in 'use client' components
export function createBrowserSupabase() {
  return createBrowserClient(url, anonKey);
}

// Default browser export — singleton, used by existing client components
export const supabase = createBrowserSupabase();

// Admin client — uses service role, bypasses RLS.
// Only call from API routes / server code with the service key in env.
// (Safe to live here since it isn't called at module load.)
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
}
