-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Fix the vector column type (remove quotes)
ALTER TABLE "user_memory" 
DROP COLUMN IF EXISTS "embedding";

ALTER TABLE "user_memory" 
ADD COLUMN "embedding" vector(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS "idx_memory_embedding" ON "user_memory" 
USING hnsw ("embedding" vector_cosine_ops);