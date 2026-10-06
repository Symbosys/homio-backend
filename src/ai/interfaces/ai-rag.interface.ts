import type {
  AiCompetitorPolicy,
  AiConversationRole,
  AiIngestionStatus,
  AiSourceType,
  LlmProvider,
} from "../../types/types.js";

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: AiSourceType;
  chunkIndex: number;
  chunkText: string;
  tokenCount: number;
  similarityScore: number;
  chunkMetadata?: Record<string, unknown> | null;
}

export interface RagContext {
  organizationId: string;
  query: string;
  retrievedChunks: RetrievedChunk[];
  guardrailApplied?: {
    isBlocked: boolean;
    reason?: string;
    escalateToHuman: boolean;
    policyTriggered?: string;
  };
  fewShotExamples?: Array<{
    scenario: string;
    turns: Array<{ role: AiConversationRole; content: string }>;
  }>;
}

export interface ChatMessageTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AnswerQueryOptions {
  leadFunnelId?: string;
  chatHistory?: ChatMessageTurn[];
  similarityThreshold?: number;
  maxChunks?: number;
  systemTone?: string;
  senderName?: string;
  channel?: "WHATSAPP" | "PLAYGROUND" | "WEB" | "INTERNAL";
}

export interface RagResponse {
  answer: string;
  sources: Array<{
    id: string;
    title: string;
    type: AiSourceType;
    similarityScore: number;
  }>;
  retrievalConfidence: number;
  totalTokensUsed?: number;
  guardrailNotes?: string;
  modelUsed: {
    provider: LlmProvider;
    modelKey: string;
  };
  embeddingModelUsed?: {
    provider: LlmProvider;
    modelKey: string;
  };
}

