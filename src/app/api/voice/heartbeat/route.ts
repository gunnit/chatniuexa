import { NextRequest, NextResponse } from 'next/server'
import { getCorsHeaders } from '@/lib/cors'
import { logger } from '@/lib/logger'
import { validateVoiceSession, meterVoiceSession } from '@/lib/voice/session'
import { z } from 'zod'

const heartbeatSchema = z.object({
  sessionId: z.string().min(1),
  elapsedSeconds: z.number().min(0).max(36000),
  final: z.boolean().optional(),
})

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { headers: getCorsHeaders(request.headers.get('origin')) })
}

// POST /api/voice/heartbeat — meters cumulative elapsed seconds and tells the client
// to stop once the monthly minute budget or cost cap is exhausted. The client posts
// this every ~15s and once more (final=true) when the call ends.
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin, 'POST, OPTIONS')

  try {
    const { sessionId, elapsedSeconds, final } = heartbeatSchema.parse(await request.json())

    const session = await validateVoiceSession(sessionId)
    if (!session) {
      // Session already ended/expired — tell the client to stop.
      return NextResponse.json({ stop: true, remainingSeconds: 0 }, { headers: corsHeaders })
    }

    const result = await meterVoiceSession(session, elapsedSeconds, final ?? false)
    return NextResponse.json(result, { headers: corsHeaders })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400, headers: corsHeaders })
    }
    logger.error('Voice heartbeat error', { error: String(error) })
    // On error, ask the client to stop to avoid uncounted usage.
    return NextResponse.json({ stop: true, remainingSeconds: 0 }, { status: 500, headers: corsHeaders })
  }
}
