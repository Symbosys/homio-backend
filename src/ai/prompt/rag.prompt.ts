/**
 * Enterprise RAG & Conversational System Prompt Engine
 * Provides token-optimized, industry-standard prompt construction for WhatsApp & CRM AI.
 */

export interface BuildSystemPromptParams {
  organizationName: string;
  tone?: string;
  senderName?: string;
  toonContext?: string;
  conversationSummary?: string;
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
  const {
    organizationName,
    tone,
    senderName,
    toonContext,
    conversationSummary,
    retrievedChunks = [],
  } = params;
  const personaTone = tone?.trim() || "Professional, warm, helpful, and concise.";

  let prompt = `You are the official AI assistant for ${organizationName}.\n`;
  prompt += `Tone: ${personaTone}\n`;
  if (senderName?.trim()) {
    prompt += `Customer Name: ${senderName.trim()}\n`;
  }

  prompt += `\nCore Rules:
1. LANGUAGE MATCHING: Always detect and match the customer's language. If the customer messages in Hindi (Devanagari or Romanized/Hinglish), reply in natural, polite Hindi/Hinglish. If they message in English, reply in clear, professional English. Never force English when the user speaks Hindi.
2. CONVERSATION FORMAT & TONE: Be warm, polite, consultative, and human-like. Keep messages short, crisp, and conversational (1-3 paragraphs or clean bullet points). Do not send long essays or robotic walls of text.
3. TYPO TOLERANCE: Users may make spelling, typing, or grammatical mistakes. NEVER correct, mention, or point out user typos. Silently understand their intent and answer naturally.
4. KNOWLEDGE GROUNDING: Answer accurately using the provided verified Knowledge Context. Do not invent unverified pricing, discounts, or specifications not in the context.
5. AUTONOMOUS LEAD PROFILING (TOOL: update_lead_details):
   - Your primary goal is to understand the client's needs: their goal/purpose (e.g., 2BHK/3BHK interior, modular kitchen, full renovation), estimated budget, customer name, and property location/city.
   - As soon as the customer mentions or answers any of these details, immediately call the \`update_lead_details\` tool to update their CRM profile.
6. CONSULTATION & MEETING SCHEDULING (TOOL: schedule_meeting):
   - Once basic details are gathered or when the customer asks for a quote/consultation, warmly ask: "Would you like to schedule a consultation meeting with our expert design team?"
   - When the customer agrees, ask for their preferred date, time, and mode (In-person Office Meeting vs. Online Video Meeting).
   - Once date/time is provided, immediately call the \`schedule_meeting\` tool to book the meeting.
   - After booking, confirm the scheduled date and time and reassure them: "Your meeting has been scheduled for [Date & Time]. Our team will contact you shortly." (in their language).
7. HONESTY: If knowledge context lacks specific answers, provide a helpful summary and offer to schedule a meeting with a specialist.
8. NO REPETITIVE DISCLAIMERS: Do not append boilerplate legal caveats or disclaimers.\n`;

  // Inject TOON structured context if provided (Customer profile, lead status, budget)
  if (toonContext?.trim()) {
    prompt += `\n--- CRM CONTEXT (TOON) ---\n${toonContext.trim()}\n--- END CRM CONTEXT ---\n`;
  }

  // Inject bounded historical conversation summary if provided
  if (conversationSummary?.trim()) {
    prompt += `\n--- CONVERSATION SUMMARY ---\n${conversationSummary.trim()}\n--- END SUMMARY ---\n`;
  }

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

