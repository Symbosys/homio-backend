import { describe, expect, it, mock } from "bun:test";
import {
  createQueue,
  createWorker,
  DEFAULT_JOB_OPTIONS,
} from "../../src/lib/queue/queue.factory.js";
import {
  WHATSAPP_WEBHOOK_QUEUE_NAME,
  whatsappWebhookQueue,
  addWhatsAppInboundMessageJob,
  addWhatsAppStatusUpdateJob,
} from "../../src/queues/webhook/whatsapp-webhook.queue.js";
import { whatsAppWebhookService } from "../../src/module/integration/services/whatsapp-webhook.service.js";
import { whatsAppIntegrationRepo } from "../../src/module/integration/repos/whatsapp-integration.repo.js";
import { wsService } from "../../src/lib/websocket/ws.service.js";
import { WebSocketEventType } from "../../src/lib/websocket/ws.types.js";
import type { MetaWhatsAppWebhookPayload } from "../../src/module/integration/types/index.js";

const TEST_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const TEST_PHONE_NUMBER_ID = "phone_num_id_12345";
const TEST_WABA_ID = "waba_account_id_67890";

describe("Enterprise Redis + BullMQ Queue & Worker Architecture", () => {
  // =========================================================================
  // 1. Generic Queue Factory & Configuration Tests
  // =========================================================================
  describe("Queue Factory & Configuration", () => {
    it("should instantiate BullMQ Queue with correct name and retry backoff options", () => {
      const testQueue = createQueue("test-factory-queue");
      expect(testQueue).toBeDefined();
      expect(testQueue.name).toBe("test-factory-queue");
      expect(DEFAULT_JOB_OPTIONS.attempts).toBe(3);
      expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({
        type: "exponential",
        delay: 2000,
      });
    });

    it("should return the same singleton instance for duplicate queue names", () => {
      const q1 = createQueue("singleton-test-queue");
      const q2 = createQueue("singleton-test-queue");
      expect(q1).toBe(q2);
    });

    it("should instantiate WhatsApp Webhook Queue with correct constants", () => {
      expect(WHATSAPP_WEBHOOK_QUEUE_NAME).toBe("whatsapp-webhook");
      expect(whatsappWebhookQueue.name).toBe(WHATSAPP_WEBHOOK_QUEUE_NAME);
    });
  });

  // =========================================================================
  // 2. Webhook Ingestion & Optimistic WebSocket Preview Tests
  // =========================================================================
  describe("WhatsApp Webhook Ingestion & WebSocket Fast-Path", () => {
    it("should emit optimistic WebSocket preview immediately upon webhook arrival", async () => {
      // Mock tenant integration resolution
      const originalFindByPhoneNumberId = whatsAppIntegrationRepo.findByPhoneNumberId;
      whatsAppIntegrationRepo.findByPhoneNumberId = mock(async () => ({
        id: "integration-123",
        organizationId: TEST_ORG_ID,
        phoneNumberId: TEST_PHONE_NUMBER_ID,
        accountId: TEST_WABA_ID,
      } as any));

      const emittedEvents: Array<{ orgId: string; type: WebSocketEventType; payload: any }> = [];
      const originalBroadcast = wsService.broadcastToOrganization;
      wsService.broadcastToOrganization = mock((orgId, type, payload) => {
        emittedEvents.push({ orgId, type, payload });
      });

      const payload: MetaWhatsAppWebhookPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: TEST_WABA_ID,
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "+1 555-0100",
                    phone_number_id: TEST_PHONE_NUMBER_ID,
                  },
                  contacts: [
                    {
                      profile: { name: "Aditi Rao" },
                      wa_id: "919876543210",
                    },
                  ],
                  messages: [
                    {
                      from: "919876543210",
                      id: `wamid_test_${Date.now()}`,
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      type: "text",
                      text: { body: "Hello, I need interior design consultation for 3BHK" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await whatsAppWebhookService.processWebhookEvent(payload);

      // Verify that the optimistic preview WebSocket event was broadcasted immediately to tenant room
      expect(emittedEvents.length).toBeGreaterThanOrEqual(1);
      const previewEvent = emittedEvents.find(
        (e) => e.type === WebSocketEventType.MESSAGE_RECEIVED && e.orgId === TEST_ORG_ID,
      );
      expect(previewEvent).toBeDefined();
      expect(previewEvent?.payload.content).toBe(
        "Hello, I need interior design consultation for 3BHK",
      );
      expect(previewEvent?.payload.senderName).toBe("Aditi Rao");
      expect(previewEvent?.payload.metadata.isOptimisticPreview).toBe(true);

      // Restore mocks
      whatsAppIntegrationRepo.findByPhoneNumberId = originalFindByPhoneNumberId;
      wsService.broadcastToOrganization = originalBroadcast;
    });

    it("should verify webhook challenge when valid token is provided", async () => {
      const originalFindByToken = whatsAppIntegrationRepo.findByWebhookVerifyToken;
      whatsAppIntegrationRepo.findByWebhookVerifyToken = mock(async (token) => {
        if (token === "valid_tenant_token_123") {
          return { id: "int-1", organizationId: TEST_ORG_ID } as any;
        }
        return null;
      });

      const validResult = await whatsAppWebhookService.verifyWebhook({
        "hub.mode": "subscribe",
        "hub.verify_token": "valid_tenant_token_123",
        "hub.challenge": "challenge_code_98765",
      });
      expect(validResult).toBe("challenge_code_98765");

      const invalidResult = await whatsAppWebhookService.verifyWebhook({
        "hub.mode": "subscribe",
        "hub.verify_token": "unknown_token_999",
        "hub.challenge": "challenge_code_98765",
      });
      expect(invalidResult).toBeNull();

      whatsAppIntegrationRepo.findByWebhookVerifyToken = originalFindByToken;
    });
  });
});
