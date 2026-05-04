import Link from 'next/link';
import type { User } from '@supabase/supabase-js';

export default function AdminHeader({ user }: { user: User }) {
  const initials = (user.email ?? 'U').slice(0, 2).toUpperCase();
  return (
    <header className="border-b border-charcoal/10 bg-white">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="26" fill="none" stroke="#0F6E56" strokeWidth="2"/>
            <path d="M 16 22 L 40 22" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M 28 22 L 28 40" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="28" cy="22" r="3" fill="#0F6E56"/>
          </svg>
          <span className="font-serif text-lg">tablo</span>
          <span className="text-[10px] tracking-[2px] text-charcoal/50 ml-1">ADMIN</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-cream text-forest flex items-center justify-center text-[11px] font-medium">
              {initials}
            </div>
            <span className="text-xs text-charcoal/70">{user.email}</span>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs text-charcoal/60 hover:text-charcoal px-2 py-1 rounded hover:bg-charcoal/5"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
