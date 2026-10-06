import { prisma } from "../lib/prisma.js";

async function testInsert() {
  const source = await prisma.aiKnowledgeSource.findFirst();
  if (!source) {
    console.log("No source found");
    return;
  }

  const testFloats = new Array(1536).fill(0.0123);
  const vectorSqlString = `[${testFloats.join(",")}]`;

  try {
    console.log("Testing $executeRawUnsafe with valid source...");
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ai_knowledge_chunks" (
        "id", "organization_id", "knowledge_source_id", "chunk_index",
        "chunk_text", "token_count", "embedding_dimensions", "embedding_provider",
        "embedding_model_key", "embedding", "is_active", "created_at", "updated_at"
      ) VALUES (
        gen_random_uuid(), '${source.organizationId}'::uuid, '${source.id}'::uuid, 9999,
        'test chunk content', 10, 1536, 'OPENAI', 'text-embedding-3-small',
        '${vectorSqlString}'::vector, true, NOW(), NOW()
      );
    `);
    console.log("SUCCESS WITH $executeRawUnsafe!");
    
    // Clean up test chunk
    await prisma.aiKnowledgeChunk.deleteMany({
      where: { chunkIndex: 9999 }
    });
  } catch (err) {
    console.error("FAILED:", err);
  }
}

testInsert()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
