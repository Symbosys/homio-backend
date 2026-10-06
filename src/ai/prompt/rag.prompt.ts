/**
 * Enterprise RAG & Conversational System Prompt Engine
 * Provides token-optimized, industry-standard prompt construction for WhatsApp & CRM AI.
 */

export interface BuildSystemPromptParams {
  organizationName: string;
  tone?: string;
  senderName?: string;
  retrievedChunks?: Array<{
    sourceTitle: string;
    sourceType: string;
    chunkText: string;
  }>;
}

/**
 * Builds a concise, production-grade system prompt for WhatsApp AI and RAG.
 * Optimized for token efficiency, natural conversation, strict typo tolerance, and verified knowledge grounding.
 */
export function buildRagSystemPrompt(params: BuildSystemPromptParams): string {
  const { organizationName, tone, senderName, retrievedChunks = [] } = params;
  const personaTone = tone?.trim() || "Professional, warm, helpful, and concise.";

  let prompt = `You are the official AI assistant for ${organizationName}.\n`;
  prompt += `Tone: ${personaTone}\n`;
  if (senderName?.trim()) {
    prompt += `Customer Name: ${senderName.trim()}\n`;
  }

  prompt += `\nCore Rules:
1. CONVERSATION FORMAT: Keep replies short, simple, and direct (1-3 concise paragraphs or clean bullet points). Avoid long essays or overwhelming walls of text.
2. TYPO TOLERANCE: Users may make spelling, typing, or grammatical mistakes. NEVER correct, mention, or point out user typos. Silently understand their intent and answer naturally.
3. KNOWLEDGE GROUNDING: Answer accurately using the provided verified Knowledge Context. Do not invent unverified pricing, discounts, or specifications not in the context.
4. HONESTY: If the knowledge context lacks specific details to answer fully, provide a brief helpful response based on verified facts and offer to connect them with a team specialist.
5. NO REPETITIVE DISCLAIMERS: Do not append boilerplate legal caveats or disclaimers.\n`;

  if (retrievedChunks.length > 0) {
    prompt += `\n--- VERIFIED KNOWLEDGE CONTEXT ---\n`;
    retrievedChunks.forEach((chunk, index) => {
      prompt += `[Source ${index + 1}: ${chunk.sourceTitle} (${chunk.sourceType})]\n${chunk.chunkText}\n\n`;
    });
    prompt += `--- END CONTEXT ---\n`;
  } else {
    prompt += `\n--- GENERAL KNOWLEDGE CONTEXT ---\n`;
  }

  return prompt;
}
