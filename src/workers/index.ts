import { startWhatsAppWebhookWorker } from "./webhook/whatsapp-webhook.worker.js";
import { startAiReplyWorker } from "./ai/ai-reply.worker.js";
import { startFollowUpWorker, stopFollowUpWorker } from "./followup/followup.worker.js";
import { closeAllQueuesAndWorkers } from "../lib/queue/index.js";

/**
 * Initializes and starts all background queue workers.
 * Called once during application boot in server/src/index.ts.
 */
export function initWorkers() {
  console.log("[Workers] Initializing enterprise background BullMQ workers...");

  const webhookWorker = startWhatsAppWebhookWorker();
  const aiReplyWorker = startAiReplyWorker();
  const followUpWorker = startFollowUpWorker();

  console.log("[Workers] WhatsApp Webhook background worker is running.");
  console.log("[Workers] AI Reply background worker is running.");
  console.log("[Workers] Auto Follow-Up background worker & poller is running.");

  return {
    webhookWorker,
    aiReplyWorker,
    followUpWorker,
  };
}

export { closeAllQueuesAndWorkers, stopFollowUpWorker };
export * from "./webhook/whatsapp-webhook.worker.js";
export * from "./ai/ai-reply.worker.js";
export * from "./followup/followup.worker.js";

