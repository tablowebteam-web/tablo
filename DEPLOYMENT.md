# Tablo v2 — Deployment Guide

This guide covers everything from v1 (Supabase + Vercel deploy) **plus the new auth steps for v2**.

If you already have v1 running, jump to **"Upgrading from v1"** at the bottom.

---

## What's new in v2

- 🔒 **Authentication** — restaurant owners log in with email magic links (no passwords)
- 🏢 **Multi-tenant** — each user only sees their own restaurant's data
- 🛡️ **Row Level Security** — enforced at the database level, not just in the UI
- 👋 **Login page + sign-out** — clean Tablo-branded auth flow

---

## Part 1 — Supabase setup

### 1.1 Create the project (skip if you already have one)
1. Go to **https://supabase.com** → New Project → name it `tablo`.
2. Save the DB password. Pick the closest region.

### 1.2 Run the schemas in order

In **SQL Editor**, run these three files **in order**:

1. `supabase/schema.sql` — base tables (restaurants, menu, orders)
2. `supabase/seed.sql` — demo restaurant data
3. `supabase/auth_migration.sql` — **NEW in v2** — adds `restaurant_members` table and RLS policies

### 1.3 Configure auth provider

1. In Supabase, go to **Authentication → Providers**.
2. Make sure **Email** is enabled (it is by default).
3. **Disable "Confirm email"** for testing, or keep it on for production.

### 1.4 Configure redirect URLs

1. Go to **Authentication → URL Configuration**.
2. **Site URL**: set to your Vercel URL (e.g. `https://tablo-xxx.vercel.app`). Use `http://localhost:3000` for local dev.
3. **Redirect URLs**: add both
   - `http://localhost:3000/auth/callback`
   - `https://tablo-xxx.vercel.app/auth/callback`

This is **critical** — magic links won't work without it.

### 1.5 Get your API keys

**Settings → API**, copy:
- **Project URL**
- **anon public key**
- **service_role key** (keep secret)

---

## Part 2 — Deploy to Vercel

### 2.1 Push to GitHub
```bash
git init
git add .
git commit -m "Tablo v2: auth + multi-tenant"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/tablo.git
git push -u origin main
```

### 2.2 Import on Vercel
1. https://vercel.com → **Add New Project** → import your repo.
2. **Environment Variables** — add all four:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
| `NEXT_PUBLIC_APP_URL` | your Vercel URL |

3. Click **Deploy**.

### 2.3 Update redirect URLs after deploy

Once deployed, copy the real Vercel URL and **update Supabase Auth → URL Configuration** to include `https://your-real-url.vercel.app/auth/callback`.

---

## Part 3 — Create your first owner account

After deploying:

### 3.1 Sign up
1. Visit `https://your-vercel-url.vercel.app/login`.
2. Enter your email. Click **Send magic link**.
3. Check your email → click the link.
4. You'll land on `/admin` — but it'll show "No restaurants linked yet" with a SQL snippet.

### 3.2 Link yourself to the demo restaurant

In **Supabase SQL Editor**, run the snippet shown on the page (replace your email):

```sql
INSERT INTO restaurant_members (restaurant_id, user_id, role)
SELECT '11111111-1111-1111-1111-111111111111', id, 'owner'
FROM auth.users WHERE email = 'your@email.com';
```

### 3.3 Refresh `/admin`

You should now see "Sahiba Fine Dining" with a small `OWNER` badge. Click in — you have access to Menu, QR codes, and Orders.

---

## Part 4 — Test the auth flow

1. **Sign out** (top right of admin) → you go to `/login`.
2. Try to visit `/admin/sahiba/orders` directly while signed out → you get redirected to `/login?next=...`.
3. Sign back in → you land on the page you were trying to reach.
4. **Test isolation**: create a second user with a different email. Don't link them to any restaurant. Sign in as them — they see the empty state with the SQL hint.

---

## Upgrading from v1

If you already deployed v1, you only need three things to upgrade:

1. **Pull v2 code** into your repo (overwrite all files).
2. **Run `supabase/auth_migration.sql`** in your Supabase SQL editor.
3. **Add redirect URLs** in Supabase Auth → URL Configuration.
4. Push and let Vercel auto-deploy.

After upgrade: visit `/admin` → you'll be redirected to `/login`. Sign up, then run the linking SQL from Part 3.2.

---

## Architecture notes

**Why magic links over passwords?**
- No passwords to remember, leak, or reset.
- Lower support burden for fine-dining owners (mostly non-technical).
- Standard for modern B2B SaaS (Notion, Linear, Vercel all use this).

**Why RLS instead of just checking in the UI?**
- Defense in depth. Even if someone bypasses the UI (curl to API, browser dev tools), the database refuses to return data they don't own.
- One source of truth: the policy lives next to the data.

**The kitchen page is still public — is that okay?**
Yes, deliberately. The kitchen tablet runs on a fixed URL inside the restaurant; it would be annoying to have it sign out. In v3 we add an optional PIN code for the kitchen device. Production deployments can also restrict by IP/network.

**The guest ordering page is also public — is that intentional?**
Yes. Guests don't sign in — they scan a QR and order. The `qr_token` in the URL is the access token (in v3 we'll rotate these per session for additional security).

---

## Roadmap after v2

- v3: Razorpay payment flow at end of meal
- v3: Menu editing UI (add/edit/upload photos)
- v4: Invite flow — owners invite managers/staff via email
- v4: Reservations module
- v5: Guest CRM / memory engine
