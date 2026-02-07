# Auth flow analysis: why login doesn’t get past the login page

## Current flow (what happens today)

1. **User submits login form**  
   - Client: `signInWithPassword({ email, password })` (Supabase browser client).  
   - On success, Supabase writes the session into **cookies** via `document.cookie` (createBrowserClient uses cookie storage by default).

2. **Client then does**  
   - `await new Promise(r => setTimeout(r, 100))`  
   - Creates a form with `method="POST"`, `action="/api/auth/redirect"`, and calls `form.submit()`.  
   - So the browser does a **full-page POST** to `/api/auth/redirect` (no fetch, no client-side router).

3. **Server: POST /api/auth/redirect**  
   - Builds a redirect response (303 to role home).  
   - Creates a Supabase **server** client that:  
     - **getAll**: reads cookies from the **incoming request**.  
     - **setAll**: writes cookies onto that **redirect response**.  
   - Calls `supabase.auth.getUser()`.  
   - If no user → redirect to `/login` (you end up stuck on login).  
   - If user → loads profile, redirects to role home (e.g. `/parent`) and returns that redirect response (with Set-Cookie from setAll).

4. **Browser follows 303**  
   - Sends **GET /parent** (or whatever role home).  
   - That request must include the **same cookies** (or new ones from the redirect response).

5. **Server: GET /parent**  
   - Middleware runs (session refresh).  
   - Layout runs: `requireRole("parent")` → `getAuthUserWithProfile()` → reads cookies via server Supabase client.  
   - If no user/profile → redirect to `/login` (again stuck on login).

So “cannot get past the login page” means either:

- **A)** POST /api/auth/redirect doesn’t see the user (so it sends you back to /login), or  
- **B)** POST /api/auth/redirect does redirect to /parent, but GET /parent doesn’t see the session (so the layout sends you back to /login).

---

## Why it might have worked before and doesn’t now

1. **Cookies not on the POST request (A)**  
   - After `signInWithPassword`, the browser client writes cookies via `storage.setItem` (async in the API).  
   - We then wait 100ms and do `form.submit()`.  
   - If the cookie write isn’t finished or visible to the next request yet, the POST to `/api/auth/redirect` can be sent **without** auth cookies.  
   - Then the route handler’s `getUser()` sees no session → redirect to `/login`.  
   - So a **race** between “session written to cookies” and “form submit” could explain “worked before, doesn’t now” (e.g. slower env, different browser, or Supabase/client version).

2. **Cookies not on the GET /parent request (B)**  
   - The redirect response from POST /api/auth/redirect must include **Set-Cookie** so the browser has the session (or refreshed tokens) for the next request.  
   - We fixed “return the same response we passed to setAll” so we don’t return a *new* redirect without cookies.  
   - If something still prevents Set-Cookie from being sent (e.g. copying to the wrong response, or middleware overwriting the response), then GET /parent would be sent without (or with stale) cookies → layout redirects to `/login`.

3. **Middleware vs route handler response**  
   - Middleware runs for `/api/auth/redirect` and can refresh the session and set cookies on **its** response (`NextResponse.next()`).  
   - The **final** response to the client is the **route handler’s** 303.  
   - In Next.js, the route handler’s response typically wins; middleware’s Set-Cookie might not be merged.  
   - So we **must** set cookies on the **redirect response** in the route handler (which we do). If that response ever didn’t carry Set-Cookie (e.g. before the “same response” fix, or a bug when copying to a second redirect), that would cause (B).

4. **getUser() vs getSession()**  
   - We use `getUser()` everywhere (validates JWT with Supabase).  
   - If there’s a transient network/error on that validation, we’d treat it as “no user” and redirect to login.  
   - Unlikely to be the main cause but can add flakiness.

---

## Recommended fix: go to /welcome after sign-in (no POST redirect)

Right now we do:

- Sign in → POST /api/auth/redirect → server reads cookies, redirects to role home.

A more robust approach:

- Sign in → **navigate to /welcome** (same origin).  
- **GET /welcome** runs on the server; it already calls `getAuthUserWithProfile()` and redirects to the role home.  
- We don’t depend on cookies being present on a POST 100ms after sign-in; we depend on cookies on the **next** GET, which the browser will send after the client has updated the session (and we can optionally wait a tick so the cookie write is committed).

Benefits:

- Single place that “decides” where to go after login: `/welcome`.  
- No extra POST or redirect API for the happy path.  
- Server only needs to read cookies on GET /welcome (and then GET /parent), which is the usual pattern for cookie-based auth.

Implementation:

- In the login form, on successful `signInWithPassword`:  
  - Option 1: `window.location.href = "/welcome"` (full page load; guarantees cookies on the next request).  
  - Option 2: After a short delay (e.g. 150–200ms) or after confirming the session is in storage, `router.push("/welcome")` and `router.refresh()` so the server sees the updated cookies on the next RSC request.

If we still see “cannot get past login”, then the problem is purely “cookies not visible on the first GET after sign-in” (e.g. cookie path, SameSite, or timing), and we can debug that separately (e.g. log cookies in middleware for GET /welcome and GET /parent).
