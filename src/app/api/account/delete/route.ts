import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const tenantId = session.user.tenantId

  try {
    await prisma.$transaction(async (tx) => {
      if (tenantId) {
        // Delete all tenant data in order
        await tx.message.deleteMany({
          where: { conversation: { chatbot: { tenantId } } },
        })
        await tx.conversation.deleteMany({
          where: { chatbot: { tenantId } },
        })
        await tx.chatbot.deleteMany({ where: { tenantId } })
        await tx.$executeRaw`DELETE FROM chunks WHERE "documentId" IN (SELECT id FROM documents WHERE "dataSourceId" IN (SELECT id FROM data_sources WHERE "tenantId" = ${tenantId}))`
        await tx.document.deleteMany({
          where: { dataSource: { tenantId } },
        })
        await tx.dataSource.deleteMany({ where: { tenantId } })
        await tx.usageLog.deleteMany({ where: { tenantId } })
        await tx.usageLimit.deleteMany({ where: { tenantId } })
        await tx.subscription.deleteMany({ where: { tenantId } })
        await tx.profile.deleteMany({ where: { tenantId } })
        await tx.tenant.delete({ where: { id: tenantId } })
      }

      // Delete user-level data
      await tx.passwordResetToken.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })
      await tx.session.deleteMany({ where: { userId } })
      await tx.profile.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    logger.info('Account deleted', { userId })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Account deletion failed', { userId, error: String(error) })
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
