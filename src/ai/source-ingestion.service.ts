import { prisma } from "../lib/prisma.js";
import {
  AiIngestionStatus,
  AiSourceType,
  AiVersionStatus,
  statusCode,
} from "../types/types.js";
import { ErrorResponse } from "../utils/response.util.js";
import { vectorStoreService } from "./vector-store.service.js";
import type { ChunkToEmbed } from "./vector-store.service.js";

/**
 * Knowledge Source Ingestion Service
 * Handles parsing, chunking, embedding generation, and status lifecycle transitions for knowledge datasets.
 */
export class SourceIngestionService {
  /**
   * Ingests and indexes a single knowledge source.
   */
  async ingestSource(
    organizationId: string,
    sourceId: string,
    options: {
      chunkSize?: number;
      chunkOverlap?: number;
    } = {},
  ) {
    const source = await prisma.aiKnowledgeSource.findUnique({
      where: { id: sourceId },
    });

    if (!source || source.organizationId !== organizationId || source.isDeleted) {
      throw new ErrorResponse("Knowledge source not found", statusCode.Not_Found);
    }

    try {
      // 1. Mark status as CHUNKING
      await prisma.aiKnowledgeSource.update({
        where: { id: sourceId },
        data: {
          status: AiIngestionStatus.CHUNKING,
          lastErrorMessage: null,
          lastErrorCode: null,
        },
      });

      // 2. Prepare text to chunk based on source type
      let textToChunk = "";
      if (source.type === AiSourceType.FAQ) {
        const faqs = await prisma.aiKnowledgeFaq.findMany({
          where: {
            organizationId,
            knowledgeSourceId: sourceId,
            isActive: true,
          },
        });
        if (faqs.length > 0) {
          textToChunk = faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
        } else {
          textToChunk = source.rawContent || source.description || source.title || "";
        }
      } else {
        textToChunk = source.rawContent || source.description || source.title || "";
      }

      if (!textToChunk.trim()) {
        textToChunk = `${source.title} (${source.category})`;
      }

      // 3. Chunk text
      const chunks: ChunkToEmbed[] = vectorStoreService.splitText(textToChunk, {
        chunkSize: options.chunkSize || 800,
        chunkOverlap: options.chunkOverlap || 120,
      });

      if (chunks.length === 0) {
        chunks.push({
          chunkIndex: 0,
          chunkText: textToChunk,
          tokenCount: Math.ceil(textToChunk.length / 4),
        });
      }

      // 4. Mark status as EMBEDDING
      await prisma.aiKnowledgeSource.update({
        where: { id: sourceId },
        data: {
          status: AiIngestionStatus.EMBEDDING,
          chunksCount: chunks.length,
          totalTokens: chunks.reduce((acc, c) => acc + c.tokenCount, 0),
        },
      });

      // 5. Generate and store embeddings via pgvector
      const embedResult = await vectorStoreService.embedAndStoreChunks(
        organizationId,
        sourceId,
        chunks,
      );

      // 6. Mark status as INDEXED
      const updatedSource = await prisma.aiKnowledgeSource.update({
        where: { id: sourceId },
        data: {
          status: AiIngestionStatus.INDEXED,
          chunksCount: chunks.length,
          totalTokens: chunks.reduce((acc, c) => acc + c.tokenCount, 0),
          lastSyncedAt: new Date(),
          lastErrorMessage: null,
          lastErrorCode: null,
        },
      });

      // 7. Record Version History
      const totalIndexedSources = await prisma.aiKnowledgeSource.count({
        where: { organizationId, status: AiIngestionStatus.INDEXED, isDeleted: false },
      });
      const totalChunks = await prisma.aiKnowledgeChunk.count({
        where: { organizationId, isActive: true },
      });

      const versionCount = await prisma.aiTrainingVersion.count({
        where: { organizationId },
      });
      const nextVersion = `v1.${versionCount + 1}.0`;

      await prisma.aiTrainingVersion.create({
        data: {
          organizationId,
          versionTag: nextVersion,
          status: AiVersionStatus.ACTIVE,
          sourcesCount: totalIndexedSources,
          totalChunks,
          totalTokens: chunks.reduce((acc, c) => acc + c.tokenCount, 0),
          deploymentNotes: `Indexed source: "${source.title}" (${source.type}) with ${embedResult.provider}:${embedResult.modelKey}`,
          deployedAt: new Date(),
        },
      });

      return updatedSource;
    } catch (error: any) {
      console.error(`[SourceIngestionService] Failed to ingest source ${sourceId}:`, error);
      // Record failure state cleanly
      await prisma.aiKnowledgeSource.update({
        where: { id: sourceId },
        data: {
          status: AiIngestionStatus.FAILED,
          lastErrorMessage: error?.message || "Failed to index knowledge source",
          lastErrorCode: "INGESTION_ERROR",
        },
      });
      throw error;
    }
  }

  /**
   * Re-indexes all active knowledge sources for an organization.
   */
  async reindexAllSources(organizationId: string) {
    const sources = await prisma.aiKnowledgeSource.findMany({
      where: {
        organizationId,
        isDeleted: false,
      },
    });

    const results: Array<{ id: string; title: string; success: boolean; error?: string }> = [];

    for (const source of sources) {
      try {
        await this.ingestSource(organizationId, source.id);
        results.push({ id: source.id, title: source.title, success: true });
      } catch (err: any) {
        results.push({
          id: source.id,
          title: source.title,
          success: false,
          error: err?.message || "Failed to reindex",
        });
      }
    }

    return results;
  }
}

export const sourceIngestionService = new SourceIngestionService();
