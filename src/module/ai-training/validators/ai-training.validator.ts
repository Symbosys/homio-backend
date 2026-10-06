import { z } from "zod";
import {
  AiCompetitorPolicy,
  AiConversationRole,
  AiSourceType,
} from "../../../types/types.js";

/**
 * Zod nativeEnum declarations ensuring 100% synchronization with Prisma generated client.
 */
export const AiSourceTypeEnum = z.nativeEnum(AiSourceType);
export const AiCompetitorPolicyEnum = z.nativeEnum(AiCompetitorPolicy);
export const AiConversationRoleEnum = z.nativeEnum(AiConversationRole);

/**
 * Knowledge Source Validators
 */
export const CreateKnowledgeSourceSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  type: AiSourceTypeEnum,
  category: z.string().max(100).optional().default("General"),
  leadFunnelId: z.string().uuid("Invalid lead funnel ID").optional().nullable(),
  description: z.string().optional().nullable(),
  rawContent: z.string().optional().nullable(),
  sourceUrl: z.string().url("Invalid source URL").optional().nullable().or(z.literal("")),
  fileAttachment: z.record(z.string(), z.unknown()).optional().nullable(),
  additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
  autoIndex: z.boolean().optional().default(true),
});

export const UpdateKnowledgeSourceSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  type: AiSourceTypeEnum.optional(),
  category: z.string().max(100).optional(),
  leadFunnelId: z.string().uuid("Invalid lead funnel ID").optional().nullable(),
  description: z.string().optional().nullable(),
  rawContent: z.string().optional().nullable(),
  sourceUrl: z.string().url("Invalid source URL").optional().nullable().or(z.literal("")),
  fileAttachment: z.record(z.string(), z.unknown()).optional().nullable(),
  additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Knowledge FAQ Validators
 */
export const CreateKnowledgeFaqSchema = z.object({
  knowledgeSourceId: z.string().uuid("Invalid knowledge source ID").optional().nullable(),
  category: z.string().max(100).optional().default("General FAQ"),
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  tags: z.array(z.string()).optional().default([]),
  sortOrder: z.number().int().optional().default(0),
  additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const UpdateKnowledgeFaqSchema = z.object({
  category: z.string().max(100).optional(),
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Golden Conversation Turn Schema
 */
export const GoldenTurnInputSchema = z.object({
  role: AiConversationRoleEnum,
  content: z.string().min(1, "Content is required"),
  turnOrder: z.number().int().min(0),
  additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const CreateGoldenConversationSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).optional().default("Golden Conversation"),
  scenario: z.string().min(1, "Scenario name is required").max(500),
  category: z.string().max(100).optional().default("Lead Qualification"),
  turns: z.array(GoldenTurnInputSchema).min(1, "At least one conversation turn is required"),
  additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const UpdateGoldenConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  scenario: z.string().min(1).max(500).optional(),
  category: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  turns: z.array(GoldenTurnInputSchema).optional(),
  additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * Guardrail Config Validators
 */
export const UpsertGuardrailConfigSchema = z.object({
  minBudgetLakh: z.number().min(0).optional().nullable(),
  maxDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  competitorPolicy: AiCompetitorPolicyEnum.optional().default(AiCompetitorPolicy.BLOCK_AND_REDIRECT),
  restrictedKeywords: z.array(z.string()).optional().default([]),
  humanEscalationKeywords: z.array(z.string()).optional().default([]),
  enableDisclaimerOnQuotes: z.boolean().optional().default(true),
  disclaimerText: z.string().optional().nullable(),
  additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
});

/**
 * RAG Query Testing / Simulation Schema
 */
export const TestAiQuerySchema = z.object({
  query: z.string().min(1, "Query is required"),
  leadFunnelId: z.string().uuid("Invalid lead funnel ID").optional().nullable(),
  similarityThreshold: z.number().min(0).max(1).optional().default(0.35),
  maxChunks: z.number().int().min(1).max(20).optional().default(5),
  systemTone: z.string().optional(),
});
