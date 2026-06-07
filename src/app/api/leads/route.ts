import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/leads — leads captured for the authenticated tenant (most recent first).
export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const leads = await prisma.lead.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      note: true,
      source: true,
      createdAt: true,
      chatbot: { select: { name: true } },
    },
  })

  return NextResponse.json({ leads })
}
