import { aiTrainingRepository } from "../repos/ai-training.repo.js";
import { sourceIngestionService } from "../../../ai/source-ingestion.service.js";
import { ragService } from "../../../ai/rag.service.js";
import {
  AiSourceType,
  AiIngestionStatus,
  statusCode,
} from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";

/**
 * AI Training & Knowledge Studio Service
 * Multi-tenant business logic coordinator.
 */
export class AiTrainingService {
  /**
   * --- KNOWLEDGE SOURCES ---
   */

  async getSources(
    organizationId: string,
    params: {
      type?: AiSourceType;
      status?: AiIngestionStatus;
      leadFunnelId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return aiTrainingRepository.findSources(organizationId, params);
  }

  async getSourceById(organizationId: string, id: string) {
    const source = await aiTrainingRepository.findSourceById(organizationId, id);
    if (!source) {
      throw new ErrorResponse("Knowledge source not found", statusCode.Not_Found);
    }
    return source;
  }

  async createSource(
    organizationId: string,
    data: {
      title: string;
      type: AiSourceType;
      category?: string;
      leadFunnelId?: string | null;
      description?: string | null;
      rawContent?: string | null;
      sourceUrl?: string | null;
      fileAttachment?: any;
      additionalInformation?: any;
      autoIndex?: boolean;
    },
  ) {
    const newSource = await aiTrainingRepository.createSource(organizationId, {
      title: data.title,
      organizationId,
      type: data.type,
      category: data.category || "General",
      leadFunnelId: data.leadFunnelId || null,
      description: data.description,
      rawContent: data.rawContent,
      sourceUrl: data.sourceUrl,
      fileAttachment: data.fileAttachment,
      additionalInformation: data.additionalInformation,
      status: AiIngestionStatus.PENDING,
    });

    if (data.autoIndex !== false && (data.rawContent || data.description || data.type === AiSourceType.FAQ)) {
      try {
        return await sourceIngestionService.ingestSource(organizationId, newSource.id);
      } catch (err) {
        // If immediate indexing fails, return the pending/failed source
        return aiTrainingRepository.findSourceById(organizationId, newSource.id);
      }
    }

    return newSource;
  }

  async updateSource(
    organizationId: string,
    id: string,
    data: {
      title?: string;
      type?: AiSourceType;
      category?: string;
      leadFunnelId?: string | null;
      description?: string | null;
      rawContent?: string | null;
      sourceUrl?: string | null;
      fileAttachment?: any;
      additionalInformation?: any;
    },
  ) {
    await this.getSourceById(organizationId, id);
    return aiTrainingRepository.updateSource(organizationId, id, data);
  }

  async deleteSource(organizationId: string, id: string) {
    await this.getSourceById(organizationId, id);
    return aiTrainingRepository.softDeleteSource(organizationId, id);
  }

  async reindexSource(organizationId: string, id: string) {
    return sourceIngestionService.ingestSource(organizationId, id);
  }

  async reindexAllSources(organizationId: string) {
    return sourceIngestionService.reindexAllSources(organizationId);
  }

  /**
   * --- KNOWLEDGE CHUNKS ---
   */

  async getChunksBySource(
    organizationId: string,
    sourceId: string,
    params: { page?: number; limit?: number },
  ) {
    await this.getSourceById(organizationId, sourceId);
    return aiTrainingRepository.findChunksBySource(organizationId, sourceId, params);
  }

  /**
   * --- FAQS ---
   */

  async getFaqs(
    organizationId: string,
    params: {
      knowledgeSourceId?: string;
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return aiTrainingRepository.findFaqs(organizationId, params);
  }

  async getFaqById(organizationId: string, id: string) {
    const faq = await aiTrainingRepository.findFaqById(organizationId, id);
    if (!faq) {
      throw new ErrorResponse("FAQ not found", statusCode.Not_Found);
    }
    return faq;
  }

  async createFaq(
    organizationId: string,
    data: {
      knowledgeSourceId?: string | null;
      category?: string;
      question: string;
      answer: string;
      tags?: string[];
      sortOrder?: number;
      additionalInformation?: any;
    },
  ) {
    return aiTrainingRepository.createFaq(organizationId, {
      ...data,
      organizationId,
    });
  }

  async updateFaq(
    organizationId: string,
    id: string,
    data: {
      category?: string;
      question?: string;
      answer?: string;
      tags?: string[];
      sortOrder?: number;
      isActive?: boolean;
      additionalInformation?: any;
    },
  ) {
    await this.getFaqById(organizationId, id);
    return aiTrainingRepository.updateFaq(organizationId, id, data);
  }

  async deleteFaq(organizationId: string, id: string) {
    await this.getFaqById(organizationId, id);
    return aiTrainingRepository.deleteFaq(organizationId, id);
  }

  /**
   * --- GOLDEN CONVERSATIONS ---
   */

  async getGoldenConversations(
    organizationId: string,
    params: { search?: string; page?: number; limit?: number },
  ) {
    return aiTrainingRepository.findGoldenConversations(organizationId, params);
  }

  async getGoldenConversationById(organizationId: string, id: string) {
    const conv = await aiTrainingRepository.findGoldenConversationById(organizationId, id);
    if (!conv) {
      throw new ErrorResponse("Golden conversation not found", statusCode.Not_Found);
    }
    return conv;
  }

  async createGoldenConversation(
    organizationId: string,
    data: {
      title?: string;
      scenario: string;
      category?: string;
      additionalInformation?: any;
      turns: Array<{
        role: any;
        content: string;
        turnOrder: number;
        additionalInformation?: any;
      }>;
    },
  ) {
    return aiTrainingRepository.createGoldenConversation(organizationId, data);
  }

  async updateGoldenConversation(
    organizationId: string,
    id: string,
    data: {
      title?: string;
      scenario?: string;
      category?: string;
      isActive?: boolean;
      additionalInformation?: any;
      turns?: Array<{
        role: any;
        content: string;
        turnOrder: number;
        additionalInformation?: any;
      }>;
    },
  ) {
    await this.getGoldenConversationById(organizationId, id);
    return aiTrainingRepository.updateGoldenConversation(organizationId, id, data);
  }

  async deleteGoldenConversation(organizationId: string, id: string) {
    await this.getGoldenConversationById(organizationId, id);
    return aiTrainingRepository.deleteGoldenConversation(organizationId, id);
  }

  /**
   * --- GUARDRAILS ---
   */

  async getGuardrailConfig(organizationId: string) {
    const config = await aiTrainingRepository.findGuardrailConfig(organizationId);
    if (!config) {
      return {
        organizationId,
        minBudgetLakh: null,
        maxDiscountPercentage: null,
        competitorPolicy: "BLOCK_AND_REDIRECT",
        restrictedKeywords: [],
        humanEscalationKeywords: [],
        enableDisclaimerOnQuotes: true,
        disclaimerText: null,
        additionalInformation: null,
      };
    }
    return config;
  }

  async upsertGuardrailConfig(organizationId: string, data: any) {
    return aiTrainingRepository.upsertGuardrailConfig(organizationId, data);
  }

  /**
   * --- VERSIONS & METRICS ---
   */

  async getVersions(organizationId: string, params: { page?: number; limit?: number }) {
    return aiTrainingRepository.findVersions(organizationId, params);
  }

  async getMetrics(organizationId: string) {
    return aiTrainingRepository.getMetrics(organizationId);
  }

  /**
   * --- RAG SIMULATION / PLAYGROUND QUERY ---
   */

  async testAiQuery(
    organizationId: string,
    data: {
      query: string;
      leadFunnelId?: string | null;
      similarityThreshold?: number;
      maxChunks?: number;
      systemTone?: string;
    },
  ) {
    return ragService.answerQuery(organizationId, data.query, {
      leadFunnelId: data.leadFunnelId || undefined,
      similarityThreshold: data.similarityThreshold,
      maxChunks: data.maxChunks,
      systemTone: data.systemTone,
    });
  }
}

export const aiTrainingService = new AiTrainingService();
