import { z } from "zod";
import { AiChatMessageSender } from "../../../types/types.js";

/**
 * Zod validation for creating a new Doubt Solver chat session
 */
export const CreateDoubtSolverSessionSchema = z.object({
  title: z.string().min(1).max(150).optional().default("Technical Doubt Consultation"),
  topicCategory: z.string().min(1).max(100).optional().default("Interior Design"),
  intelligenceMode: z.string().min(1).max(50).optional().default("smart"),
  initialQuestion: z.string().min(1).max(5000).optional(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type CreateDoubtSolverSessionInput = z.infer<
  typeof CreateDoubtSolverSessionSchema
>;

/**
 * Zod validation for asking a question within an active session
 */
export const AskDoubtSolverQuestionSchema = z.object({
  question: z.string().min(1, "Question cannot be empty").max(5000, "Question is too long"),
  topicCategory: z.string().max(100).optional(),
  intelligenceMode: z.string().max(50).optional(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type AskDoubtSolverQuestionInput = z.infer<
  typeof AskDoubtSolverQuestionSchema
>;

/**
 * Zod validation for rating a message
 */
export const RateDoubtSolverMessageSchema = z.object({
  rating: z.union([z.literal(1), z.literal(5)]),
});

export type RateDoubtSolverMessageInput = z.infer<
  typeof RateDoubtSolverMessageSchema
>;

/**
 * Zod validation for updating a session
 */
export const UpdateDoubtSolverSessionSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  topicCategory: z.string().max(100).optional(),
  intelligenceMode: z.string().max(50).optional(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type UpdateDoubtSolverSessionInput = z.infer<
  typeof UpdateDoubtSolverSessionSchema
>;

/**
 * Zod validation for querying sessions
 */
export const QueryDoubtSolverSessionsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  search: z.string().optional(),
  topicCategory: z.string().optional(),
});

export type QueryDoubtSolverSessionsInput = z.infer<
  typeof QueryDoubtSolverSessionsSchema
>;
