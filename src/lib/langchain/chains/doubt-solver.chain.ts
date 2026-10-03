import type {
  LlmMessage,
  DoubtSolverStructuredResponse,
  StructuredPoint,
} from "../interfaces/llm-provider.interface.js";
import { LlmFactory } from "../llm.factory.js";
import { getDoubtSolverSystemPrompt } from "./prompts/domain-prompts.js";

export interface DoubtSolverChainInput {
  question: string;
  topicCategory?: string;
  intelligenceMode?: string;
  history?: Array<{
    sender: "USER" | "AI";
    messageText: string;
  }>;
  provider?: string;
}

/**
 * AI Doubt Solver Execution Chain
 * Orchestrates multi-turn message history, domain prompts, LLM invocation, and structured parsing
 */
export class DoubtSolverChain {
  /**
   * Execute question answering workflow
   */
  public static async execute(
    input: DoubtSolverChainInput
  ): Promise<DoubtSolverStructuredResponse> {
    const {
      question,
      topicCategory = "General Consultation",
      intelligenceMode = "smart",
      history = [],
      provider,
    } = input;

    const llm = LlmFactory.getProvider(provider);
    const systemPrompt = getDoubtSolverSystemPrompt(
      intelligenceMode,
      topicCategory
    );

    // Build message thread context
    const messages: LlmMessage[] = [];

    // Add up to last 8 past turns for context
    const recentHistory = history.slice(-8);
    for (const h of recentHistory) {
      messages.push({
        role: h.sender === "USER" ? "user" : "assistant",
        content: h.messageText,
      });
    }

    // Append current user question with structured JSON instruction
    const userPromptWithFormatting = `
User Query: "${question}"

Please provide a comprehensive, expert answer. 
Respond in the following structured format with clear sections:
1. An opening overview answering the question directly.
2. A bulleted list of 3-6 distinct points with bold titles (e.g. "**Title**: Description").
3. A concluding practical tip / execution note.
`.trim();

    messages.push({
      role: "user",
      content: userPromptWithFormatting,
    });

    const rawResponse = await llm.generate(messages, {
      systemPrompt,
      temperature: 0.35,
      maxTokens: 2500,
    });

    return this.parseStructuredResponse(rawResponse);
  }

  /**
   * Parses LLM text response into structured UI points and clean sections
   */
  private static parseStructuredResponse(
    text: string
  ): DoubtSolverStructuredResponse {
    const cleanText = text.trim();
    const lines = cleanText.split("\n").map((l) => l.trim());

    const points: StructuredPoint[] = [];
    const introLines: string[] = [];
    const concludingLines: string[] = [];

    let isCollectingPoints = false;
    let isCollectingConclusion = false;

    // Regex to match bullet lines with bold title: - **Title**: Description or 1. **Title**: Description or * **Title** - Description
    const bulletPattern = /^[-*•\d.]+\s*(?:\*\*(.*?)\*\*|([A-Z][\w\s&/-]{2,30}):)\s*[:\-–]?\s*(.*)$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Check if conclusion section started
      const lowerLine = line.toLowerCase();
      if (
        lowerLine.startsWith("**conclusion") ||
        lowerLine.startsWith("### conclusion") ||
        lowerLine.startsWith("**pro tip") ||
        lowerLine.startsWith("**takeaway") ||
        lowerLine.startsWith("**summary") ||
        lowerLine.startsWith("in conclusion")
      ) {
        isCollectingConclusion = true;
        isCollectingPoints = false;
        const noteContent = line.replace(/^[#*]+\s*[^:]*:\s*/i, "");
        if (noteContent) concludingLines.push(noteContent);
        continue;
      }

      if (isCollectingConclusion) {
        concludingLines.push(line);
        continue;
      }

      const match = line.match(bulletPattern);
      if (match) {
        isCollectingPoints = true;
        const title = (match[1] || match[2] || "").trim();
        const desc = (match[3] || "").trim();
        if (title) {
          points.push({ title, desc });
        }
      } else if (!isCollectingPoints && !isCollectingConclusion) {
        introLines.push(line);
      } else if (isCollectingPoints && points.length > 0 && !line.startsWith("#")) {
        // Line might be continuation of previous point description
        const lastPoint = points[points.length - 1];
        if (lastPoint) {
          lastPoint.desc += " " + line;
        }
      }
    }

    const messageText =
      introLines.join(" ").trim() ||
      (points.length > 0 ? "Here is the expert recommendation for your query:" : cleanText);

    const concludingNote = concludingLines.join(" ").trim() || undefined;

    return {
      messageText,
      structuredPoints: points.length > 0 ? points : undefined,
      concludingNote,
      rawText: cleanText,
    };
  }
}
