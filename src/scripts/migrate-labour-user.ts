import { prisma } from "../lib/prisma.js";

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "labours" 
    ADD COLUMN IF NOT EXISTS "user_id" UUID UNIQUE REFERENCES "users"("id") ON DELETE SET NULL;
  `);
  console.log("Successfully ensured user_id column on labours table!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
