/**
 * Token-Oriented Object Notation (TOON) Serializer & Conversation Memory Engine
 *
 * TOON is an ultra-compact, token-efficient representation of structured objects for LLMs.
 * Compared to JSON, TOON eliminates brackets, quotes, commas, and repetitive property syntax,
 * reducing token consumption by 40-60% while improving LLM parsing accuracy.
 */

/**
 * Serializes a JavaScript object into compact TOON (Token-Oriented Object Notation) format.
 *
 * Example Output:
 * CUSTOMER
 *   name: Aditi Rao
 *   phone: +919876543210
 * LEAD
 *   code: LD-2026-0012
 *   status: NEW
 *   budget: 25 Lakhs
 *   property: 3BHK Oberoi Splendor
 */
export function serializeToToon(
  data: Record<string, any> | Array<any> | string | number | boolean | null | undefined,
  indent = 0,
): string {
  if (data === null || data === undefined || data === "") {
    return "";
  }

  const padding = " ".repeat(indent);

  if (typeof data !== "object") {
    return `${padding}${String(data)}`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return "";
    return data
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          return `${padding}- ${serializeToToon(item, indent + 2).trimStart()}`;
        }
        return `${padding}- ${item}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    // Format top-level section headers vs nested properties
    const formattedKey =
      indent === 0
        ? key.replace(/([A-Z])/g, " $1").trim().toUpperCase()
        : key.replace(/([A-Z])/g, " $1").trim().toLowerCase();


    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = serializeToToon(value, indent + 2);
      if (nested.trim()) {
        lines.push(`${padding}${formattedKey}\n${nested}`);
      }
    } else if (Array.isArray(value)) {
      if (value.length > 0) {
        lines.push(`${padding}${formattedKey}:`);
        lines.push(serializeToToon(value, indent + 2));
      }
    } else {
      lines.push(`${padding}${formattedKey}: ${value}`);
    }
  }

  return lines.join("\n");
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
