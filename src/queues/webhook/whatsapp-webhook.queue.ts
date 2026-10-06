import { createQueue } from "../../lib/queue/index.js";
import type {
  MetaWebhookContact,
  MetaWebhookMessage,
  MetaWebhookStatus,
} from "../../module/integration/types/index.js";

export const WHATSAPP_WEBHOOK_QUEUE_NAME = "whatsapp-webhook";

export interface InboundMessageJobData {
  jobType: "INBOUND_MESSAGE";
  organizationId: string;
  message: MetaWebhookMessage;
  contacts: MetaWebhookContact[];
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  receivedAt: string;
}

export interface StatusUpdateJobData {
  jobType: "STATUS_UPDATE";
  organizationId: string;
  statuses: MetaWebhookStatus[];
  receivedAt: string;
}

export type WhatsAppWebhookJobData = InboundMessageJobData | StatusUpdateJobData;

/**
 * BullMQ Queue instance for asynchronous Meta WhatsApp webhook processing.
 */
export const whatsappWebhookQueue = createQueue<WhatsAppWebhookJobData>(
  WHATSAPP_WEBHOOK_QUEUE_NAME,
);

/**
 * Enqueues an inbound customer message for background processing.
 */
export async function addWhatsAppInboundMessageJob(
  data: Omit<InboundMessageJobData, "jobType">,
) {
  const jobId = `inbound_${data.organizationId}_${data.message.id}`;
  return whatsappWebhookQueue.add(
    "process_inbound_message",
    { ...data, jobType: "INBOUND_MESSAGE" },
    {
      jobId,
      // Deduplicate rapid webhook retries from Meta
      removeOnComplete: true,
    },
  );
}

/**
 * Enqueues a message delivery status update for background processing.
 */
export async function addWhatsAppStatusUpdateJob(
  data: Omit<StatusUpdateJobData, "jobType">,
) {
  const firstStatusId = data.statuses[0]?.id || "status";
  const jobId = `status_${data.organizationId}_${firstStatusId}_${Date.now()}`;
  return whatsappWebhookQueue.add(
    "process_status_update",
    { ...data, jobType: "STATUS_UPDATE" },
    { jobId },
  );
}
