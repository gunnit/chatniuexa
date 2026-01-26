# Phase 1: Foundation & Authentication - Research

**Researched:** 2026-01-26
**Domain:** Supabase Auth + Next.js 15 + Multi-Tenant RLS
**Confidence:** HIGH

## Summary

This phase establishes the authentication foundation for a multi-tenant SaaS platform using Supabase Auth with Next.js 15 App Router. The research confirms that Supabase provides a robust, battle-tested authentication system with built-in Row-Level Security (RLS) for tenant isolation at the database level.

The recommended approach uses `@supabase/ssr` package for cookie-based authentication, which provides proper SSR support, session persistence across browser refresh, and secure token refresh via middleware. For multi-tenant isolation, the pattern of storing `tenant_id` in user `app_metadata` (NOT `user_metadata`) combined with RLS policies provides defense-in-depth security at the database level.

Key security insight: Always use `supabase.auth.getUser()` on the server side to validate sessions - never trust `getSession()` as it does not revalidate the JWT token with Supabase Auth servers. For performance-sensitive applications, the newer `getClaims()` method provides JWT validation via JWKS caching.

**Primary recommendation:** Use Supabase Auth with `@supabase/ssr` package, cookie-based sessions, middleware for token refresh, and RLS policies with `tenant_id` stored in `app_metadata` for multi-tenant isolation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.90.x | Supabase client library | Official client, handles all Supabase operations including auth, database, storage |
| `@supabase/ssr` | 0.8.x | SSR cookie handling | Replaces deprecated auth-helpers packages, provides `createBrowserClient` and `createServerClient` for proper cookie-based auth |
| `next` | 15.x | React framework | App Router with Server Components, Server Actions, middleware support |
| `jose` | 6.x | JWT handling | Lightweight JWT library for session encryption (recommended by Next.js docs) |
| `zod` | 3.x | Schema validation | Runtime validation for form inputs, prevents invalid data from reaching auth endpoints |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bcrypt` or `bcryptjs` | latest | Password hashing | Only if implementing custom password handling outside Supabase Auth |
| `iron-session` | 8.x | Alternative session encryption | If needing stateless session management beyond Supabase Auth |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Auth | Clerk | Clerk has better UI components and 10K free MAU, but adds another vendor. Supabase has 50K free MAU and integrates with RLS natively. |
| Supabase Auth | Auth.js/NextAuth | More flexible provider support, but requires more setup and loses native Supabase RLS integration |
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | auth-helpers is deprecated, migrate to ssr package |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr zod jose
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (auth)/              # Auth-related routes (grouped, no layout impact)
│   │   ├── login/
│   │   │   ├── page.tsx     # Login form UI
│   │   │   └── actions.ts   # Server Actions for login
│   │   ├── signup/
│   │   │   ├── page.tsx     # Signup form UI
│   │   │   └── actions.ts   # Server Actions for signup
│   │   └── auth/
│   │       └── confirm/
│   │           └── route.ts  # Email confirmation handler
│   ├── (dashboard)/         # Protected routes
│   │   ├── layout.tsx       # Validates session, redirects if not authed
│   │   └── page.tsx         # Dashboard home
│   └── api/                 # API routes if needed
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Browser client (createBrowserClient)
│   │   ├── server.ts        # Server client (createServerClient)
│   │   └── middleware.ts    # Session refresh logic (updateSession)
│   └── dal/                 # Data Access Layer
│       └── auth.ts          # verifySession, getUser functions
├── middleware.ts            # Root middleware, calls updateSession
└── types/
    └── database.ts          # Supabase generated types
```

### Pattern 1: Cookie-Based Session with Middleware Refresh

**What:** Store auth tokens in HTTP-only cookies, refresh automatically via middleware
**When to use:** All Next.js + Supabase Auth implementations
**Example:**

```typescript
// lib/supabase/server.ts
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - middleware will handle cookie writes
          }
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/client.ts
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/middleware.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // CRITICAL: Use getUser() not getSession() - getUser validates with Auth server
  await supabase.auth.getUser()

  return response
}
```

```typescript
// middleware.ts (root)
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Pattern 2: Data Access Layer (DAL) for Authorization

**What:** Centralize session verification and user fetching in a DAL
**When to use:** All protected pages and server actions
**Example:**

```typescript
// lib/dal/auth.ts
// Source: https://nextjs.org/docs/app/guides/authentication
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const verifySession = cache(async () => {
  const supabase = await createClient()

  // CRITICAL: Use getUser() - it validates the JWT with Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return {
    isAuth: true,
    userId: user.id,
    tenantId: user.app_metadata?.tenant_id // For multi-tenant access
  }
})

export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
```

### Pattern 3: Multi-Tenant RLS with app_metadata

**What:** Store tenant_id in user's app_metadata, use in RLS policies
**When to use:** All multi-tenant data isolation
**Example:**

```sql
-- Source: https://roughlywritten.substack.com/p/supabase-multi-tenancy-simple-and

-- 1. Create helper function to extract tenant_id from JWT
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'),
    ''
  )::uuid
$$;

-- 2. Create tenants table
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Create tenant-scoped table with tenant_id
CREATE TABLE chatbots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE chatbots ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policy
CREATE POLICY "Users can only access their tenant's chatbots"
  ON chatbots
  FOR ALL
  USING (tenant_id = auth.tenant_id());

-- 6. Index for performance (CRITICAL)
CREATE INDEX idx_chatbots_tenant_id ON chatbots(tenant_id);
```

```typescript
// Setting tenant_id during signup (Server Action)
// Source: https://roughlywritten.substack.com/p/supabase-multi-tenancy-simple-and
export async function signup(formData: FormData) {
  const supabase = await createClient()

  // First, create the tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name: formData.get('company_name') })
    .select()
    .single()

  if (tenantError) throw tenantError

  // Then signup with tenant_id in app_metadata
  // NOTE: app_metadata can only be set by service_role, not anon key
  // This requires using the admin API or a server-side function
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        // user_metadata is editable by user
        full_name: formData.get('full_name')
      }
    }
  })

  // Set app_metadata via admin API (requires service_role key)
  // This should be done in a secure server-side function
}
```

### Anti-Patterns to Avoid

- **Using `getSession()` on server:** Never use `supabase.auth.getSession()` in server code - it does not validate the JWT. Always use `getUser()`.
- **Storing tenant_id in user_metadata:** user_metadata can be modified by users. Always use `app_metadata` for tenant_id.
- **Checking auth in Layouts only:** Layouts don't re-render on navigation. Check auth close to data fetching.
- **Missing RLS on tenant tables:** Every table with tenant data MUST have RLS enabled and policies defined.
- **Forgetting tenant_id index:** RLS policies act like WHERE clauses. Always index `tenant_id`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | Supabase Auth handles it | bcrypt with proper salt rounds, secure storage |
| Session tokens | Custom JWT implementation | `@supabase/ssr` cookie handling | HTTP-only, secure, proper refresh logic |
| Email verification | Custom email service | Supabase Auth email templates | Rate limiting, template management, delivery |
| CSRF protection | Manual token management | Next.js Server Actions | Built-in CSRF tokens in form submissions |
| Multi-tenant isolation | Application-level filtering | PostgreSQL RLS policies | Database-enforced, can't bypass with SQL injection |
| Token refresh | Custom refresh logic | Middleware with `updateSession` | Handles edge cases, cookie coordination |

**Key insight:** Authentication is a solved problem with severe consequences for getting it wrong. Use Supabase Auth + RLS instead of custom solutions.

## Common Pitfalls

### Pitfall 1: Using getSession() Instead of getUser()

**What goes wrong:** Session appears valid but JWT was spoofed or tampered with
**Why it happens:** `getSession()` only checks JWT format/expiry, doesn't validate with Auth server
**How to avoid:** Always use `supabase.auth.getUser()` on the server
**Warning signs:** Using `getSession()` anywhere in server code, middleware, or API routes

### Pitfall 2: Missing RLS Policies on Tables

**What goes wrong:** Users can access other tenants' data via direct API calls
**Why it happens:** RLS not enabled, or policies not created after table creation
**How to avoid:** Enable RLS immediately when creating tables, create policies before inserting data
**Warning signs:** Tables without `ENABLE ROW LEVEL SECURITY`, missing policies in migrations

### Pitfall 3: Storing tenant_id in user_metadata

**What goes wrong:** Users can modify their tenant_id and access other tenants' data
**Why it happens:** `user_metadata` is editable by users, `app_metadata` requires service_role
**How to avoid:** Always store tenant_id in `app_metadata`, set via server-side admin API
**Warning signs:** Using `.auth.updateUser({ data: { tenant_id: ... } })` on client

### Pitfall 4: Not Handling Email Confirmation

**What goes wrong:** Users sign up but can't log in, or login works without email verification
**Why it happens:** Email confirmation enabled but no `/auth/confirm` route handler
**How to avoid:** Create route handler for `/auth/confirm` that exchanges token_hash for session
**Warning signs:** 404 errors when clicking confirmation email links

### Pitfall 5: Route Prefetching Before Auth Cookie Set

**What goes wrong:** Protected pages briefly show unauthenticated content
**Why it happens:** Next.js prefetches routes before browser processes auth cookies
**How to avoid:** Redirect to a single post-login page without prefetched links
**Warning signs:** Flashing unauthenticated content, race conditions after login

### Pitfall 6: Missing tenant_id Index

**What goes wrong:** Queries become slow as data grows, RLS policy evaluation takes seconds
**Why it happens:** RLS policies act as WHERE clauses, scanning full table without index
**How to avoid:** Always create index on `tenant_id` column for all tenant-scoped tables
**Warning signs:** Slow queries in production, pg_stat_statements showing seq scans

## Code Examples

### Email/Password Signup Server Action

```typescript
// app/(auth)/signup/actions.ts
// Source: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Name is required'),
})

export async function signup(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const validatedFields = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const { email, password, fullName } = validatedFields.data

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      data: {
        full_name: fullName,
      }
    }
  })

  if (error) {
    return { error: error.message }
  }

  // User needs to confirm email
  redirect('/signup/check-email')
}
```

### Email/Password Login Server Action

```typescript
// app/(auth)/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
```

### Email Confirmation Route Handler

```typescript
// app/(auth)/auth/confirm/route.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Return to error page with instructions
  return NextResponse.redirect(new URL('/auth/error', request.url))
}
```

### Protected Page with Session Verification

```typescript
// app/(dashboard)/page.tsx
import { verifySession } from '@/lib/dal/auth'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  // This redirects to /login if not authenticated
  const session = await verifySession()

  const supabase = await createClient()

  // RLS automatically filters to user's tenant
  const { data: chatbots } = await supabase
    .from('chatbots')
    .select('*')

  return (
    <div>
      <h1>Dashboard</h1>
      <p>User ID: {session.userId}</p>
      <p>Tenant ID: {session.tenantId}</p>
      {/* Render chatbots */}
    </div>
  )
}
```

### Logout Server Action

```typescript
// app/(auth)/logout/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Single package for all SSR frameworks |
| `getSession()` for server auth | `getUser()` for server auth | 2024-2025 | Security fix - getSession doesn't validate JWT |
| Local storage for tokens | HTTP-only cookies | 2023-2024 | XSS protection, SSR compatibility |
| `middleware.ts` | `proxy.ts` (Next.js 16+) | 2026 | Same functionality, new naming convention |
| Manual RLS policies | RLS with `app_metadata` tenant_id | Current best practice | Simplified multi-tenant isolation |

**Deprecated/outdated:**
- `@supabase/auth-helpers-*` packages: Replaced by `@supabase/ssr`
- `createMiddlewareClient`: Use `createServerClient` instead
- `supabase.auth.getSession()` on server: Use `getUser()` or `getClaims()` instead
- Storing tokens in localStorage: Use cookies via `@supabase/ssr`

## Open Questions

1. **Setting app_metadata during signup**
   - What we know: `app_metadata` can only be set via service_role key, not anon key
   - What's unclear: Best pattern for setting tenant_id - trigger, edge function, or admin API call
   - Recommendation: Use database trigger on user creation to set tenant_id, or dedicated server-side function with service_role

2. **getClaims() availability**
   - What we know: `getClaims()` is faster than `getUser()` for JWT validation (uses JWKS caching)
   - What's unclear: Not documented in all places yet, may require asymmetric JWT keys
   - Recommendation: Start with `getUser()`, evaluate `getClaims()` for performance optimization later

3. **SMTP configuration for production**
   - What we know: Supabase built-in email has 2 emails/hour rate limit
   - What's unclear: Best SMTP provider choice for this project
   - Recommendation: Use built-in for development, configure custom SMTP (Resend, SendGrid) before production

## Sources

### Primary (HIGH confidence)
- [Supabase Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) - Official SSR setup guide
- [Supabase Creating a Client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) - Client creation patterns
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) - RLS documentation
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) - Official patterns for App Router
- [Supabase User Management Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs) - Complete Next.js tutorial

### Secondary (MEDIUM confidence)
- [Supabase Multi-Tenancy Pattern](https://roughlywritten.substack.com/p/supabase-multi-tenancy-simple-and) - app_metadata tenant_id pattern
- [WorkOS Top 5 Auth Solutions 2026](https://workos.com/blog/top-authentication-solutions-nextjs-2026) - Auth ecosystem comparison
- [Next.js + Supabase Cookie-Based Auth 2025](https://the-shubham.medium.com/next-js-supabase-cookie-based-auth-workflow-the-best-auth-solution-2025-guide-f6738b4673c1) - Implementation walkthrough
- [Supabase Discussion: getUser vs getSession](https://github.com/orgs/supabase/discussions/28983) - Security clarification

### Package References
- [@supabase/ssr npm](https://www.npmjs.com/package/@supabase/ssr) - v0.8.x
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) - v2.90.x

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Supabase + Next.js documentation, verified packages
- Architecture patterns: HIGH - Official patterns from Supabase and Next.js docs
- Multi-tenant RLS: HIGH - Well-documented pattern, multiple verified sources
- Pitfalls: HIGH - Based on official warnings and community verified issues

**Research date:** 2026-01-26
**Valid until:** 30 days (stable, well-documented stack)

---

## Environment Variables Required

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Server-only, never expose to client
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # For email redirects
```

## Database Schema for Phase 1

```sql
-- Run in Supabase SQL Editor

-- 1. Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 4. Create user profiles table linked to auth.users
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  full_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 5. Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Create helper function to get tenant_id from JWT
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 7. RLS Policies for tenants
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_tenant_id());

-- 8. RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- 9. Create indexes for performance
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

-- 10. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```
