import { createQueue } from "../../lib/queue/index.js";

export const AI_REPLY_QUEUE_NAME = "ai-reply";

export interface AiReplyJobData {
  organizationId: string;
  conversationId: string;
  incomingMessageId: string;
  incomingMessageText: string;
  senderPhone: string;
  senderName?: string;
  leadId?: string;
  enqueuedAt: string;
}

/**
 * BullMQ Queue for delayed autonomous AI auto-replies across WhatsApp & Omnichannel conversations.
 */
export const aiReplyQueue = createQueue<AiReplyJobData>(AI_REPLY_QUEUE_NAME);

/**
 * Enqueues an AI auto-reply job with a mandatory conversational delay (default 3000ms / 3 seconds).
 *
 * @param data Job payload containing tenant, conversation, and incoming message details
 * @param delayMs Delay in milliseconds before worker processes the reply (default: 3000)
 */
export async function addAiReplyJob(
  data: AiReplyJobData,
  delayMs = 3000,
) {
  const jobId = `ai_reply_${data.conversationId}_${data.incomingMessageId}`;

  return aiReplyQueue.add("process_ai_reply", data, {
    jobId,
    delay: delayMs,
    removeOnComplete: true,
  });
}
