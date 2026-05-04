# Tablo v2 — Multi-tenant Restaurant OS

> Hospitality, orchestrated. The operating system for modern restaurants.

This is **Tablo v2** — adds authentication and multi-tenancy on top of the v1 MVP. Restaurant owners now sign in with email magic links and only see their own restaurant's data.

## What's in v2

Everything from v1, **plus**:

- 🔒 **Email magic-link auth** via Supabase Auth — no passwords
- 🏢 **Multi-tenant data model** — `restaurant_members` table links users to restaurants with roles (`owner`, `manager`, `staff`)
- 🛡️ **Row Level Security policies** — database refuses to return data a user shouldn't see, even if they bypass the UI
- 🚪 **Protected `/admin` routes** — middleware redirects unauthenticated users to `/login`
- 👋 **Login page + AdminHeader with sign-out** — clean Tablo-branded auth flow

## What's still in v2 from v1

- **Guest ordering** at `/r/[slug]/t/[table]` — public, unauthenticated (guests scan QR)
- **Kitchen display** at `/kitchen/[slug]` — public for now (will get device PIN in v3)
- **Admin orders, menu, QR codes** — now all gated by auth + membership check

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database & Auth | Supabase (PostgreSQL + Auth + Realtime) |
| Auth helpers | `@supabase/ssr` (cookie-based SSR session) |
| Styling | Tailwind CSS |
| QR generation | `qrcode` |
| Hosting | Vercel |

## Project structure

```
tablo/
├── middleware.ts              # NEW: auth cookie refresh + /admin route guard
├── app/
│   ├── login/                 # NEW: magic-link login page
│   ├── auth/
│   │   ├── callback/route.ts  # NEW: handles magic link click
│   │   └── signout/route.ts   # NEW: sign out endpoint
│   ├── admin/                 # UPDATED: now requires auth, scopes by user
│   ├── r/[slug]/t/[table]/    # public guest ordering
│   ├── kitchen/[slug]/        # public kitchen display
│   └── api/orders/            # public order API (uses service role)
├── components/
│   └── AdminHeader.tsx        # NEW: shared header with user info & signout
├── lib/
│   ├── supabase.ts            # browser + admin clients
│   ├── supabase-server.ts     # NEW: server client with cookie session
│   └── types.ts
└── supabase/
    ├── schema.sql             # base schema (run first)
    ├── seed.sql               # demo restaurant (run second)
    └── auth_migration.sql     # NEW: members table + RLS (run third)
```

## Getting started

See **`DEPLOYMENT.md`** for the complete step-by-step guide.

## Roadmap

- ✅ v1: QR ordering, kitchen, admin
- ✅ **v2: Auth + multi-tenant (you are here)**
- ⬜ v3: Razorpay payments at end of meal
- ⬜ v3: Menu editing UI
- ⬜ v4: Invite flow (owners invite staff)
- ⬜ v4: Reservations
- ⬜ v5: Guest CRM / memory engine
