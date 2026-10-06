import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("Migrating AI Training & Knowledge Base tables into PostgreSQL...");

  // 1. Try enabling pgvector extension
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("✓ pgvector extension verified / enabled");
  } catch (err: any) {
    console.log("ℹ Note on vector extension:", err?.message || err);
  }

  // 2. Create ENUM types safely
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "AiSourceType" AS ENUM ('DOCUMENT', 'FAQ', 'WEBSITE', 'RAW_TEXT');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "AiIngestionStatus" AS ENUM ('PENDING', 'CHUNKING', 'EMBEDDING', 'INDEXED', 'FAILED', 'PAUSED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "AiCompetitorPolicy" AS ENUM ('BLOCK_AND_REDIRECT', 'NEUTRAL_COMPARISON', 'IGNORE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "AiConversationRole" AS ENUM ('USER', 'ASSISTANT');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "AiVersionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'FAILED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log("✓ AI Training ENUMs verified");

  // 3. Create ai_knowledge_sources table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ai_knowledge_sources" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "type" "AiSourceType" NOT NULL DEFAULT 'DOCUMENT',
      "title" VARCHAR(255) NOT NULL,
      "category" VARCHAR(100) NOT NULL DEFAULT 'General',
      "status" "AiIngestionStatus" NOT NULL DEFAULT 'PENDING',
      "description" TEXT,
      "file_attachment" JSONB,
      "source_url" VARCHAR(1000),
      "chunks_count" INTEGER NOT NULL DEFAULT 0,
      "total_tokens" INTEGER NOT NULL DEFAULT 0,
      "file_size_bytes" BIGINT,
      "last_synced_at" TIMESTAMP(3),
      "last_error_code" VARCHAR(100),
      "last_error_message" TEXT,
      "additional_information" JSONB,
      "is_deleted" BOOLEAN NOT NULL DEFAULT false,
      "created_by_id" UUID REFERENCES "employees"("id") ON DELETE SET NULL,
      "updated_by_id" UUID REFERENCES "employees"("id") ON DELETE SET NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "idx_ai_sources_org_status_deleted" ON "ai_knowledge_sources" ("organization_id", "status", "is_deleted");
    CREATE INDEX IF NOT EXISTS "idx_ai_sources_org_type" ON "ai_knowledge_sources" ("organization_id", "type");
    CREATE INDEX IF NOT EXISTS "idx_ai_sources_org_category" ON "ai_knowledge_sources" ("organization_id", "category");
  `);
  console.log("✓ ai_knowledge_sources table verified");

  // 4. Create ai_knowledge_chunks table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ai_knowledge_chunks" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "knowledge_source_id" UUID NOT NULL REFERENCES "ai_knowledge_sources"("id") ON DELETE CASCADE,
      "chunk_index" INTEGER NOT NULL,
      "chunk_text" TEXT NOT NULL,
      "token_count" INTEGER NOT NULL DEFAULT 0,
      "embedding_dimensions" INTEGER,
      "embedding_provider" "LlmProvider",
      "embedding_model_key" VARCHAR(100),
      "chunk_metadata" JSONB,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "additional_information" JSONB,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ai_knowledge_chunks_source_index_key" UNIQUE ("knowledge_source_id", "chunk_index")
    );

    CREATE INDEX IF NOT EXISTS "idx_ai_chunks_org_active" ON "ai_knowledge_chunks" ("organization_id", "is_active");
    CREATE INDEX IF NOT EXISTS "idx_ai_chunks_source" ON "ai_knowledge_chunks" ("knowledge_source_id");
  `);

  // Add embedding vector column and HNSW index if pgvector is available
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'ai_knowledge_chunks' AND column_name = 'embedding'
        ) THEN
          ALTER TABLE "ai_knowledge_chunks" ADD COLUMN "embedding" vector(1536);
        ELSE
          ALTER TABLE "ai_knowledge_chunks" ALTER COLUMN "embedding" TYPE vector(1536);
        END IF;
      END $$;
    `);

    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_ai_chunks_embedding_hnsw" 
        ON "ai_knowledge_chunks" 
        USING hnsw ("embedding" vector_cosine_ops);
      `);
      console.log("✓ HNSW vector index created on ai_knowledge_chunks");
    } catch (e: any) {
      console.log("ℹ HNSW index note:", e?.message || e);
    }
  } catch (e: any) {
    console.log("ℹ Vector column note:", e?.message || e);
  }
  console.log("✓ ai_knowledge_chunks table verified");

  // 5. Create ai_knowledge_faqs table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ai_knowledge_faqs" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "knowledge_source_id" UUID REFERENCES "ai_knowledge_sources"("id") ON DELETE CASCADE,
      "question" TEXT NOT NULL,
      "answer" TEXT NOT NULL,
      "category" VARCHAR(100) NOT NULL DEFAULT 'General FAQ',
      "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "additional_information" JSONB,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "idx_ai_faqs_org_category_active" ON "ai_knowledge_faqs" ("organization_id", "category", "is_active");
    CREATE INDEX IF NOT EXISTS "idx_ai_faqs_source" ON "ai_knowledge_faqs" ("knowledge_source_id");
  `);
  console.log("✓ ai_knowledge_faqs table verified");

  // 6. Create ai_golden_conversations & ai_golden_turns tables
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ai_golden_conversations" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "title" VARCHAR(255) NOT NULL,
      "scenario" VARCHAR(500) NOT NULL,
      "category" VARCHAR(100) NOT NULL DEFAULT 'Lead Qualification',
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "additional_information" JSONB,
      "created_by_id" UUID REFERENCES "employees"("id") ON DELETE SET NULL,
      "updated_by_id" UUID REFERENCES "employees"("id") ON DELETE SET NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "idx_ai_golden_conv_org_category_active" ON "ai_golden_conversations" ("organization_id", "category", "is_active");

    CREATE TABLE IF NOT EXISTS "ai_golden_turns" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "conversation_id" UUID NOT NULL REFERENCES "ai_golden_conversations"("id") ON DELETE CASCADE,
      "role" "AiConversationRole" NOT NULL,
      "content" TEXT NOT NULL,
      "turn_order" INTEGER NOT NULL,
      "additional_information" JSONB,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ai_golden_turns_conv_order_key" UNIQUE ("conversation_id", "turn_order")
    );

    CREATE INDEX IF NOT EXISTS "idx_ai_golden_turns_conv" ON "ai_golden_turns" ("conversation_id");
  `);
  console.log("✓ ai_golden_conversations & turns tables verified");

  // 7. Create ai_guardrail_configs table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ai_guardrail_configs" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "organization_id" UUID NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
      "min_budget_lakh" DECIMAL(10, 2),
      "max_discount_percentage" DECIMAL(5, 2),
      "competitor_policy" "AiCompetitorPolicy" NOT NULL DEFAULT 'BLOCK_AND_REDIRECT',
      "restricted_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "human_escalation_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "enable_disclaimer_on_quotes" BOOLEAN NOT NULL DEFAULT true,
      "disclaimer_text" TEXT,
      "additional_information" JSONB,
      "updated_by_id" UUID REFERENCES "employees"("id") ON DELETE SET NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✓ ai_guardrail_configs table verified");

  // 8. Create ai_training_versions table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ai_training_versions" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
      "version_tag" VARCHAR(50) NOT NULL,
      "status" "AiVersionStatus" NOT NULL DEFAULT 'ACTIVE',
      "sources_count" INTEGER NOT NULL DEFAULT 0,
      "total_chunks" INTEGER NOT NULL DEFAULT 0,
      "total_tokens" INTEGER NOT NULL DEFAULT 0,
      "accuracy_score" DECIMAL(5, 2),
      "deployment_notes" TEXT,
      "deployed_by_id" UUID REFERENCES "employees"("id") ON DELETE SET NULL,
      "deployed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "additional_information" JSONB,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "idx_ai_versions_org_status" ON "ai_training_versions" ("organization_id", "status");
    CREATE INDEX IF NOT EXISTS "idx_ai_versions_org_deployed_at" ON "ai_training_versions" ("organization_id", "deployed_at" DESC);
  `);
  console.log("✓ ai_training_versions table verified");

  console.log("All AI Training database tables migrated successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
