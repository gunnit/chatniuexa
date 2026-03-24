/**
 * Set a user as admin by email.
 *
 * Usage: npx tsx scripts/set-admin.ts <email>
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: npx tsx scripts/set-admin.ts <email>')
    process.exit(1)
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'admin' },
  })

  console.log(`✓ Set ${user.email} (${user.id}) as admin`)
}

main()
  .catch((e) => {
    console.error('Error:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
