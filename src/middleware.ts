/**
 * Root Middleware — Composed i18n + Auth
 *
 * 1. API routes bypass i18n entirely (handled by matcher)
 * 2. next-intl handles locale detection / redirect
 * 3. NextAuth auth checks use locale-stripped paths
 */

import createMiddleware from 'next-intl/middleware'
import { auth } from '@/lib/auth'
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

export default auth((req) => {
  const { nextUrl } = req
  const pathname = nextUrl.pathname

  // Skip i18n for API routes
  if (pathname.startsWith('/api/')) {
    const isLoggedIn = !!req.auth
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
  const intlResponse = intlMiddleware(req as unknown as NextRequest)

  // If intl middleware redirected, let it through
  if (intlResponse.headers.get('location')) {
    return intlResponse
  }

  // Now check auth on the locale-stripped path
  const strippedPath = stripLocale(pathname)
  const isLoggedIn = !!req.auth

  const isPublicRoute = publicRoutes.includes(strippedPath)

  if (isPublicRoute) {
    // Redirect logged-in users away from auth pages to dashboard
    if (isLoggedIn && (strippedPath === '/login' || strippedPath === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
    return intlResponse
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return intlResponse
})

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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
