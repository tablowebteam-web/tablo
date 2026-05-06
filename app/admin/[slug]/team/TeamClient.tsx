'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Restaurant } from '@/lib/types';

interface Member {
  id: string;
  role: 'owner' | 'manager' | 'staff';
  user_id: string | null;
  email: string;
  invited_email: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  is_pending: boolean;
}

const ROLE_INFO: Record<string, { label: string; description: string; color: string }> = {
  owner: {
    label: 'Owner',
    description: 'Full access. Can manage team, billing, and all settings.',
    color: 'bg-forest text-white'
  },
  manager: {
    label: 'Manager',
    description: 'Can manage menu, offers, reservations, payments, and orders. Cannot manage team.',
    color: 'bg-blue-100 text-blue-800'
  },
  staff: {
    label: 'Staff',
    description: 'Can view orders, mark them ready, take walk-in orders. Cannot edit menu or settings.',
    color: 'bg-cream text-charcoal'
  }
};

export default function TeamClient({
  restaurant,
  members: initialMembers,
  myRole,
  myUserId
}: {
  restaurant: Restaurant;
  members: Member[];
  myRole: string;
  myUserId: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff'>('staff');
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isOwner = myRole === 'owner';

  function show(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function refreshMembers() {
    const res = await fetch(`/api/team?restaurantId=${restaurant.id}`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
    }
  }

  async function invite() {
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    setError(null);

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole
        })
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error ?? 'Invite failed');
        setInviting(false);
        return;
      }

      setInviteEmail('');
      setInviteRole('staff');
      await refreshMembers();
      show('Invitation sent ✓');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(memberId: string, newRole: string) {
    if (busy) return;
    setBusy(memberId);
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert('Failed: ' + (e.error ?? 'unknown'));
        return;
      }
      await refreshMembers();
      show('Role updated ✓');
    } catch (e: any) {
      alert('Network error: ' + e.message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(memberId: string, name: string) {
    if (busy) return;
    if (!confirm(`Remove ${name} from the team?`)) return;
    setBusy(memberId);
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: 'DELETE' });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert('Failed: ' + (e.error ?? 'unknown'));
        return;
      }
      await refreshMembers();
      show('Member removed ✓');
    } catch (e: any) {
      alert('Network error: ' + e.message);
    } finally {
      setBusy(null);
    }
  }

  // Sort: owners first, then managers, then staff, with pending at the bottom
  const sortedMembers = [...members].sort((a, b) => {
    if (a.is_pending !== b.is_pending) return a.is_pending ? 1 : -1;
    const roleOrder: Record<string, number> = { owner: 0, manager: 1, staff: 2 };
    return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
  });

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="mb-5">
        <Link href="/admin" className="text-xs text-charcoal/60">← All restaurants</Link>
        <h1 className="font-serif text-3xl mt-1">{restaurant.name} · Team</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Manage who can access this restaurant in Tablo.
        </p>
      </header>

      {!isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900 mb-5">
          🔒 Only owners can invite or remove team members. You can view the team here.
        </div>
      )}

      {/* INVITE FORM */}
      {isOwner && (
        <div className="bg-white border border-charcoal/10 rounded-lg p-5 mb-5">
          <h2 className="font-serif text-lg mb-1">Invite a team member</h2>
          <p className="text-xs text-charcoal/60 mb-4">
            They'll get access when they sign in with this email at <code className="bg-charcoal/5 px-1 rounded">/login</code>.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="manager@yourrestaurant.com"
              className="flex-1 px-3 py-2 border border-charcoal/15 rounded-md text-sm focus:outline-none focus:border-forest"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'manager' | 'staff')}
              className="px-3 py-2 border border-charcoal/15 rounded-md text-sm bg-white focus:outline-none focus:border-forest"
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
            <button
              onClick={invite}
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 bg-forest text-white text-sm rounded-md hover:bg-forest/90 disabled:opacity-50 font-medium"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mt-3">{error}</div>
          )}

          <div className="text-[11px] text-charcoal/50 mt-3">
            💡 The invite is by email only — no email is actually sent. Just tell them the email & ask them to sign in to <strong>tablo</strong>.
          </div>
        </div>
      )}

      {/* MEMBERS LIST */}
      <div className="bg-white border border-charcoal/10 rounded-lg overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-charcoal/10">
          <h2 className="font-serif text-lg">Team ({members.length})</h2>
        </div>

        {sortedMembers.map(m => {
          const isMe = m.user_id === myUserId;
          const isProtectedOwner = m.role === 'owner';
          const canEdit = isOwner && !isMe && !isProtectedOwner;

          return (
            <div key={m.id} className={`p-4 border-b border-charcoal/10 last:border-b-0 ${m.is_pending ? 'bg-amber-50/30' : ''}`}>
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{m.email}</span>
                    {isMe && <span className="text-[10px] bg-charcoal/10 text-charcoal/70 px-2 py-0.5 rounded">YOU</span>}
                    {m.is_pending && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded uppercase tracking-wide">⏳ Pending</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-medium ${ROLE_INFO[m.role]?.color ?? ''}`}>
                      {ROLE_INFO[m.role]?.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-charcoal/50 mt-1">
                    {ROLE_INFO[m.role]?.description}
                  </div>
                  <div className="text-[10px] text-charcoal/40 mt-1">
                    {m.is_pending
                      ? `Invited ${new Date(m.invited_at ?? m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                      : `Joined ${new Date(m.accepted_at ?? m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    }
                  </div>
                </div>

                {canEdit && (
                  <div className="flex gap-2 shrink-0 items-start">
                    <select
                      value={m.role}
                      onChange={e => changeRole(m.id, e.target.value)}
                      disabled={busy === m.id}
                      className="px-2 py-1 text-xs border border-charcoal/20 rounded bg-white"
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button
                      onClick={() => remove(m.id, m.email)}
                      disabled={busy === m.id}
                      className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ROLE EXPLANATION */}
      <div className="bg-charcoal/5 rounded-lg p-4 text-xs text-charcoal/70">
        <h3 className="font-medium text-charcoal mb-2">What each role can do:</h3>
        <ul className="space-y-1.5">
          {Object.entries(ROLE_INFO).map(([key, info]) => (
            <li key={key}>
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-medium mr-2 ${info.color}`}>{info.label}</span>
              <span>{info.description}</span>
            </li>
          ))}
        </ul>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-charcoal text-white px-4 py-2 rounded-md text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
