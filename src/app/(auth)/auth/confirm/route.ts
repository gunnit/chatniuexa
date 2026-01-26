/**
 * Email Confirmation Route Handler
 *
 * Handles email confirmation links from Supabase Auth.
 * Exchanges the token_hash for a session and redirects to dashboard.
 *
 * URL format: /auth/confirm?token_hash=xxx&type=email
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'email' | 'recovery' | 'invite' | null
  const next = searchParams.get('next') ?? '/dashboard'

  // Validate required parameters
  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/auth/error?error=missing_params', request.url))
  }

  const supabase = await createClient()

  // Exchange the token for a session
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  })

  if (error) {
    console.error('Email confirmation failed:', error)
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  // Success - redirect to the next page (default: dashboard)
  return NextResponse.redirect(new URL(next, request.url))
}
