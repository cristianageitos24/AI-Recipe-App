# Authentication (HomeRecipe)

HomeRecipe uses **Clerk** for authentication. This document describes how sessions work in this app, how cookies are handled, and how developers should maintain the system.

**Stack versions (locked for this design):** Next.js `16.1.6`, `@clerk/nextjs` `6.37.1`. Request proxy lives in `proxy.ts` (Next.js App Router convention used by this project).

## Principles

- Clerk is the **only** authentication cookie authority.
- This application **does not** manually create, modify, or clear Clerk authentication cookies (no `cookies().set()` for auth sessions).
- Do **not** add Auth.js / NextAuth, Supabase Auth session cookies, or `@supabase/ssr` auth session refresh for login.
- Never store passwords or sensitive profile fields in cookies. Session material is limited to Clerk’s signed session tokens / identifiers.

## Authentication flow

```text
Browser → Clerk SignIn/SignUp UI
       → Clerk creates/rotates session cookies (Clerk-owned)
       → Redirect to /dashboard/home
       → proxy.ts (clerkMiddleware) validates session on protected routes
       → Server Components / Actions / Route Handlers call auth helpers
       → Supabase server client attaches a Clerk-issued JWT as accessToken for RLS
```

Identity for app authorization is the Clerk `userId` (`user_…`). Database rows that are user-owned store that id (for example `recipes.user_id`).

## How cookies are created and validated

### Ownership

- **Clerk** owns, creates, rotates, validates, and clears all authentication cookies.
- Our Next.js code reads the validated session through Clerk’s SDK (`auth()`, `currentUser()`, `clerkMiddleware`), via helpers in `lib/auth.ts`.
- We do **not** invent a parallel app session cookie.

### What is stored

- Clerk uses **short-lived signed session tokens** and validates them through its SDK.
- Cookies hold session material managed by Clerk — not passwords, not raw credentials, and not arbitrary PII we write ourselves.

### Cookie attributes (Clerk-controlled)

- Cookie names, flags, path, and **session expiration** are controlled by **Clerk and the Clerk Dashboard / environment settings**, not by application `Set-Cookie` code.
- Clerk currently uses **`SameSite=Lax`** for session cookies.
- **Do not claim that all Clerk cookies are HttpOnly.** Clerk manages multiple cookies; current Clerk documentation indicates that the primary `__session` cookie may be readable by the client-side SDK. Do not modify Clerk cookie attributes in this codebase or make unsupported claims about them.
- Production deployments should use HTTPS so Clerk can apply its production cookie security posture (including Secure where Clerk configures it).

### Application code must not

- Call Next.js `cookies().set` / `delete` for authentication sessions.
- Mirror Clerk’s session into a custom cookie.
- Add Supabase `sb-*-auth-token` cookie refresh in `proxy.ts`.

## Login flow

1. User visits `/signin` or `/signup` (`app/(auth)/…` + `ClientSignIn` / `ClientSignUp`).
2. Clerk UI authenticates the user (password, OAuth, etc. as configured in Clerk).
3. Clerk sets/updates its authentication cookies on the response.
4. Client is redirected to `/dashboard/home` (`forceRedirectUrl` on the components; align env URLs with `.env.local.example`).
5. `proxy.ts` allows the dashboard request because `clerkMiddleware` sees a valid session.

Relevant files:

- `components/ClientSignIn.tsx`, `components/ClientSignUp.tsx`
- `app/layout.tsx` — `ClerkProvider` (`signInUrl`, `signUpUrl`, `afterSignOutUrl`)
- `proxy.ts` — root `/` → `/signin`; signed-in users on auth routes → `/dashboard/home`

## Logout flow

1. User signs out through Clerk UI (for example `UserButton` in `ClerkAccountMenu`).
2. Clerk clears/invalidates its authentication cookies and session.
3. `ClerkProvider` `afterSignOutUrl="/"` runs; `proxy.ts` then redirects `/` to `/signin`.

Do not implement a custom “clear auth cookie” server action unless Clerk’s documented sign-out APIs are insufficient for a specific product need.

## Session validation

Central helpers live in **`lib/auth.ts`**:

| Helper | Use when |
| --- | --- |
| `getAuthUserId()` | Need `userId \| null` without forcing a single error shape (most Server Actions, optional auth). |
| `requireAuthUserIdOrRedirect()` | Server Components / layouts should send unauthenticated users to `/signin`. |
| `requireAuthUserIdForApi()` | Route Handlers should return HTTP **401** JSON `{ error: "Unauthorized" }`. |

Expired or invalid Clerk sessions surface as a missing `userId` from `auth()`. Callers then redirect or return their existing unauthorized responses.

### Existing unauthorized patterns (preserve them)

Do not force every caller into one return type:

1. **Server Actions** — typically `{ error: "Unauthorized" }` with optional `data` / `url`, or `{ ok: false, reason: "forbidden" }` for trash-style results. Premium planning actions use `requirePremiumPlanningAccess()` in `lib/premium-access.ts`.
2. **Route Handlers** — `401` via `requireAuthUserIdForApi()`.
3. **Layouts / pages** — `requireAuthUserIdOrRedirect()` (or equivalent redirect to `/signin`).

`getHomeBootstrap` intentionally allows a null `userId` and degrades gracefully; it uses `getAuthUserId()` without failing closed at the bootstrap layer (child actions still enforce auth where required).

## Protected routes

| Layer | Behavior |
| --- | --- |
| `proxy.ts` | `auth.protect()` on `/dashboard(.*)`. Auth pages redirect if already signed in. |
| `app/dashboard/layout.tsx` | `requireAuthUserIdOrRedirect()` defense in depth. |
| Dashboard pages (e.g. billing, settings) | Same redirect helper where they previously checked `auth()`. |
| `app/actions/*` | `getAuthUserId()` + existing error objects. |
| `app/api/**` (except public webhooks) | `requireAuthUserIdForApi()`. |
| Stripe webhook | Verifies Stripe signatures — not Clerk session cookies. |

## Supabase and RLS

- Server client: `utils/supabase/server.ts` uses `@supabase/supabase-js` with `accessToken` from Clerk `getToken`.
- Browser helper: `utils/supabase/client.ts` uses `createBrowserClient` from `@supabase/ssr` for browser usage only — **not** as the app’s auth session store.
- **Technical debt:** the server still prefers a Clerk **JWT template** (`supabase` / `CLERK_SUPABASE_JWT_TEMPLATE`). Supabase documents the JWT-template integration as **deprecated**. Prefer migrating later to [Third-Party Auth with Clerk](https://supabase.com/docs/guides/auth/third-party/clerk) and Clerk **session tokens**. Until then, keep the working template path; do not describe JWT templates as the preferred long-term architecture.
- Service-role client bypasses RLS — server/scripts only; never expose the secret key to the browser.

## Security considerations

- Single auth system (Clerk) avoids dual-session bugs and cookie confusion.
- Validate on the edge (`proxy.ts`), in layouts, and again in mutations/APIs.
- Treat missing `userId` as unauthenticated (expired/invalid session).
- Keep `SUPABASE_SECRET_KEY` / service role keys server-only.
- Align local env with `.env.local.example` (`NEXT_PUBLIC_CLERK_SIGN_IN_URL=/signin`, force redirects to `/dashboard/home`). If a developer’s `.env.local` still has `SIGN_IN_URL=/` or redirects to `/dashboard`, update it locally — do not commit secrets.

## How to maintain this system

1. **New Server Action** — `const userId = await getAuthUserId();` then return the same unauthorized shape as sibling actions.
2. **New Route Handler** — `requireAuthUserIdForApi()` and early-return `response` when present.
3. **New dashboard page** — rely on dashboard layout, or call `requireAuthUserIdOrRedirect()` if the page needs `userId` itself.
4. **Never** add a custom auth cookie “for simplicity.”
5. **Clerk Dashboard** — session lifetime, OAuth providers, and cookie-related settings are configured there.
6. **Supabase** — when migrating off JWT templates, update `utils/supabase/server.ts` and this doc together; keep RLS `sub` aligned with Clerk user ids.

## Related files

- `lib/auth.ts` — session helpers
- `proxy.ts` — Clerk middleware / route protection
- `app/layout.tsx` — `ClerkProvider`
- `utils/supabase/server.ts` — Clerk JWT → Supabase
- `supabase/README.md` — database + Clerk/Supabase bridge notes
- `.env.local.example` — expected Clerk URL env vars
