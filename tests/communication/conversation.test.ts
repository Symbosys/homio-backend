import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  GetConversationsQuerySchema,
  GetMessagesQuerySchema,
  SendReplySchema,
  InitiateOutboundConversationSchema,
  UpdateConversationStatusSchema,
  UpdateHandlingModeSchema,
  AssignConversationSchema,
  ToggleStarredSchema,
  TogglePinnedSchema,
  UpdateTagsSchema,
} from "../../src/module/communication/validators/conversation.validator.js";
import {
  CommunicationChannel,
  ConversationStatus,
  ConversationPriority,
  ConversationHandlingMode,
  MessageDirection,
  MessageContentType,
  MessageStatus,
} from "../../src/types/types.js";
import { WebSocketEventType } from "../../src/lib/websocket/ws.types.js";
import { whatsAppWebhookService } from "../../src/module/integration/services/whatsapp-webhook.service.js";
import { whatsAppIntegrationRepo } from "../../src/module/integration/repos/whatsapp-integration.repo.js";
import { leadService } from "../../src/module/leads-crm/services/lead.service.js";
import { prisma } from "../../src/lib/prisma.js";

const MOCK_ORG_ID = "05c35313-038c-4cc3-aed8-304a702fbf55";
const MOCK_CONV_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const MOCK_LEAD_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const MOCK_USER_ID = "u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";
const MOCK_EMP_ID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66";

describe("Omnichannel Shared Inbox & Customer Chat - Backend Test Suite", () => {
  // =========================================================================
  // SUITE 1: Zod Validation & Schema Tests (Rule 22: NativeEnum Verification)
  // =========================================================================
  describe("Suite 1: Zod NativeEnum & DTO Schemas", () => {
    it("should validate GetConversationsQuerySchema with defaults and custom filters", () => {
      const parsed = GetConversationsQuerySchema.parse({
        page: "2",
        limit: "30",
        tab: "unread",
        channel: CommunicationChannel.WHATSAPP,
        status: ConversationStatus.OPEN,
        priority: ConversationPriority.HIGH,
        handlingMode: ConversationHandlingMode.AI_AUTONOMOUS,
        search: "Amit",
        isStarred: "true",
      });

      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(30);
      expect(parsed.tab).toBe("unread");
      expect(parsed.channel).toBe("WHATSAPP");
      expect(parsed.status).toBe("OPEN");
      expect(parsed.priority).toBe("HIGH");
      expect(parsed.handlingMode).toBe("AI_AUTONOMOUS");
      expect(parsed.search).toBe("Amit");
      expect(parsed.isStarred).toBe(true);
    });

    it("should accept valid tab presets (all, unread, starred, assigned_to_me, open, pending, resolved, archived)", () => {
      const tabs = [
        "all",
        "unread",
        "starred",
        "assigned_to_me",
        "open",
        "pending",
        "resolved",
        "archived",
      ] as const;

      for (const tab of tabs) {
        const result = GetConversationsQuerySchema.safeParse({ tab });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid channels or unknown statuses", () => {
      const invalidChannel = GetConversationsQuerySchema.safeParse({ channel: "DISCORD" });
      expect(invalidChannel.success).toBe(false);

      const invalidStatus = GetConversationsQuerySchema.safeParse({ status: "UNKNOWN_STATUS" });
      expect(invalidStatus.success).toBe(false);
    });

    it("should validate SendReplySchema for Tri-Mode Dispatch", () => {
      // 1. Internal Team Note
      const noteResult = SendReplySchema.safeParse({
        direction: MessageDirection.INTERNAL,
        replyChannel: CommunicationChannel.WHATSAPP,
        contentType: MessageContentType.TEXT,
        content: "Customer requested a site visit quotation revision.",
      });
      expect(noteResult.success).toBe(true);
      if (noteResult.success) {
        expect(noteResult.data.direction).toBe(MessageDirection.INTERNAL);
      }

      // 2. Outgoing WhatsApp Message with Text
      const textReply = SendReplySchema.safeParse({
        direction: MessageDirection.OUTGOING,
        replyChannel: CommunicationChannel.WHATSAPP,
        contentType: MessageContentType.TEXT,
        content: "Hello Amit, here is your project estimate.",
      });
      expect(textReply.success).toBe(true);

      // 3. Outgoing Media Message (Rule 4 Structured JSON)
      const mediaReply = SendReplySchema.safeParse({
        direction: MessageDirection.OUTGOING,
        replyChannel: CommunicationChannel.WHATSAPP,
        contentType: MessageContentType.IMAGE,
        content: "Floor layout plan",
        media: {
          id: "med_12345",
          url: "https://storage.homio.in/plans/floor_v1.webp",
          bytes: 45000,
          format: "webp",
          provider: "CLOUDINARY",
        },
      });
      expect(mediaReply.success).toBe(true);

      // 4. Empty message without media or template must fail
      const emptyReply = SendReplySchema.safeParse({
        direction: MessageDirection.OUTGOING,
        content: "",
      });
      expect(emptyReply.success).toBe(false);

      // 5. Incoming direction must be rejected in sendReply
      const incomingReply = SendReplySchema.safeParse({
        direction: MessageDirection.INCOMING,
        content: "Test",
      });
      expect(incomingReply.success).toBe(false);
    });

    it("should validate InitiateOutboundConversationSchema", () => {
      const valid = InitiateOutboundConversationSchema.safeParse({
        channel: CommunicationChannel.WHATSAPP,
        recipientPhone: "+919876543210",
        recipientName: "Vikram Malhotra",
        recipientEmail: "vikram@example.com",
        initialMessage: "Hi Vikram, thank you for your interest in Homio modular interiors.",
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.recipientPhone).toBe("+919876543210");
        expect(valid.data.recipientName).toBe("Vikram Malhotra");
      }

      const invalidPhone = InitiateOutboundConversationSchema.safeParse({
        recipientPhone: "123", // too short
        initialMessage: "Hello",
      });
      expect(invalidPhone.success).toBe(false);
    });

    it("should validate state transitions and assignments", () => {
      const statusParse = UpdateConversationStatusSchema.safeParse({
        status: ConversationStatus.RESOLVED,
      });
      expect(statusParse.success).toBe(true);

      const handlingParse = UpdateHandlingModeSchema.safeParse({
        handlingMode: ConversationHandlingMode.AI_COPILOT,
      });
      expect(handlingParse.success).toBe(true);

      const assignParse = AssignConversationSchema.safeParse({
        assignedEmployeeId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        assignedTeamId: null,
      });
      expect(assignParse.success).toBe(true);

      const starParse = ToggleStarredSchema.safeParse({ isStarred: true });
      expect(starParse.success).toBe(true);

      const pinParse = TogglePinnedSchema.safeParse({ isPinned: true });
      expect(pinParse.success).toBe(true);

      const tagsParse = UpdateTagsSchema.safeParse({ tags: ["VIP Client", "Luxury Villa"] });
      expect(tagsParse.success).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 2: WhatsApp Webhook Challenge Verification Tests
  // =========================================================================
  describe("Suite 2: WhatsApp Webhook Challenge Verification", () => {
    it("should return challenge string when token matches system default or tenant token", async () => {
      // Mock findByWebhookVerifyToken
      whatsAppIntegrationRepo.findByWebhookVerifyToken = mock(async (token: string) => {
        if (token === "tenant-custom-token-123") {
          return {
            id: "int_1",
            organizationId: MOCK_ORG_ID,
            webhookVerifyToken: token,
          } as any;
        }
        return null;
      });

      // 1. Valid subscription challenge with tenant token
      const tenantChallenge = await whatsAppWebhookService.verifyWebhook({
        "hub.mode": "subscribe",
        "hub.verify_token": "tenant-custom-token-123",
        "hub.challenge": "challenge_response_98765",
      });
      expect(tenantChallenge).toBe("challenge_response_98765");

      // 2. Valid subscription challenge with system token
      const systemChallenge = await whatsAppWebhookService.verifyWebhook({
        "hub.mode": "subscribe",
        "hub.verify_token": "Homio@2026",
        "hub.challenge": "challenge_system_12345",
      });
      expect(systemChallenge).toBe("challenge_system_12345");

      // 3. Invalid token returns null
      const invalidTokenChallenge = await whatsAppWebhookService.verifyWebhook({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token-abc",
        "hub.challenge": "challenge_failed",
      });
      expect(invalidTokenChallenge).toBeNull();

      // 4. Missing mode returns null
      const missingModeChallenge = await whatsAppWebhookService.verifyWebhook({
        "hub.verify_token": "Homio@2026",
        "hub.challenge": "challenge_failed",
      });
      expect(missingModeChallenge).toBeNull();
    });
  });

  // =========================================================================
  // SUITE 3: Conditional CRM Lead Creation & Deduplication Logic
  // =========================================================================
  describe("Suite 3: Conditional CRM Lead Creation on WhatsApp Message", () => {
    beforeEach(() => {
      (whatsAppIntegrationRepo as any).findByPhoneNumberId = mock(async (_phoneId: string) => ({
        id: "int_1",
        organizationId: MOCK_ORG_ID,
        phoneNumberId: "1336347369564093",
        accountId: "1419201293498643",
        accessToken: "EAABmockAccessToken123",
      } as any));
    });

    it("should create CRM Lead when no active lead exists for the sender phone number", async () => {
      let createLeadCalled = false;

      // Mock prisma.lead.findFirst to return null (no existing lead)
      (prisma as any).lead.findFirst = mock(async () => null);

      // Mock leadService.createLead
      (leadService as any).createLead = mock(async (orgId: string, input: any) => {
        createLeadCalled = true;
        expect(orgId).toBe(MOCK_ORG_ID);
        expect(input.customer.phone).toBe("+916202999356");
        expect(input.customer.firstName).toBe("Amit");
        expect(input.customer.lastName).toBe("Kumar");
        return {
          id: MOCK_LEAD_ID,
          leadCode: "LD-2026-0001",
          organizationId: orgId,
          title: input.title,
        } as any;
      });

      // Mock conversation lookup and create
      (prisma as any).conversation.findFirst = mock(async () => null);
      (prisma as any).conversation.create = mock(async (args: any) => ({
        id: MOCK_CONV_ID,
        organizationId: MOCK_ORG_ID,
        recipientPhone: "+916202999356",
        leadId: MOCK_LEAD_ID,
        ...args.data,
      } as any));

      (prisma as any).chatMessage.findFirst = mock(async () => null);
      (prisma as any).chatMessage.create = mock(async (args: any) => ({
        id: "msg_1",
        conversationId: MOCK_CONV_ID,
        ...args.data,
      } as any));

      (prisma as any).conversation.update = mock(async () => ({} as any));

      // Simulate incoming WhatsApp message from a brand new contact
      await whatsAppWebhookService.processWebhookEvent({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1419201293498643",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "15556382076",
                    phone_number_id: "1336347369564093",
                  },
                  contacts: [
                    {
                      profile: { name: "Amit Kumar" },
                      wa_id: "916202999356",
                    },
                  ],
                  messages: [
                    {
                      from: "916202999356",
                      id: "wamid.HBgMOTE2MjAyOTk5MzU2FQIAEhgWM0VCMEQwMjlGQjZGOUEzMTM4QkM2QQA=",
                      timestamp: "1791115553",
                      text: { body: "Hello, I am interested in interior design for 3BHK" },
                      type: "text",
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(createLeadCalled).toBe(true);
    });

    it("should NOT create a duplicate lead when an active lead already exists for that number", async () => {
      let createLeadCalled = false;

      // Mock prisma.lead.findFirst to return an existing active lead
      (prisma as any).lead.findFirst = mock(async () => ({
        id: "existing_lead_999",
        leadCode: "LD-2026-0999",
        organizationId: MOCK_ORG_ID,
        customer: {
          phone: "+916202999356",
          firstName: "Amit",
          lastName: "Kumar",
        },
      } as any));

      (leadService as any).createLead = mock(async () => {
        createLeadCalled = true;
        return {} as any;
      });

      (prisma as any).conversation.findFirst = mock(async () => ({
        id: MOCK_CONV_ID,
        organizationId: MOCK_ORG_ID,
        leadId: "existing_lead_999",
        recipientPhone: "+916202999356",
      } as any));

      (prisma as any).chatMessage.findFirst = mock(async () => null);
      (prisma as any).chatMessage.create = mock(async (args: any) => ({
        id: "msg_2",
        conversationId: MOCK_CONV_ID,
        ...args.data,
      } as any));

      (prisma as any).conversation.update = mock(async () => ({} as any));

      // Simulate second incoming message from same customer
      await whatsAppWebhookService.processWebhookEvent({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1419201293498643",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "15556382076",
                    phone_number_id: "1336347369564093",
                  },
                  contacts: [
                    {
                      profile: { name: "Amit Kumar" },
                      wa_id: "916202999356",
                    },
                  ],
                  messages: [
                    {
                      from: "916202999356",
                      id: "wamid.HBgMOTE2MjAyOTk5MzU2FQIAEhgWM0VCMEQwMjlGQjZGOUEzMTM4QkM2QQA_2",
                      timestamp: "1791115599",
                      text: { body: "Can we schedule a call tomorrow?" },
                      type: "text",
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      // Verification: leadService.createLead was NOT called because lead already existed
      expect(createLeadCalled).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: Webhook Delivery Status Receipts
  // =========================================================================
  describe("Suite 4: Delivery & Read Status Synchronization", () => {
    it("should process delivery and read statuses without error", async () => {
      let updatedStatus: string | null = null;

      (prisma as any).chatMessage.updateMany = mock(async (args: any) => {
        updatedStatus = args.data.status;
        return { count: 1 };
      });

      (prisma as any).chatMessage.findFirst = mock(async () => ({
        id: "msg_123",
        conversationId: MOCK_CONV_ID,
      } as any));

      // Simulate Meta status webhook payload
      await whatsAppWebhookService.processWebhookEvent({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "1419201293498643",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: "15556382076",
                    phone_number_id: "1336347369564093",
                  },
                  statuses: [
                    {
                      id: "wamid.HBgMOTE2MjAyOTk5MzU2FQIAEhgWM0VCMEQwMjlGQjZGOUEzMTM4QkM2QQA=",
                      status: "read",
                      timestamp: "1791115600",
                      recipient_id: "916202999356",
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      expect(String(updatedStatus)).toBe("READ");
    });
  });

  // =========================================================================
  // SUITE 5: WebSocket Event Types & Presence
  // =========================================================================
  describe("Suite 5: Real-Time WebSocket Event Contract", () => {
    it("should contain all required event types for live UI sync", () => {
      expect(String(WebSocketEventType.MESSAGE_RECEIVED)).toBe("MESSAGE_RECEIVED");
      expect(String(WebSocketEventType.MESSAGE_SENT)).toBe("MESSAGE_SENT");
      expect(String(WebSocketEventType.NOTE_ADDED)).toBe("NOTE_ADDED");
      expect(String(WebSocketEventType.MESSAGE_STATUS_UPDATED)).toBe("MESSAGE_STATUS_UPDATED");
      expect(String(WebSocketEventType.CONVERSATION_UPDATED)).toBe("CONVERSATION_UPDATED");
      expect(String(WebSocketEventType.CONVERSATION_CREATED)).toBe("CONVERSATION_CREATED");
      expect(String(WebSocketEventType.CONVERSATION_ASSIGNED)).toBe("CONVERSATION_ASSIGNED");
      expect(String(WebSocketEventType.CONVERSATION_READ)).toBe("CONVERSATION_READ");
      expect(String(WebSocketEventType.TYPING_START)).toBe("TYPING_START");
      expect(String(WebSocketEventType.TYPING_STOP)).toBe("TYPING_STOP");
    });
  });
});
