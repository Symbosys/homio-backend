import { encode } from "@toon-format/toon";

/**
 * Token-Oriented Object Notation (TOON) Serializer & Conversation Memory Engine
 *
 * Uses official @toon-format/toon specification package to encode JSON data into
 * compact, human-readable, token-efficient serialization for LLM prompts.
 */

/**
 * Serializes a JavaScript object into compact TOON (Token-Oriented Object Notation) format
 * using the official @toon-format/toon encoder.
 */
export function serializeToToon(
  data: Record<string, any> | Array<any> | string | number | boolean | null | undefined,
): string {
  if (data === null || data === undefined || data === "") {
    return "";
  }

  if (typeof data !== "object") {
    return String(data);
  }

  try {
    return encode(data);
  } catch (err: any) {
    console.warn("[TOON] Error encoding with @toon-format/toon:", err?.message);
    return JSON.stringify(data);
  }
}


/**
 * Counts total words in a string.
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Enforces a strict word count ceiling on text (e.g. 1000 - 1500 words).
 * If word count exceeds maxWords, safely trims from the top (oldest content)
 * while preserving the most recent conversational summary points.
 */
export function truncateToWordLimit(text: string, maxWords = 1200): string {
  if (!text || !text.trim()) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return text.trim();
  }

  // Keep the most recent `maxWords` words and prepend an ellipsis indicator
  const truncatedWords = words.slice(-maxWords);
  return `[Earlier conversation history summarized] ... ${truncatedWords.join(" ")}`;
}

/**
 * Incrementally updates the conversation summary with the latest interaction turn,
 * keeping the overall summary under the configured word ceiling (1000 to 1500 words).
 */
export function updateConversationMemorySummary(
  existingSummary: string | null | undefined,
  latestCustomerMessage: string,
  aiReplyText: string,
  maxWords = 1200,
): string {
  const cleanExisting = existingSummary?.trim() || "";
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const newTurnSummary = `• [${timestamp}] Customer: "${latestCustomerMessage.trim().slice(0, 200)}"\n  AI: "${aiReplyText.trim().slice(0, 200)}"`;

  const updatedSummary = cleanExisting
    ? `${cleanExisting}\n${newTurnSummary}`
    : `Conversation Key Points:\n${newTurnSummary}`;

  return truncateToWordLimit(updatedSummary, maxWords);
}
