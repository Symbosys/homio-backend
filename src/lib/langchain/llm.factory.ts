import type { ILlmProvider } from "./interfaces/llm-provider.interface.js";
import { GeminiLlmProvider } from "./providers/gemini.provider.js";
import { OpenAiLlmProvider } from "./providers/openai.provider.js";

/**
 * LLM Factory
 * Central registry to obtain configured LLM provider instances
 */
export class LlmFactory {
  private static geminiInstance: GeminiLlmProvider | null = null;
  private static openaiInstance: OpenAiLlmProvider | null = null;

  public static getProvider(providerName?: string): ILlmProvider {
    const activeProvider = (
      providerName ||
      process.env.AI_DEFAULT_PROVIDER ||
      "openai"
    ).toLowerCase();

    switch (activeProvider) {
      case "gemini":
        if (!this.geminiInstance) {
          this.geminiInstance = new GeminiLlmProvider();
        }
        return this.geminiInstance;

      case "openai":
      default:
        if (!this.openaiInstance) {
          this.openaiInstance = new OpenAiLlmProvider();
        }
        return this.openaiInstance;
    }
  }
}
