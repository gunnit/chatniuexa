-- Setup pgvector for RAG embeddings
-- Run this manually if prisma migrate deploy fails

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add embedding column to chunks table
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 3: Create index for vector similarity search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 4: Verify setup
SELECT
  (SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector') > 0 AS pgvector_installed,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'chunks' AND column_name = 'embedding') > 0 AS embedding_column_exists;
