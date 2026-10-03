import type {
  ILlmProvider,
  LlmMessage,
  LlmGenerateOptions,
} from "../interfaces/llm-provider.interface.js";

/**
 * OpenAI LangChain LLM Provider Stub / Adapter
 * Ready to be connected when OPENAI_API_KEY is supplied
 */
export class OpenAiLlmProvider implements ILlmProvider {
  public readonly name = "openai";
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel: string = "gpt-4o-mini") {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.defaultModel = defaultModel;
  }

  public async generate(
    messages: LlmMessage[],
    options?: LlmGenerateOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "OpenAI API key not configured. Please set OPENAI_API_KEY or switch to Gemini provider."
      );
    }

    try {
      // Dynamic import to avoid missing optional dependency crash if not installed
      const { ChatOpenAI } = await import("@langchain/openai" as any);
      const { HumanMessage, AIMessage, SystemMessage } = await import(
        "@langchain/core/messages"
      );

      const model = new ChatOpenAI({
        openAIApiKey: this.apiKey,
        modelName: options?.model || this.defaultModel,
        temperature: options?.temperature ?? 0.3,
        maxTokens: options?.maxTokens ?? 3500,
        modelKwargs: {
          response_format: { type: "json_object" },
        },
      });

      const langchainMessages = [];
      if (options?.systemPrompt) {
        langchainMessages.push(new SystemMessage(options.systemPrompt));
      }
      for (const msg of messages) {
        if (msg.role === "system") {
          langchainMessages.push(new SystemMessage(msg.content));
        } else if (msg.role === "user") {
          if (msg.images && msg.images.length > 0) {
            const contentParts: any[] = [{ type: "text", text: msg.content }];
            for (const imgUrl of msg.images) {
              contentParts.push({
                type: "image_url",
                image_url: { url: imgUrl },
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

      const res = await model.invoke(langchainMessages);
      return typeof res.content === "string" ? res.content : JSON.stringify(res.content);
    } catch (error: any) {
      console.error("[OpenAiLlmProvider] Generation failed:", error);
      throw new Error(`OpenAI generation error: ${error?.message || error}`);
    }
  }
}
