import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { applyPlanLimits, type PlanId } from '@/lib/plans'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  plan: z.enum(['free', 'pro', 'business']),
})

// PATCH /api/admin/tenants/[id]/plan - Change a tenant's plan
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: tenantId } = await params

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, plan: true },
  })

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { plan } = schema.parse(body)

    await applyPlanLimits(tenantId, plan as PlanId)

    return NextResponse.json({ success: true, plan })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
