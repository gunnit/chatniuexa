/**
 * Root Middleware — Composed i18n + Auth
 *
 * Uses cookie-based auth check instead of auth() wrapper to avoid
 * redirect loop caused by NextAuth v5 beta adding location headers
 * that conflict with next-intl rewrites.
 *
 * 1. API routes bypass i18n entirely
 * 2. next-intl handles locale detection / redirect
 * 3. Auth checks use session token cookie (actual validation in routes)
 */

import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'

// Create next-intl middleware
const intlMiddleware = createMiddleware(routing)

// Routes that don't require authentication (without locale prefix)
const publicRoutes = ['/', '/login', '/signup', '/signup/check-email', '/auth/error', '/widget.js', '/privacy', '/terms', '/forgot-password', '/reset-password']

// Routes that start with these prefixes are public
const publicPrefixes = ['/api/auth', '/api/widget', '/api/chat']

// Strip locale prefix to get the actual path
function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.slice(`/${locale}`.length) || '/'
    }
  }
  return pathname
}

// Check auth via session token cookie (lightweight middleware check)
function isAuthenticated(req: NextRequest): boolean {
  return !!(
    req.cookies.get('__Secure-authjs.session-token')?.value ||
    req.cookies.get('authjs.session-token')?.value
  )
}

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Skip i18n for API routes
  if (pathname.startsWith('/api/')) {
    const isLoggedIn = isAuthenticated(req)
    const isPublicPrefix = publicPrefixes.some((prefix) =>
      pathname.startsWith(prefix)
    )
    if (isPublicPrefix) return NextResponse.next()
    if (!isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Run i18n middleware first (handles locale detection + redirect)
  const intlResponse = intlMiddleware(req)

  // If intl middleware redirected, let it through
  if (intlResponse.headers.get('location')) {
    return intlResponse
  }

  // Now check auth on the locale-stripped path
  const strippedPath = stripLocale(pathname)
  const isLoggedIn = isAuthenticated(req)

  const isPublicRoute = publicRoutes.includes(strippedPath)

  if (isPublicRoute) {
    // Redirect logged-in users away from auth pages to dashboard
    if (isLoggedIn && (strippedPath === '/login' || strippedPath === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
    }
    return intlResponse
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return intlResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static image files (.svg, .png, .jpg, .jpeg, .gif, .webp)
     * - API routes (handled separately inside middleware)
     */
    '/((?!_next/static|_next/image|favicon.ico|widget\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
