#!/usr/bin/env node
/**
 * Database setup script for RAG embeddings
 * Ensures pgvector extension is installed and embedding column exists
 */

const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()

  try {
    console.log('Checking database setup for RAG embeddings...')

    // Check if pgvector extension exists
    const extensionCheck = await prisma.$queryRawUnsafe(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`
    )

    if (extensionCheck.length === 0) {
      console.log('Installing pgvector extension...')
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`)
      console.log('pgvector extension installed.')
    } else {
      console.log('pgvector extension already installed.')
    }

    // Check if embedding column exists
    const columnCheck = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'chunks' AND column_name = 'embedding'`
    )

    if (columnCheck.length === 0) {
      console.log('Adding embedding column to chunks table...')
      await prisma.$executeRawUnsafe(
        `ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)`
      )
      console.log('Embedding column added.')
    } else {
      console.log('Embedding column already exists.')
    }

    // Check if index exists
    const indexCheck = await prisma.$queryRawUnsafe(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'chunks' AND indexname = 'chunks_embedding_idx'`
    )

    if (indexCheck.length === 0) {
      console.log('Creating embedding index...')
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks
         USING ivfflat (embedding vector_cosine_ops)
         WITH (lists = 100)`
      )
      console.log('Embedding index created.')
    } else {
      console.log('Embedding index already exists.')
    }

    // Summary
    const stats = await prisma.$queryRawUnsafe(
      `SELECT
        COUNT(*) as total_chunks,
        COUNT(embedding) as chunks_with_embeddings
       FROM chunks`
    )

    console.log('Database setup complete!')
    console.log(`Chunks: ${stats[0]?.total_chunks || 0} total, ${stats[0]?.chunks_with_embeddings || 0} with embeddings`)

  } catch (error) {
    console.error('Database setup failed:', error.message)
    // Don't exit with error - allow build to continue
    // The app can still work without embeddings (just with degraded RAG)
  } finally {
    await prisma.$disconnect()
  }
}

main()
