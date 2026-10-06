import { startWhatsAppWebhookWorker } from "./webhook/whatsapp-webhook.worker.js";
import { startAiReplyWorker } from "./ai/ai-reply.worker.js";
import { closeAllQueuesAndWorkers } from "../lib/queue/index.js";

/**
 * Initializes and starts all background queue workers.
 * Called once during application boot in server/src/index.ts.
 */
export function initWorkers() {
  console.log("[Workers] Initializing enterprise background BullMQ workers...");

  const webhookWorker = startWhatsAppWebhookWorker();
  const aiReplyWorker = startAiReplyWorker();

  console.log("[Workers] WhatsApp Webhook background worker is running.");
  console.log("[Workers] AI Reply background worker is running.");

  return {
    webhookWorker,
    aiReplyWorker,
  };
}

export { closeAllQueuesAndWorkers };
export * from "./webhook/whatsapp-webhook.worker.js";
export * from "./ai/ai-reply.worker.js";

