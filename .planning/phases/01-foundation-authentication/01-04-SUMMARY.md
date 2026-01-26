---
phase: 01-foundation-authentication
plan: 04
subsystem: auth
tags: [signup, registration, tenant-creation, email-confirmation, rollback, multi-tenant]

# Dependency graph
requires:
  - phase: 01-foundation-authentication/01-01
    provides: Supabase client utilities
  - phase: 01-foundation-authentication/01-02
    provides: Database types for tenants and profiles
  - phase: 01-foundation-authentication/01-03
    provides: Server-side Supabase client
provides:
  - Complete signup flow with tenant creation
  - Email confirmation handling
  - Full rollback on profile creation failure
affects: [01-05, 01-06, dashboard, onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns: [useActionState for form handling, admin client for privileged operations, transactional signup with rollback]

key-files:
  created:
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/signup/actions.ts
    - src/app/(auth)/signup/check-email/page.tsx
    - src/app/(auth)/auth/confirm/route.ts
    - src/app/(auth)/auth/error/page.tsx
  modified:
    - src/types/database.ts (fixed format for Supabase v2.93)

key-decisions:
  - "Create tenant before auth user so tenant_id available for profile"
  - "Full rollback deletes tenant AND auth user if profile creation fails"
  - "Use admin client with SUPABASE_SERVICE_ROLE_KEY for user deletion"
  - "Store tenant_id in user_metadata for redundancy"

patterns-established:
  - "Transactional signup: tenant -> auth -> profile with rollback on failure"
  - "Admin client pattern for privileged operations"
  - "useActionState for server action form handling"

# Metrics
duration: 7min
completed: 2026-01-26
---

# Phase 1 Plan 4: Signup Flow Summary

**Complete signup flow with tenant creation, profile linking, email confirmation, and CRITICAL rollback on profile failure (deletes both tenant AND auth user via admin API)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-26T15:21:31Z
- **Completed:** 2026-01-26T15:28:XX

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create signup page with form | 6419403 | signup/page.tsx, check-email/page.tsx |
| 2 | Create signup server action | 8f3eca1 | signup/actions.ts |
| 3 | Create email confirmation handler | 60f0df4 | auth/confirm/route.ts, auth/error/page.tsx |

## Implementation Details

### Signup Flow Sequence

1. **User submits form** - fullName, email, password validated with zod
2. **Tenant created** - Named "{fullName}'s Organization"
3. **Auth user created** - With user_metadata including tenant_id
4. **Profile created** - Links user.id to tenant.id
5. **Redirect to check-email** - User confirms via email link

### Rollback Strategy

```
Tenant Creation Failed → Return error (nothing to rollback)

Auth Signup Failed → Delete tenant, return error

Profile Creation Failed → Delete tenant AND delete auth user via admin API
```

### Email Confirmation

- Route handler at `/auth/confirm`
- Accepts `token_hash` and `type` URL params
- Uses `supabase.auth.verifyOtp()` for token exchange
- Redirects to `/dashboard` on success
- Redirects to `/auth/error` on failure

### Files Created

**src/app/(auth)/signup/page.tsx** (104 lines)
- Client Component with useActionState
- Form fields: fullName, email, password
- Error display from server action state
- Link to /login for existing users

**src/app/(auth)/signup/actions.ts** (157 lines)
- Zod validation schema
- createAdminClient() for privileged operations
- signup() server action with full rollback logic
- Exports: SignupState interface, signup function

**src/app/(auth)/signup/check-email/page.tsx**
- Instructions to check email for confirmation link
- Link back to /login

**src/app/(auth)/auth/confirm/route.ts** (41 lines)
- GET handler for email confirmation
- Token exchange with verifyOtp
- Redirects based on success/failure

**src/app/(auth)/auth/error/page.tsx**
- User-friendly error messages
- Links to signup and login

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Database types for Supabase v2.93**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Database interface missing Relationships key expected by newer Supabase
- **Fix:** Rewrote database.ts to match Supabase v2.93 generated type format
- **Files modified:** src/types/database.ts
- **Commit:** 6419403 (included in Task 1 commit)

## Verification Results

- [x] Signup form accepts name, email, password with validation
- [x] Signup creates tenant, user, and profile in correct order
- [x] Profile creation failure rolls back tenant AND deletes auth user via admin API
- [x] Email confirmation link is generated with correct redirect URL
- [x] Confirmation route handler exchanges token for session
- [x] Error states are handled gracefully
- [x] TypeScript compilation passes

## Environment Requirements

```env
# Required for signup rollback (admin user deletion)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for email confirmation redirects
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Next Phase Readiness

Ready for:
- **01-05:** Login page can now link to signup
- **01-06:** Session management can verify users created by signup

Note: Signup will fail without Supabase project configured with proper service role key.
