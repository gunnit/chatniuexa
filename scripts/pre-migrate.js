#!/usr/bin/env node
/**
 * Pre-migration script to clean up failed migrations
 * Runs BEFORE prisma migrate deploy to ensure a clean state
 */

const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()

  try {
    console.log('Checking for failed migrations...')

    // Check if _prisma_migrations table exists
    const tableExists = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '_prisma_migrations'
      )
    `)

    if (!tableExists[0]?.exists) {
      console.log('No migrations table found - fresh database.')
      return
    }

    // Check for failed migrations
    const failedMigrations = await prisma.$queryRawUnsafe(`
      SELECT id, migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
    `)

    if (failedMigrations.length > 0) {
      console.log(`Found ${failedMigrations.length} failed/incomplete migrations:`)
      for (const m of failedMigrations) {
        console.log(`  - ${m.migration_name}`)
      }

      // Delete failed migration records to allow fresh deploy
      console.log('Cleaning up failed migration records...')
      await prisma.$executeRawUnsafe(`
        DELETE FROM _prisma_migrations
        WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
      `)
      console.log('Failed migrations cleaned up.')
    } else {
      console.log('No failed migrations found.')
    }

  } catch (error) {
    // If _prisma_migrations doesn't exist or other error, just continue
    console.log('Pre-migration check:', error.message)
    console.log('Continuing with migration...')
  } finally {
    await prisma.$disconnect()
  }
}

main()
