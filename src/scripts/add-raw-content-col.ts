import { prisma } from "../lib/prisma.js";

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ai_knowledge_sources" 
    ADD COLUMN IF NOT EXISTS "raw_content" TEXT;
  `);
  console.log("ai_knowledge_sources.raw_content verified.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
