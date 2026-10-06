import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { prisma } from "../lib/prisma.js";
import {
  LlmCredentialStatus,
  LlmProvider,
  statusCode,
} from "../types/types.js";
import { ErrorResponse } from "../utils/response.util.js";
import { vectorStoreService } from "./vector-store.service.js";
import { buildRagSystemPrompt } from "./prompt/index.js";
import type {
  AnswerQueryOptions,
  ChatMessageTurn,
  RagResponse,
  RetrievedChunk,
} from "./interfaces/ai-rag.interface.js";

/**
 * Enterprise RAG & Conversational Inference Engine
 * Answers customer questions via WhatsApp, CRM live chats, and studio testing
 * with strict typo tolerance, verified knowledge grounding, and concise messaging.
 */
export class RagService {
  /**
   * Resolves the organization's active Chat LLM client using verified BYOK credentials.
   */
  async getTenantChatClient(organizationId: string) {
    const setting = await prisma.organizationLlmSetting.findUnique({
      where: { organizationId },
      include: {
        activeModel: true,
      },
    });

    let provider = setting?.activeProvider || LlmProvider.OPENAI;
    let modelKey = setting?.activeModel?.modelKey || "gpt-4o-mini";
    const userTemperature = setting?.temperature ? Number(setting.temperature) : 0.3;
    const maxTokens = setting?.maxOutputTokens ?? 1024;

    let credential = await prisma.organizationLlmCredential.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider,
        },
      },
    });

    if (!credential || credential.status !== LlmCredentialStatus.ACTIVE) {
      // Fallback check among other active provider keys
      const alternateProviders = [LlmProvider.OPENAI, LlmProvider.GEMINI, LlmProvider.ANTHROPIC].filter(
        (p) => p !== provider,
      );

      for (const altProvider of alternateProviders) {
        const altCred = await prisma.organizationLlmCredential.findUnique({
          where: {
            organizationId_provider: {
              organizationId,
              provider: altProvider,
            },
          },
        });
        if (altCred && altCred.status === LlmCredentialStatus.ACTIVE) {
          provider = altProvider;
          credential = altCred;
          modelKey =
            altProvider === LlmProvider.GEMINI
              ? "gemini-1.5-flash"
              : altProvider === LlmProvider.ANTHROPIC
              ? "claude-3-5-sonnet-20241022"
              : "gpt-4o-mini";
          break;
        }
      }
    }

    if (!credential || credential.status !== LlmCredentialStatus.ACTIVE) {
      throw new ErrorResponse(
        `No verified active LLM API key found for your organization. Please configure and verify your LLM API key in Integrations before testing AI replies.`,
        statusCode.Bad_Request,
      );
    }

    let chatModel: ChatOpenAI | ChatGoogleGenerativeAI | ChatAnthropic;

    // Detect reasoning / fixed-temperature OpenAI models (o1, o3, gpt-5-mini) where temperature != 1 is rejected
    const isReasoningOrFixedTempModel =
      modelKey.startsWith("o1") ||
      modelKey.startsWith("o3") ||
      modelKey.toLowerCase().includes("5-mini") ||
      modelKey.toLowerCase().includes("reasoning");

    if (provider === LlmProvider.OPENAI) {
      chatModel = new ChatOpenAI({
        openAIApiKey: credential.apiKey,
        modelName: modelKey,
        ...(isReasoningOrFixedTempModel ? {} : { temperature: userTemperature, maxTokens }),
      });
    } else if (provider === LlmProvider.GEMINI) {
      chatModel = new ChatGoogleGenerativeAI({
        apiKey: credential.apiKey,
        model: modelKey,
        temperature: userTemperature,
        maxOutputTokens: maxTokens,
      });
    } else if (provider === LlmProvider.ANTHROPIC) {
      chatModel = new ChatAnthropic({
        anthropicApiKey: credential.apiKey,
        modelName: modelKey,
        temperature: userTemperature,
        maxTokens,
      });
    } else {
      throw new ErrorResponse(`Unsupported LLM provider: ${provider}`, statusCode.Bad_Request);
    }

    return {
      chatModel,
      provider,
      modelKey,
    };
  }

  /**
   * Executes an end-to-end RAG workflow for a user query.
   * Can be invoked directly from WhatsApp webhooks, omnichannel bots, or the AI Training Playground.
   *
   * @param organizationId - Tenant organization ID
   * @param query - Incoming customer message or query string
   * @param options - Funnel filters, chat history, custom tone, etc.
   */
  async answerQuery(
    organizationId: string,
    query: string,
    options: AnswerQueryOptions = {},
  ): Promise<RagResponse> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new ErrorResponse("Query cannot be empty", statusCode.Bad_Request);
    }

    // 1. Retrieve relevant vector knowledge chunks via pgvector (scoped to lead funnel if specified)
    let retrievedChunks: RetrievedChunk[] = [];
    try {
      retrievedChunks = await vectorStoreService.similaritySearch(organizationId, trimmedQuery, {
        leadFunnelId: options.leadFunnelId,
        limit: options.maxChunks || 5,
        minSimilarity: options.similarityThreshold || 0.25,
      });
    } catch (err: any) {
      console.warn("[RagService] Vector similarity search note:", err?.message);
    }

    // 2. Resolve active chat model client using organization credentials
    const { chatModel, provider, modelKey } = await this.getTenantChatClient(organizationId);

    // 3. Fetch Organization Display Name
    const orgRecord = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const organizationName = orgRecord?.name || "our organization";

    // 4. Construct Token-Optimized, Typo-Tolerant System Instructions
    const systemPrompt = buildRagSystemPrompt({
      organizationName,
      tone: options.systemTone,
      senderName: options.senderName,
      retrievedChunks: retrievedChunks.map((c) => ({
        sourceTitle: c.sourceTitle,
        sourceType: c.sourceType,
        chunkText: c.chunkText,
      })),
    });

    // 5. Build LangChain Messages Array with Multi-Turn Chat History Support
    const messages: Array<SystemMessage | HumanMessage | AIMessage> = [
      new SystemMessage(systemPrompt),
    ];

    // Inject past conversation history if provided (e.g. from WhatsApp thread)
    if (options.chatHistory && options.chatHistory.length > 0) {
      // Take up to the last 6 turns for conversational context without blowing token budget
      const recentHistory = options.chatHistory.slice(-6);
      for (const turn of recentHistory) {
        if (turn.role === "user") {
          messages.push(new HumanMessage(turn.content));
        } else if (turn.role === "assistant") {
          messages.push(new AIMessage(turn.content));
        }
      }
    }

    // Append Current Incoming Query
    messages.push(new HumanMessage(trimmedQuery));

    // 6. Invoke LLM
    const llmResult = await chatModel.invoke(messages);
    let answerText =
      typeof llmResult.content === "string"
        ? llmResult.content.trim()
        : JSON.stringify(llmResult.content);

    // 7. Compute average retrieval confidence
    const avgConfidence =
      retrievedChunks.length > 0
        ? Number(
            (
              retrievedChunks.reduce((acc, c) => acc + c.similarityScore, 0) /
              retrievedChunks.length
            ).toFixed(4),
          )
        : 0.85;

    return {
      answer: answerText,
      sources: retrievedChunks.map((c) => ({
        id: c.sourceId,
        title: c.sourceTitle,
        type: c.sourceType,
        similarityScore: c.similarityScore,
      })),
      retrievalConfidence: avgConfidence,
      modelUsed: { provider, modelKey },
    };
  }

  /**
   * Specialized reusable helper for incoming WhatsApp auto-replies.
   * Easily invoked by WhatsApp webhook handlers and background queue workers.
   *
   * @param organizationId - Tenant organization ID
   * @param incomingMessage - The text message sent by the lead/customer on WhatsApp
   * @param options - Additional context (customer name, funnel ID, conversation history)
   * @returns Clean formatted WhatsApp response ready to be dispatched via Meta Cloud API
   */
  async generateWhatsAppReply(
    organizationId: string,
    incomingMessage: string,
    options: {
      senderName?: string;
      leadFunnelId?: string;
      chatHistory?: ChatMessageTurn[];
      systemTone?: string;
    } = {},
  ): Promise<{
    text: string;
    sources: Array<{ id: string; title: string; type: string; similarityScore: number }>;
    confidence: number;
    modelUsed: { provider: LlmProvider; modelKey: string };
  }> {
    const response = await this.answerQuery(organizationId, incomingMessage, {
      ...options,
      channel: "WHATSAPP",
    });

    return {
      text: response.answer,
      sources: response.sources,
      confidence: response.retrievalConfidence,
      modelUsed: response.modelUsed,
    };
  }
}

export const ragService = new RagService();

