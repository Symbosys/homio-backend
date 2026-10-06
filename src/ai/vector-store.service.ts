import { OpenAIEmbeddings } from "@langchain/openai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { prisma } from "../lib/prisma.js";
import {
  LlmCredentialStatus,
  LlmProvider,
  statusCode,
} from "../types/types.js";
import { ErrorResponse } from "../utils/response.util.js";
import type { RetrievedChunk } from "./interfaces/ai-rag.interface.js";

export interface ChunkToEmbed {
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
  chunkMetadata?: Record<string, unknown> | null;
}

/**
 * Multi-Tenant Vector Store Service
 * Generates vector numerical embeddings using the organization's verified BYOK API key
 * and indexes/queries vectors with PostgreSQL pgvector.
 */
export class VectorStoreService {
  /**
   * Splits raw text into structured chunks of target token length with overlap.
   */
  splitText(
    text: string,
    options: { chunkSize?: number; chunkOverlap?: number } = {},
  ): ChunkToEmbed[] {
    const chunkSize = options.chunkSize || 800;
    const chunkOverlap = options.chunkOverlap || 120;

    const trimmed = text.trim();
    if (!trimmed) return [];

    // Simple robust paragraph and sentence splitter
    const paragraphs = trimmed.split(/\n\s*\n/);
    const chunks: ChunkToEmbed[] = [];
    let currentChunk = "";
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const cleanPara = paragraph.trim();
      if (!cleanPara) continue;

      if ((currentChunk + "\n\n" + cleanPara).length <= chunkSize) {
        currentChunk = currentChunk ? currentChunk + "\n\n" + cleanPara : cleanPara;
      } else {
        if (currentChunk) {
          chunks.push({
            chunkIndex,
            chunkText: currentChunk,
            tokenCount: Math.ceil(currentChunk.length / 4), // Approximate tokens (4 chars ~ 1 token)
          });
          chunkIndex++;
          // Overlap: keep trailing segment of previous chunk
          const words = currentChunk.split(/\s+/);
          const overlapText = words.slice(-Math.floor(chunkOverlap / 6)).join(" ");
          currentChunk = overlapText ? overlapText + "\n\n" + cleanPara : cleanPara;
        } else {
          // Single oversized paragraph: split into slices
          for (let i = 0; i < cleanPara.length; i += (chunkSize - chunkOverlap)) {
            const slice = cleanPara.slice(i, i + chunkSize);
            chunks.push({
              chunkIndex,
              chunkText: slice,
              tokenCount: Math.ceil(slice.length / 4),
            });
            chunkIndex++;
          }
          currentChunk = "";
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        chunkIndex,
        chunkText: currentChunk.trim(),
        tokenCount: Math.ceil(currentChunk.trim().length / 4),
      });
    }

    return chunks;
  }

  /**
   * Resolves the organization's active embedding model and verified API key.
   * Never uses system .env keys; strictly enforces BYOK tenant credentials.
   */
  async getTenantEmbeddingClient(organizationId: string) {
    // 1. Fetch organization LLM settings
    const setting = await prisma.organizationLlmSetting.findUnique({
      where: { organizationId },
      include: {
        activeEmbeddingModel: true,
      },
    });

    let provider = setting?.activeEmbeddingProvider || LlmProvider.OPENAI;
    let modelKey = setting?.activeEmbeddingModel?.modelKey || "text-embedding-3-small";
    let dimensions = setting?.activeEmbeddingModel?.embeddingDimensions || 1536;

    // 2. Fetch verified provider credential with raw API key
    let credential = await prisma.organizationLlmCredential.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider,
        },
      },
    });

    // Fallback check: if chosen provider key is not active, check if another provider key is active
    if (!credential || credential.status !== LlmCredentialStatus.ACTIVE) {
      const allCreds = await prisma.organizationLlmCredential.findMany({
        where: {
          organizationId,
          status: LlmCredentialStatus.ACTIVE,
        },
      });

      const activeOpenAi = allCreds.find((c) => c.provider === LlmProvider.OPENAI);
      const activeGemini = allCreds.find((c) => c.provider === LlmProvider.GEMINI);

      if (activeOpenAi) {
        provider = LlmProvider.OPENAI;
        credential = activeOpenAi;
        modelKey = "text-embedding-3-small";
        dimensions = 1536;
      } else if (activeGemini) {
        provider = LlmProvider.GEMINI;
        credential = activeGemini;
        modelKey = "embedding-001";
        dimensions = 768;
      }
    }

    if (!credential || credential.status !== LlmCredentialStatus.ACTIVE) {
      throw new ErrorResponse(
        `No verified active API key found for your organization. Please configure and verify your API key in Integrations before embedding knowledge datasets.`,
        statusCode.Bad_Request,
      );
    }

    // 3. Initialize LangChain Embeddings instance with tenant API key
    let embedder: OpenAIEmbeddings | GoogleGenerativeAIEmbeddings;

    if (provider === LlmProvider.OPENAI) {
      embedder = new OpenAIEmbeddings({
        openAIApiKey: credential.apiKey,
        modelName: modelKey,
      });
    } else if (provider === LlmProvider.GEMINI) {
      // In Google GenAI, if text-embedding-004 is not enabled on the API key tier, fallback to embedding-001
      const sanitizedModel = modelKey === "text-embedding-004" ? "embedding-001" : modelKey;
      embedder = new GoogleGenerativeAIEmbeddings({
        apiKey: credential.apiKey,
        model: sanitizedModel,
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });
    } else {
      throw new ErrorResponse(`Provider ${provider} does not support vector embeddings`, statusCode.Bad_Request);
    }

    return {
      embedder,
      provider,
      modelKey,
      dimensions,
    };
  }

  /**
   * Generates embeddings and stores vector numerical chunks into PostgreSQL pgvector table.
   */
  async embedAndStoreChunks(
    organizationId: string,
    knowledgeSourceId: string,
    chunks: ChunkToEmbed[],
  ) {
    if (chunks.length === 0) return { insertedCount: 0, provider: LlmProvider.OPENAI, modelKey: "", dimensions: 1536 };

    const { embedder, provider, modelKey, dimensions } = await this.getTenantEmbeddingClient(organizationId);

    // Delete existing chunks for clean idempotent ingestion
    await prisma.aiKnowledgeChunk.deleteMany({
      where: {
        organizationId,
        knowledgeSourceId,
      },
    });

    const texts = chunks.map((c) => c.chunkText);
    let vectors: number[][] = [];

    try {
      vectors = await embedder.embedDocuments(texts);
    } catch (embedError: any) {
      // If Google Generative AI threw 404 for text-embedding-004, retry with embedding-001
      if (provider === LlmProvider.GEMINI) {
        try {
          const fallbackEmbedder = new GoogleGenerativeAIEmbeddings({
            apiKey: (embedder as any).apiKey,
            model: "embedding-001",
            taskType: TaskType.RETRIEVAL_DOCUMENT,
          });
          vectors = await fallbackEmbedder.embedDocuments(texts);
        } catch (retryErr) {
          throw embedError;
        }
      } else {
        throw embedError;
      }
    }

    // Insert chunks using executeRawUnsafe with escaped pgvector numerical array literal
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vectorFloats = vectors[i];
      if (!chunk || !vectorFloats || vectorFloats.length === 0) continue;

      const vectorSqlString = `[${vectorFloats.join(",")}]`;
      const escapedText = chunk.chunkText.replace(/'/g, "''");
      const metadataJson = chunk.chunkMetadata ? `'${JSON.stringify(chunk.chunkMetadata).replace(/'/g, "''")}'::jsonb` : "NULL";

      await prisma.$executeRawUnsafe(`
        INSERT INTO "ai_knowledge_chunks" (
          "id",
          "organization_id",
          "knowledge_source_id",
          "chunk_index",
          "chunk_text",
          "token_count",
          "embedding_dimensions",
          "embedding_provider",
          "embedding_model_key",
          "embedding",
          "chunk_metadata",
          "is_active",
          "created_at",
          "updated_at"
        ) VALUES (
          gen_random_uuid(),
          '${organizationId}'::uuid,
          '${knowledgeSourceId}'::uuid,
          ${chunk.chunkIndex},
          '${escapedText}',
          ${chunk.tokenCount},
          ${dimensions},
          '${provider}',
          '${modelKey}',
          '${vectorSqlString}'::vector,
          ${metadataJson},
          true,
          NOW(),
          NOW()
        );
      `);
    }

    return {
      insertedCount: chunks.length,
      provider,
      modelKey,
      dimensions,
    };
  }

  /**
   * Performs multi-tenant cosine similarity search across knowledge chunks.
   * Strictly isolated by organizationId.
   */
  async similaritySearch(
    organizationId: string,
    query: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      knowledgeSourceId?: string;
      leadFunnelId?: string;
    } = {},
  ): Promise<RetrievedChunk[]> {
    const limit = options.limit || 5;
    const minSimilarity = options.minSimilarity !== undefined ? options.minSimilarity : 0.40;

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const { embedder } = await this.getTenantEmbeddingClient(organizationId);
    let queryVector: number[] = [];

    try {
      queryVector = await embedder.embedQuery(trimmedQuery);
    } catch (embedError: any) {
      if ((embedder as any).model && (embedder as any).model.includes("text-embedding-004")) {
        const fallbackEmbedder = new GoogleGenerativeAIEmbeddings({
          apiKey: (embedder as any).apiKey,
          model: "embedding-001",
          taskType: TaskType.RETRIEVAL_QUERY,
        });
        queryVector = await fallbackEmbedder.embedQuery(trimmedQuery);
      } else {
        throw embedError;
      }
    }

    const vectorSqlString = `[${queryVector.join(",")}]`;

    type RawChunkRow = {
      id: string;
      source_id: string;
      source_title: string;
      source_type: string;
      chunk_index: number;
      chunk_text: string;
      token_count: number;
      chunk_metadata: Record<string, unknown> | null;
      similarity_score: number;
    };

    let sql = `
      SELECT 
        c.id,
        c.knowledge_source_id AS source_id,
        s.title AS source_title,
        s.type AS source_type,
        c.chunk_index,
        c.chunk_text,
        c.token_count,
        c.chunk_metadata,
        (1 - (c.embedding <=> '${vectorSqlString}'::vector)) AS similarity_score
      FROM "ai_knowledge_chunks" c
      INNER JOIN "ai_knowledge_sources" s ON s.id = c.knowledge_source_id
      WHERE c.organization_id = '${organizationId}'::uuid
        AND c.is_active = true
        AND s.status = 'INDEXED'
        AND s.is_deleted = false
        AND c.embedding IS NOT NULL
    `;

    if (options.knowledgeSourceId) {
      sql += ` AND c.knowledge_source_id = '${options.knowledgeSourceId}'::uuid`;
    }

    if (options.leadFunnelId) {
      sql += ` AND (s.lead_funnel_id = '${options.leadFunnelId}'::uuid OR s.lead_funnel_id IS NULL)`;
    }

    sql += `
      ORDER BY c.embedding <=> '${vectorSqlString}'::vector ASC
      LIMIT ${limit};
    `;

    const rawRows = await prisma.$queryRawUnsafe<RawChunkRow[]>(sql);

    return rawRows
      .filter((r) => Number(r.similarity_score) >= minSimilarity)
      .map((r) => ({
        id: r.id,
        sourceId: r.source_id,
        sourceTitle: r.source_title,
        sourceType: r.source_type as any,
        chunkIndex: r.chunk_index,
        chunkText: r.chunk_text,
        tokenCount: r.token_count,
        similarityScore: Number(Number(r.similarity_score).toFixed(4)),
        chunkMetadata: r.chunk_metadata,
      }));
  }
}

export const vectorStoreService = new VectorStoreService();
