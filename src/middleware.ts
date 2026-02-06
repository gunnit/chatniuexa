/**
 * Root Middleware - NextAuth Session Protection
 *
 * This middleware runs on protected routes and redirects unauthenticated users to login.
 * Public routes (login, signup, landing) are accessible without authentication.
 */

import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/', '/login', '/signup', '/signup/check-email', '/auth/error', '/widget.js', '/privacy', '/terms']

// Routes that start with these prefixes are public
const publicPrefixes = ['/api/auth', '/api/widget', '/api/chat']

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  // Check if the current path is public
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname)
  const isPublicPrefix = publicPrefixes.some((prefix) =>
    nextUrl.pathname.startsWith(prefix)
  )

  // Allow public routes
  if (isPublicRoute || isPublicPrefix) {
    // Redirect logged-in users away from auth pages to dashboard
    if (isLoggedIn && (nextUrl.pathname === '/login' || nextUrl.pathname === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', nextUrl))
    }
    return NextResponse.next()
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static image files (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
