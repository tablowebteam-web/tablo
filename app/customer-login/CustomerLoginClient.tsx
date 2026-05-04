'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

export default function CustomerLoginClient() {
  const params = useSearchParams();
  // 'next' is where to land after auth click. Default: profile page.
  const next = params.get('next') ?? '/me';

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    // Cookie 1: where to redirect after auth callback
    document.cookie = `tablo_login_redirect=${encodeURIComponent(next)}; path=/; max-age=3600; samesite=lax`;

    // Cookie 2: if next is a restaurant menu, set return_to so profile page knows where to send back
    if (next.startsWith('/r/')) {
      // Send user to profile first (with returnTo), so they can fill DOB/anniversary, then go back to menu
      const profileFlow = `/me?returnTo=${encodeURIComponent(next)}`;
      document.cookie = `tablo_login_redirect=${encodeURIComponent(profileFlow)}; path=/; max-age=3600; samesite=lax`;
      document.cookie = `tablo_return_to=${encodeURIComponent(next)}; path=/; max-age=3600; samesite=lax`;
    }

    const supabase = createBrowserSupabase();
    const finalNext = next.startsWith('/r/')
      ? `/me?returnTo=${encodeURIComponent(next)}`
      : next;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(finalNext)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo }
    });

    setSubmitting(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen bg-[#FBFAF7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="26" fill="none" stroke="#0F6E56" strokeWidth="2"/>
              <path d="M 16 22 L 40 22" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M 28 22 L 28 40" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="28" cy="22" r="3" fill="#0F6E56"/>
            </svg>
            <span className="font-serif text-2xl">tablo</span>
          </Link>
          <p className="text-xs tracking-widest text-charcoal/50 mt-2">FOR DINERS</p>
        </div>

        <div className="bg-white border border-charcoal/10 rounded-lg p-6 shadow-sm">
          {sent ? (
            <div className="text-center py-3">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="font-serif text-xl mb-1">Check your inbox</h2>
              <p className="text-sm text-charcoal/60">We sent a link to <strong className="text-charcoal">{email}</strong></p>
              <p className="text-xs text-charcoal/50 mt-3">Click the link to continue. Expires in 1 hour.</p>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-2xl mb-1">Welcome</h1>
              <p className="text-sm text-charcoal/60 mb-5">Sign in to save your favourites and unlock special offers.</p>

              <form onSubmit={handleSubmit}>
                <label className="block text-xs font-medium text-charcoal/70 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                  className="w-full px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                />
                {error && (
                  <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
                )}
                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className="w-full mt-4 bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Send magic link'}
                </button>
              </form>

              <p className="text-[11px] text-charcoal/50 mt-4 text-center">No password needed. We'll email you a secure link.</p>
            </>
          )}
        </div>

        <p className="text-xs text-charcoal/50 text-center mt-5">
          Looking to manage your restaurant?{' '}
          <Link href="/login" className="underline hover:text-charcoal">Sign in here</Link>
        </p>
      </div>
    </main>
  );
}
