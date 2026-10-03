import type {
  ILlmProvider,
  LlmMessage,
  LlmGenerateOptions,
} from "../interfaces/llm-provider.interface.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

/**
 * Google Gemini LangChain LLM Provider
 * Implements high-speed inference using Gemini models
 */
export class GeminiLlmProvider implements ILlmProvider {
  public readonly name = "gemini";
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel: string = "gemini-1.5-flash") {
    this.apiKey =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";
    this.defaultModel = defaultModel;

    if (!this.apiKey) {
      console.warn(
        "[GeminiLlmProvider] Warning: No GEMINI_API_KEY / GOOGLE_API_KEY found in environment variables."
      );
    }
  }

  public async generate(
    messages: LlmMessage[],
    options?: LlmGenerateOptions
  ): Promise<string> {
    const modelName = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.3;
    const maxOutputTokens = options?.maxTokens ?? 3000;

    const chatModel = new ChatGoogleGenerativeAI({
      apiKey: this.apiKey,
      model: modelName,
      temperature,
      maxOutputTokens,
    });

    const langchainMessages: BaseMessage[] = [];

    // Prepend system prompt if supplied in options
    if (options?.systemPrompt) {
      langchainMessages.push(new SystemMessage(options.systemPrompt));
    }

    // Convert internal message format to LangChain BaseMessage instances
    for (const msg of messages) {
      if (msg.role === "system") {
        langchainMessages.push(new SystemMessage(msg.content));
      } else if (msg.role === "user") {
        if (msg.images && msg.images.length > 0) {
          const contentParts: any[] = [{ type: "text", text: msg.content }];
          for (const imgUrl of msg.images) {
            contentParts.push({
              type: "image_url",
              image_url: imgUrl,
            });
          }
          langchainMessages.push(new HumanMessage({ content: contentParts }));
        } else {
          langchainMessages.push(new HumanMessage(msg.content));
        }
      } else if (msg.role === "assistant") {
        langchainMessages.push(new AIMessage(msg.content));
      }
    }

    try {
      const response = await chatModel.invoke(langchainMessages);
      if (typeof response.content === "string") {
        return response.content;
      } else if (Array.isArray(response.content)) {
        return response.content
          .map((part) => (typeof part === "string" ? part : (part as { text?: string }).text || ""))
          .join("\n");
      }
      return String(response.content || "");
    } catch (error: any) {
      console.error("[GeminiLlmProvider] Inference error:", error?.message || error);
      throw new Error(
        `Gemini AI generation failed: ${error?.message || "Unknown error"}`
      );
    }
  }
}
