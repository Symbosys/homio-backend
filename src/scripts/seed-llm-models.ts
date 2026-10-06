import { prisma } from "../lib/prisma.js";
import { LlmModelType, LlmProvider } from "../types/types.js";

const DEFAULT_MODELS = [
  // OpenAI Chat Models
  {
    provider: LlmProvider.OPENAI,
    modelType: LlmModelType.CHAT,
    modelKey: "gpt-4o",
    displayName: "GPT-4o",
    description: "Flagship high-intelligence multimodal model for fast, natural conversational AI.",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    embeddingDimensions: null,
    supportsVision: true,
    supportsTools: true,
    isActive: true,
    isDeprecated: false,
    sortOrder: 1,
  },
  {
    provider: LlmProvider.OPENAI,
    modelType: LlmModelType.CHAT,
    modelKey: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    description: "Affordable, fast, lightweight model for everyday conversational auto-replies.",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    embeddingDimensions: null,
    supportsVision: true,
    supportsTools: true,
    isActive: true,
    isDeprecated: false,
    sortOrder: 2,
  },
  // OpenAI Embedding Models
  {
    provider: LlmProvider.OPENAI,
    modelType: LlmModelType.EMBEDDING,
    modelKey: "text-embedding-3-small",
    displayName: "Text Embedding 3 (Small)",
    description: "Highly efficient 1536-dimension embedding model for search and RAG knowledge bases.",
    contextWindow: 8191,
    maxOutputTokens: null,
    embeddingDimensions: 1536,
    supportsVision: false,
    supportsTools: false,
    isActive: true,
    isDeprecated: false,
    sortOrder: 10,
  },
  {
    provider: LlmProvider.OPENAI,
    modelType: LlmModelType.EMBEDDING,
    modelKey: "text-embedding-3-large",
    displayName: "Text Embedding 3 (Large)",
    description: "Most capable 3072-dimension embedding model for nuanced semantic retrieval.",
    contextWindow: 8191,
    maxOutputTokens: null,
    embeddingDimensions: 3072,
    supportsVision: false,
    supportsTools: false,
    isActive: true,
    isDeprecated: false,
    sortOrder: 11,
  },
  {
    provider: LlmProvider.OPENAI,
    modelType: LlmModelType.EMBEDDING,
    modelKey: "text-embedding-ada-002",
    displayName: "Text Embedding Ada 002",
    description: "Legacy 1536-dimension OpenAI embedding model.",
    contextWindow: 8191,
    maxOutputTokens: null,
    embeddingDimensions: 1536,
    supportsVision: false,
    supportsTools: false,
    isActive: true,
    isDeprecated: false,
    sortOrder: 12,
  },

  // Google Gemini Chat Models
  {
    provider: LlmProvider.GEMINI,
    modelType: LlmModelType.CHAT,
    modelKey: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash",
    description: "Fast, versatile multimodal model optimized for high-frequency low-latency auto-replies.",
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    embeddingDimensions: null,
    supportsVision: true,
    supportsTools: true,
    isActive: true,
    isDeprecated: false,
    sortOrder: 20,
  },
  {
    provider: LlmProvider.GEMINI,
    modelType: LlmModelType.CHAT,
    modelKey: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    description: "Mid-size multimodal model with a 2-million-token context window for complex queries.",
    contextWindow: 2097152,
    maxOutputTokens: 8192,
    embeddingDimensions: null,
    supportsVision: true,
    supportsTools: true,
    isActive: true,
    isDeprecated: false,
    sortOrder: 21,
  },
  // Google Gemini Embedding Models
  {
    provider: LlmProvider.GEMINI,
    modelType: LlmModelType.EMBEDDING,
    modelKey: "text-embedding-004",
    displayName: "Text Embedding 004",
    description: "Google's state-of-the-art 768-dimension text embedding model for retrieval and similarity.",
    contextWindow: 2048,
    maxOutputTokens: null,
    embeddingDimensions: 768,
    supportsVision: false,
    supportsTools: false,
    isActive: true,
    isDeprecated: false,
    sortOrder: 30,
  },
  {
    provider: LlmProvider.GEMINI,
    modelType: LlmModelType.EMBEDDING,
    modelKey: "embedding-001",
    displayName: "Embedding 001",
    description: "Legacy 768-dimension Gemini embedding model.",
    contextWindow: 2048,
    maxOutputTokens: null,
    embeddingDimensions: 768,
    supportsVision: false,
    supportsTools: false,
    isActive: true,
    isDeprecated: false,
    sortOrder: 31,
  },

  // Anthropic Claude Chat Models (Chat only - no Anthropic embedding endpoint)
  {
    provider: LlmProvider.ANTHROPIC,
    modelType: LlmModelType.CHAT,
    modelKey: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    description: "Anthropic's most intelligent model with top-tier reasoning and coding capabilities.",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    embeddingDimensions: null,
    supportsVision: true,
    supportsTools: true,
    isActive: true,
    isDeprecated: false,
    sortOrder: 40,
  },
  {
    provider: LlmProvider.ANTHROPIC,
    modelType: LlmModelType.CHAT,
    modelKey: "claude-3-5-haiku-20241022",
    displayName: "Claude 3.5 Haiku",
    description: "Anthropic's fastest, most cost-efficient model for lightweight automated replies.",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    embeddingDimensions: null,
    supportsVision: true,
    supportsTools: true,
    isActive: true,
    isDeprecated: false,
    sortOrder: 41,
  },
];

async function main() {
  console.log("Seeding LLM model catalog with Chat & Embedding models...");

  for (const model of DEFAULT_MODELS) {
    await prisma.llmModelCatalog.upsert({
      where: {
        provider_modelKey: {
          provider: model.provider,
          modelKey: model.modelKey,
        },
      },
      update: {
        modelType: model.modelType,
        displayName: model.displayName,
        description: model.description,
        contextWindow: model.contextWindow,
        maxOutputTokens: model.maxOutputTokens,
        embeddingDimensions: model.embeddingDimensions,
        supportsVision: model.supportsVision,
        supportsTools: model.supportsTools,
        isActive: model.isActive,
        isDeprecated: model.isDeprecated,
        sortOrder: model.sortOrder,
      },
      create: model,
    });
    console.log(`✓ Upserted [${model.modelType}] ${model.provider} - ${model.displayName} (${model.modelKey})`);
  }

  console.log("Seeding completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding error:", err);
    process.exit(1);
  });
