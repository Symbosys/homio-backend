import { prisma } from "../lib/prisma.js";

async function main() {
  const settings = await prisma.organizationLlmSetting.findMany({
    include: {
      activeModel: true,
      activeEmbeddingModel: true,
    },
  });
  console.log("Settings:", JSON.stringify(settings, null, 2));

  const creds = await prisma.organizationLlmCredential.findMany({
    select: {
      id: true,
      organizationId: true,
      provider: true,
      status: true,
      apiKey: true,
    },
  });
  console.log("Credentials:", JSON.stringify(creds.map(c => ({
    ...c,
    apiKey: c.apiKey ? `${c.apiKey.slice(0, 8)}...` : null
  })), null, 2));

  const sources = await prisma.aiKnowledgeSource.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      chunksCount: true,
      totalTokens: true,
      rawContent: true,
      lastErrorMessage: true,
    },
  });
  console.log("Sources:", JSON.stringify(sources, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
