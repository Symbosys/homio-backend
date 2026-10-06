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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentFormattedDate = now.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });

  let prompt = `You are the official AI assistant for ${organizationName}.\n`;
  prompt += `Current Date: ${currentFormattedDate} (Current Year: ${currentYear})\n`;
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
6. CONSULTATION & MEETING SCHEDULING / RESCHEDULING (TOOL: schedule_meeting or update_meeting):
   - EXISTING MEETING CHECK: Check CRM Context (TOON) for \`upcomingMeeting\`.
     * If the customer ALREADY has an upcoming/scheduled meeting: DO NOT ask "Kya aap consultation meeting schedule karna chahenge?" or prompt to book a meeting. Just answer their questions directly, simply, and politely!
     * ONLY ask "Would you like to schedule a consultation meeting with our expert design team?" if they DO NOT have any scheduled meeting yet.
   - RESCHEDULING: If the customer asks to change or reschedule their meeting date or time, call \`schedule_meeting\` (or \`update_meeting\`) with their new preferred date and time.
   - Current Year Rule: Always schedule dates in the current year (${currentYear}). If the requested month is in the upcoming new year (e.g. asking in Dec for Jan/Feb), use next year (${currentYear + 1}). NEVER use past years (such as 2023 or 2024).
   - Once date/time is provided, call the tool to book or update the meeting.
   - After booking or updating, confirm the date and time politely to the customer in their language (e.g. "Your meeting has been scheduled/rescheduled for [Date & Time]. Our team will connect with you.").
7. HONESTY: If knowledge context lacks specific answers, provide a helpful summary. If they have an upcoming meeting, mention that our team will discuss this during the scheduled consultation; if not, offer to connect with our expert team.
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

