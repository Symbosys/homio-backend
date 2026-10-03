/**
 * Universal LLM Provider Interfaces & Data Contracts
 * Decouples Homio CRM from specific AI vendor APIs (Google Gemini, OpenAI, Anthropic, etc.)
 */

export type LlmMessageRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
  images?: string[];
}

export interface LlmGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  model?: string;
}

export interface StructuredPoint {
  title: string;
  desc: string;
}

export interface DoubtSolverStructuredResponse {
  messageText: string;
  structuredPoints?: StructuredPoint[];
  concludingNote?: string;
  suggestedFollowups?: string[];
  rawText?: string;
}

export interface ILlmProvider {
  readonly name: string;
  generate(messages: LlmMessage[], options?: LlmGenerateOptions): Promise<string>;
}
