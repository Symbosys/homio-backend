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
  customSystemPrompt?: string;
  model?: string;
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
      customSystemPrompt,
      model,
    } = input;

    const llm = LlmFactory.getProvider(provider || "openai");
    const baseSystemPrompt = getDoubtSolverSystemPrompt(
      intelligenceMode,
      topicCategory
    );

    // Ensure strict domain guardrails are always enforced at top priority
    const guardrailDirective = `### STRICT DOMAIN GUARDRAIL: You are exclusively an Architecture, Interior Design, Construction & Vedic Vastu assistant. You MUST strictly refuse to answer any programming, software, or non-architectural questions under any circumstances.`;

    const systemPrompt = customSystemPrompt?.trim()
      ? `${guardrailDirective}\n\n${customSystemPrompt.trim()}\n\n### DOMAIN PROTOCOLS & ARCHITECTURAL GUIDELINES:\n${baseSystemPrompt}`
      : `${guardrailDirective}\n\n${baseSystemPrompt}`;

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

    // Append current user question with structured domain verification instruction
    const userPromptWithFormatting = `
User Query: "${question}"

CRITICAL DOMAIN GUARDRAIL CHECK:
First, check if the user query is strictly related to architecture, interior design, civil construction, building materials, BoQ budgeting, or Vedic Vastu Shastra.
- IF THE QUERY IS OUTSIDE THIS DOMAIN (e.g. computer programming, software development, Python, Next.js, JavaScript, OAuth, coding, general math, general trivia, recipes, gaming, etc.):
  DO NOT answer the query. You MUST strictly refuse to answer. Politely state that you are exclusively specialized in architecture, interior design, building materials, and Vedic Vastu Shastra, and cannot assist with software programming or non-architectural topics. Do NOT provide any code, scripts, or out-of-domain answers under any conditions.
- IF THE QUERY IS WITHIN DOMAIN:
  Provide a comprehensive, expert answer.
  FORMATTING INSTRUCTIONS:
  * NEVER write markdown section titles or headers such as "### Introduction", "### Key Recommendations", "### Direct Answer", or "### Conclusion". Do NOT include raw "###" hashes.
  * Begin directly with a concise 1-2 sentence direct opening answer paragraph.
  * Next, provide 3 to 6 numbered recommendations with bold titles (e.g. "1. **Hardwood Flooring** – Description").
  * Finish with a 1-2 sentence practical execution takeaway.
`.trim();

    messages.push({
      role: "user",
      content: userPromptWithFormatting,
    });

    const rawResponse = await llm.generate(messages, {
      systemPrompt,
      temperature: 0.35,
      maxTokens: 2500,
      model: model || "gpt-4o-mini",
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

    // Helper to identify and strip section header lines
    const isHeaderLine = (l: string) => {
      const stripped = l.toLowerCase().replace(/^[#*_\s:]+|[#*_\s:]+$/g, "");
      return (
        stripped.startsWith("introduction") ||
        stripped.startsWith("direct answer") ||
        stripped.startsWith("key recommendation") ||
        stripped.startsWith("recommendation") ||
        stripped.startsWith("key point") ||
        stripped.startsWith("overview") ||
        stripped.startsWith("response guideline")
      );
    };

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
        lowerLine.startsWith("## conclusion") ||
        lowerLine.startsWith("# conclusion") ||
        lowerLine.startsWith("**pro tip") ||
        lowerLine.startsWith("### pro tip") ||
        lowerLine.startsWith("**takeaway") ||
        lowerLine.startsWith("### takeaway") ||
        lowerLine.startsWith("**summary") ||
        lowerLine.startsWith("### summary") ||
        lowerLine.startsWith("in conclusion")
      ) {
        isCollectingConclusion = true;
        isCollectingPoints = false;
        const noteContent = line
          .replace(/^[#*]+\s*[^:]*:\s*/i, "")
          .replace(/^#+\s*/, "")
          .trim();
        if (noteContent && !lowerLine.includes("conclusion")) {
          concludingLines.push(noteContent);
        }
        continue;
      }

      if (isCollectingConclusion) {
        const cleanConclusion = line.replace(/^#+\s*/, "").trim();
        if (cleanConclusion) {
          concludingLines.push(cleanConclusion);
        }
        continue;
      }

      // Skip lines that are purely section headers (e.g. ### Introduction, ### Key Recommendations)
      if (line.startsWith("#") || isHeaderLine(line)) {
        continue;
      }

      const match = line.match(bulletPattern);
      if (match) {
        isCollectingPoints = true;
        const title = (match[1] || match[2] || "")
          .trim()
          .replace(/^#+\s*/, "");
        const desc = (match[3] || "").trim();
        if (title) {
          points.push({ title, desc });
        }
      } else if (!isCollectingPoints && !isCollectingConclusion) {
        const cleanLine = line.replace(/^#+\s*/, "").trim();
        if (cleanLine && !isHeaderLine(cleanLine)) {
          introLines.push(cleanLine);
        }
      } else if (isCollectingPoints && points.length > 0 && !line.startsWith("#")) {
        // Line might be continuation of previous point description
        const lastPoint = points[points.length - 1];
        if (lastPoint) {
          lastPoint.desc += " " + line;
        }
      }
    }

    // Clean any remaining markdown header tokens like "### Introduction / Direct Answer" if embedded inside a line
    const cleanIntro = introLines
      .join(" ")
      .replace(/#{1,6}\s*(Introduction\s*\/?\s*Direct Answer|Key Recommendations?|Recommendations?|Conclusion)?:?\s*/gi, "")
      .replace(/#{1,6}\s+/g, "")
      .trim();

    const messageText =
      cleanIntro ||
      (points.length > 0
        ? "Here is the expert recommendation for your query:"
        : cleanText.replace(/#{1,6}\s+/g, ""));

    const concludingNote =
      concludingLines
        .join(" ")
        .replace(/#{1,6}\s*(Conclusion|Pro Tip|Takeaway|Summary)?:?\s*/gi, "")
        .replace(/#{1,6}\s+/g, "")
        .trim() || undefined;

    return {
      messageText,
      structuredPoints: points.length > 0 ? points : undefined,
      concludingNote,
      rawText: cleanText,
    };
  }
}
