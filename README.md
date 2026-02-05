# Homegrown

Next.js (App Router) + Supabase app: parent/player account switching, coach schedule booking, and private storage with signed URLs.

## Supabase setup

### Where to find your keys

1. Open [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project (or create one).
3. Go to **Project Settings** → **API**.
4. Use:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   (Use the anon key only; never put the `service_role` key in client or public env.)

### Environment variables

1. Copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```
2. Edit `.env.local` and set (or keep the example values if using the same project):
   - `NEXT_PUBLIC_SUPABASE_URL` – your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` – your anon public key

`.env.local` is gitignored; never commit it. Only `NEXT_PUBLIC_*` vars are exposed to the browser; no secrets should be in those.

### Verify connection and session

1. Start the app (see **Run locally** below).
2. Open **http://localhost:3000/debug/supabase** in the browser.
3. You should see:
   - **Session**: “No session” when logged out, or the logged-in user email when signed in.
   - **DB check**: A message indicating whether a lightweight `profiles` query succeeded or was blocked (e.g. by RLS).

At runtime (e.g. `npm run dev` or `npm run start`), if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, the app throws a clear error. During `next build`, placeholders are used so CI can build without `.env.local`.

## Run locally

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local if needed
npm run dev
```

Then open **http://localhost:3000** (and **http://localhost:3000/debug/supabase** to verify Supabase + session).

**Important:** Use the URL printed by `npm run dev` (e.g. `Local: http://localhost:3000`). If you see "Port 3000 is in use, trying 3001 instead", open **http://localhost:3001** (or whatever port it shows). To run on a specific port (e.g. 3006), use `npm run dev:3006`. Opening a different port than the one the dev server is on will cause 404s for pages and assets.

### If you get `GET /login 404` or repeated "check @ login" errors

1. **Use the same port as the dev server** – If you open `http://localhost:3006/login` but the terminal says `Local: http://localhost:3000`, the request goes to the wrong process and returns 404. Either run `npm run dev:3006` and then open 3006, or use the port shown by `npm run dev`.
2. **Browser extensions** – Some password managers or form-filler extensions poll `/login` and can trigger 404s if the app isn’t on that port. Try an incognito window with extensions disabled, or ignore those console errors if the page itself loads.

### If you get 404 for `/_next/static/*` or "This page could not be found"

This usually means the browser is **not** talking to the Next.js **dev** server (e.g. another process is on that port, or you ran `next start` without building).

1. **Stop everything on port 3000**  
   In a terminal (no need to be in the project):
   - **macOS/Linux:** `lsof -ti:3000 | xargs kill -9`
   - **Windows (PowerShell):** `Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force`
2. **Start the dev server from the project folder:**
   ```bash
   cd /path/to/homegrown-next-js
   npm run dev:clean
   ```
   (`dev:clean` clears the `.next` cache and runs `next dev`.)
3. **Use only the URL printed** – e.g. `Local: http://localhost:3000`. Open that in a **new tab** (or incognito). Do not use `http://localhost:3001` if the terminal says 3000.
4. **Never use `npm run start` for development** – that is for production. Use `npm run dev` or `npm run dev:clean`. If you use `start`, run `npm run build` first.

### "EMFILE: too many open files"

If the dev server shows many `EMFILE` or `Watchpack` errors, your system’s file descriptor limit may be too low. On macOS you can raise it for the session: `ulimit -n 10240` then run `npm run dev` again in the same terminal.

## App setup (tables, RPC, storage)

1. Apply migrations (creates `profiles` and trigger + RLS, plus booking RPC):
   ```bash
   supabase db push
   ```
   Or run in the SQL editor **in this order**:
   - `supabase/migrations/20250130000000_profiles_table.sql` – creates `profiles` table
   - `supabase/migrations/20250131000001_profiles_trigger_and_rls.sql` – profile bootstrap trigger + RLS
   - `supabase/migrations/20250131000000_book_individual_session.sql` – booking RPC

2. Other requirements:
   - Tables: `parent_player_relationships`, `coach_availability`, `individual_session_bookings`, `session_types`, `group_reservations`, `group_sessions`
   - Storage bucket `avatars` (private). Optionally `team-logos` (public).

## Role-based routing

- **Roles**: `parent`, `player`, `coach`, `admin`. Every auth user has a `profiles` row (created by trigger on signup; default role `parent`).
- **Role homes** (primary after login):
  - Parent → `/parent`
  - Player → `/player`
  - Coach → `/coach`
  - Admin → `/admin`
- **Flow**: Login/signup redirects to `/welcome`, which reads `profile.role` and redirects to the role home. Each role layout guards its route: unauthenticated → `/login`; wrong role → redirect to that user’s role home.
- **Optional**: `/dashboard` remains available to authenticated users (shared dashboard, bookings, profile). Role-specific nav is in each role layout; parent layout includes the account switcher.

## Features

- **Auth**: Login/signup; profile and role loaded after login.
- **Account switcher**: Linked players from `parent_player_relationships`; active player in cookie + client state; `getActivePlayerIdServer()` / `getActivePlayerIdClient()`.
- **Data helpers**: `getLinkedPlayers`, `getPlayerDashboard`, `getUpcomingGroupReservations`, `getUpcomingIndividualBookings`.
- **Booking**: RPC `book_individual_session` (lock slot, validate, insert booking, set `is_available=false`). UI at `/schedule/[coachId]`.
- **Storage**: `POST /api/media/signed` with `{ bucket, path[] }`; access validated via parent/player ownership; returns signed URLs.
- **Pages**: `/dashboard`, `/dashboard/player`, `/dashboard/bookings`, `/dashboard/profile` (photo upload uses signed URL flow).

## Supabase clients (no secrets to client)

- **Browser**: `src/lib/supabase/client.ts` uses `createBrowserClient` from `@supabase/ssr`; only `NEXT_PUBLIC_*` env vars are used.
- **Server**: `src/lib/supabase/server.ts` uses `createServerClient` from `@supabase/ssr` with `next/headers` cookies and exports `createSupabaseServerClient()` so auth session works in Server Components and route handlers.
- **Re-exports**: `lib/supabase/client.ts` and `lib/supabase/server.ts` re-export from `src/lib/supabase/` so existing `@/lib/supabase/*` imports keep working.
