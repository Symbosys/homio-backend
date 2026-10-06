import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { prisma } from "../lib/prisma.js";
import {
  AiCompetitorPolicy,
  AiConversationRole,
  LlmCredentialStatus,
  LlmProvider,
  statusCode,
} from "../types/types.js";
import { ErrorResponse } from "../utils/response.util.js";
import { vectorStoreService } from "./vector-store.service.js";
import type { RagResponse } from "./interfaces/ai-rag.interface.js";

/**
 * Enterprise RAG Inference Engine
 * Assembles guardrails, few-shot golden conversation exemplars, and vector knowledge chunks
 * to generate enterprise-grade answers using the organization's verified LLM keys.
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
   * Evaluates guardrail constraints prior to query execution.
   */
  async evaluateGuardrails(organizationId: string, query: string) {
    const guardrail = await prisma.aiGuardrailConfig.findUnique({
      where: { organizationId },
    });

    if (!guardrail) {
      return { isBlocked: false, guardrail: null, isEscalation: false, guardrailNotes: undefined, response: undefined };
    }

    const lowerQuery = query.toLowerCase();

    // 1. Check prohibited / restricted keywords
    for (const keyword of guardrail.restrictedKeywords) {
      if (keyword.trim() && lowerQuery.includes(keyword.toLowerCase().trim())) {
        return {
          isBlocked: true,
          isEscalation: false,
          reason: `Query violates organization guardrail policy: restricted keyword (${keyword})`,
          guardrailNotes: `Blocked by restricted keyword filter [${keyword}]`,
          response:
            guardrail.disclaimerText ||
            "I apologize, but I am not authorized to discuss this topic based on company policy.",
          guardrail,
        };
      }
    }

    // 2. Check human escalation keywords
    for (const escalationWord of guardrail.humanEscalationKeywords) {
      if (escalationWord.trim() && lowerQuery.includes(escalationWord.toLowerCase().trim())) {
        return {
          isBlocked: false,
          isEscalation: true,
          reason: `Human escalation triggered for keyword: ${escalationWord}`,
          guardrailNotes: `Escalation requested [${escalationWord}]`,
          response: undefined,
          guardrail,
        };
      }
    }

    return { isBlocked: false, guardrail, isEscalation: false, guardrailNotes: undefined, response: undefined };
  }

  /**
   * Executes an end-to-end RAG workflow for a user query.
   */
  async answerQuery(
    organizationId: string,
    query: string,
    options: {
      leadFunnelId?: string;
      similarityThreshold?: number;
      maxChunks?: number;
      systemTone?: string;
    } = {},
  ): Promise<RagResponse> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new ErrorResponse("Query cannot be empty", statusCode.Bad_Request);
    }

    // 1. Evaluate guardrails
    const guardrailCheck = await this.evaluateGuardrails(organizationId, trimmedQuery);
    const guardrail = guardrailCheck.guardrail;

    if (guardrailCheck.isBlocked) {
      const { provider, modelKey } = await this.getTenantChatClient(organizationId);
      return {
        answer: guardrailCheck.response || "Query blocked by organization policy.",
        sources: [],
        retrievalConfidence: 0,
        guardrailNotes: guardrailCheck.guardrailNotes,
        modelUsed: { provider, modelKey },
      };
    }

    // 2. Retrieve relevant vector knowledge chunks via pgvector
    let retrievedChunks: Array<any> = [];
    try {
      retrievedChunks = await vectorStoreService.similaritySearch(organizationId, trimmedQuery, {
        leadFunnelId: options.leadFunnelId,
        limit: options.maxChunks || 5,
        minSimilarity: options.similarityThreshold || 0.25,
      });
    } catch (err: any) {
      console.warn("[RagService] Vector similarity search note:", err?.message);
    }

    // 3. Fetch few-shot golden conversation exemplars (up to 3 approved active conversations)
    const goldenConversations = await prisma.aiGoldenConversation.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        turns: {
          orderBy: { turnOrder: "asc" },
        },
      },
      take: 3,
    });

    // 4. Resolve active chat model client using organization credentials
    const { chatModel, provider, modelKey } = await this.getTenantChatClient(organizationId);

    // 5. Construct System Instructions
    const tone = options.systemTone || "Professional, helpful, and concise.";
    const orgNameSetting = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    const organizationName = orgNameSetting?.name || "our organization";

    let systemPrompt = `You are the official AI assistant for ${organizationName}.\n`;
    systemPrompt += `Tone & Persona: ${tone}\n\n`;

    if (guardrail) {
      if (guardrail.competitorPolicy === AiCompetitorPolicy.BLOCK_AND_REDIRECT) {
        systemPrompt += `Competitor Policy: If a user brings up direct competitor brands, politely redirect them back to ${organizationName}'s unique value and capabilities.\n\n`;
      } else if (guardrail.competitorPolicy === AiCompetitorPolicy.NEUTRAL_COMPARISON) {
        systemPrompt += `Competitor Policy: Present objective and factual comparisons without making disparaging remarks.\n\n`;
      }

      if (guardrail.maxDiscountPercentage) {
        systemPrompt += `Pricing Policy: You may not offer or discuss discounts exceeding ${guardrail.maxDiscountPercentage}%. For custom pricing, direct the user to a sales representative.\n\n`;
      }

      if (guardrail.minBudgetLakh) {
        systemPrompt += `Project Qualification: Our minimum standard engagement budget is ${guardrail.minBudgetLakh} Lakhs INR.\n\n`;
      }

      if (guardrailCheck.isEscalation) {
        systemPrompt += `Note: This conversation has been flagged for human representative follow-up. Offer to connect the user with a specialist.\n\n`;
      }
    }

    systemPrompt += `Instructions:\n`;
    systemPrompt += `1. Answer the user's question accurately using the provided verified Knowledge Context.\n`;
    systemPrompt += `2. If the context does not contain enough information to answer completely, answer helpfully with general guidance and suggest connecting with a representative for exact site measurements and specifications.\n`;
    systemPrompt += `3. Do not invent custom pricing or discounts not present in the context.\n\n`;

    if (retrievedChunks.length > 0) {
      systemPrompt += `--- VERIFIED KNOWLEDGE CONTEXT ---\n`;
      retrievedChunks.forEach((chunk, index) => {
        systemPrompt += `[Source ${index + 1}: ${chunk.sourceTitle} (${chunk.sourceType})]\n${chunk.chunkText}\n\n`;
      });
      systemPrompt += `--- END CONTEXT ---\n`;
    } else {
      systemPrompt += `--- GENERAL KNOWLEDGE CONTEXT ---\n`;
    }

    // 6. Build LangChain Messages Array
    const messages: Array<SystemMessage | HumanMessage | AIMessage> = [new SystemMessage(systemPrompt)];

    // Inject Golden Conversation Turns as Few-Shot Examples
    for (const goldConv of goldenConversations) {
      for (const turn of goldConv.turns) {
        if (turn.role === AiConversationRole.USER) {
          messages.push(new HumanMessage(turn.content));
        } else if (turn.role === AiConversationRole.ASSISTANT) {
          messages.push(new AIMessage(turn.content));
        }
      }
    }

    // Append Current User Query
    messages.push(new HumanMessage(trimmedQuery));

    // 7. Invoke LLM
    const llmResult = await chatModel.invoke(messages);
    let answerText = typeof llmResult.content === "string" ? llmResult.content : JSON.stringify(llmResult.content);

    if (guardrail?.enableDisclaimerOnQuotes && guardrail.disclaimerText) {
      answerText += `\n\n_${guardrail.disclaimerText}_`;
    }

    // Compute average retrieval confidence
    const avgConfidence =
      retrievedChunks.length > 0
        ? Number((retrievedChunks.reduce((acc, c) => acc + c.similarityScore, 0) / retrievedChunks.length).toFixed(4))
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
      guardrailNotes: guardrailCheck.guardrailNotes,
    };
  }
}

export const ragService = new RagService();
