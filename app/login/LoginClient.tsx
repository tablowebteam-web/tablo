'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

export default function LoginClient() {
  const params = useSearchParams();
  const next = params.get('next') ?? '/admin';

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    // Store destination in cookie (Supabase sometimes strips query params)
    document.cookie = `tablo_login_redirect=${encodeURIComponent(next)}; path=/; max-age=3600; samesite=lax`;

    const supabase = createBrowserSupabase();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo }
    });

    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-[#FBFAF7]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="26" fill="none" stroke="#0F6E56" strokeWidth="2"/>
              <path d="M 16 22 L 40 22" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M 28 22 L 28 40" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="28" cy="22" r="3" fill="#0F6E56"/>
            </svg>
            <span className="font-serif text-2xl">tablo</span>
          </Link>
          <p className="text-xs tracking-widest text-charcoal/50 mt-3">RESTAURANT ADMIN</p>
        </div>

        <div className="bg-white border border-charcoal/10 rounded-lg p-6 shadow-sm">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="font-serif text-xl mb-1">Check your inbox</h2>
              <p className="text-sm text-charcoal/60 leading-relaxed">
                We sent a magic link to<br/>
                <span className="font-medium text-charcoal">{email}</span>
              </p>
              <p className="text-xs text-charcoal/50 mt-4">Click the link to sign in. The link expires in 1 hour.</p>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-xs text-charcoal/60 hover:text-charcoal mt-4 underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-2xl mb-1">Welcome back</h1>
              <p className="text-sm text-charcoal/60 mb-5">Sign in to manage your restaurant.</p>

              <form onSubmit={handleSubmit}>
                <label className="block text-xs font-medium text-charcoal/70 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@restaurant.com"
                  required
                  className="w-full px-3 py-2.5 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest focus:ring-1 focus:ring-forest"
                />

                {error && (
                  <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !email.trim()}
                  className="w-full mt-4 bg-forest text-white py-2.5 rounded-md text-sm font-medium hover:bg-forest/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending magic link…' : 'Send magic link'}
                </button>
              </form>

              <p className="text-[11px] text-charcoal/50 mt-4 text-center leading-relaxed">
                No password needed. We'll email you a secure link to sign in.
              </p>
            </>
          )}
        </div>

        <p className="text-xs text-charcoal/50 text-center mt-6">
          Don't have an account?{' '}
          <a href="mailto:hello@tablo.app" className="underline hover:text-charcoal">Contact sales</a>
        </p>
      </div>
    </main>
  );
}
