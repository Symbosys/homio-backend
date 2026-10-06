import { describe, expect, it, mock, beforeEach } from "bun:test";
import {
  serializeToToon,
  countWords,
  truncateToWordLimit,
  updateConversationMemorySummary,
} from "../../src/ai/utils/toon.serializer.js";
import {
  AI_REPLY_QUEUE_NAME,
  aiReplyQueue,
  addAiReplyJob,
} from "../../src/queues/ai/ai-reply.queue.js";
import { processAiReplyJob } from "../../src/workers/ai/ai-reply.worker.js";
import { processInboundMessage } from "../../src/workers/webhook/whatsapp-webhook.worker.js";
import { prisma } from "../../src/lib/prisma.js";
import { whatsAppIntegrationRepo } from "../../src/module/integration/repos/whatsapp-integration.repo.js";
import { metaWhatsAppService } from "../../src/module/communication/services/meta-whatsapp.service.js";
import { chatMessageRepo } from "../../src/module/communication/repos/chat-message.repo.js";
import { conversationRepo } from "../../src/module/communication/repos/conversation.repo.js";
import { ragService } from "../../src/ai/rag.service.js";
import { wsService } from "../../src/lib/websocket/ws.service.js";
import { WebSocketEventType } from "../../src/lib/websocket/ws.types.js";
import {
  ChannelIntegrationStatus,
  ConversationHandlingMode,
  ConversationStatus,
  MessageDirection,
  MessageSenderType,
} from "../../src/types/types.js";


const TEST_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const TEST_CONV_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const TEST_LEAD_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

describe("Autonomous AI WhatsApp Reply Queue & Worker Test Suite", () => {
  // =========================================================================
  // 1. TOON Serializer & Memory Management Tests
  // =========================================================================
  describe("TOON (Token-Oriented Object Notation) Serializer & Word Limit", () => {
    it("should serialize nested objects into compact, token-efficient TOON format", () => {
      const input = {
        customer: {
          name: "Rajesh Sharma",
          phone: "+919876543210",
        },
        lead: {
          code: "LD-2026-0088",
          status: "NEW",
          budget: "30 Lakhs",
          property: "3BHK Rustomjee Elements (Mumbai)",
          funnel: "Luxury Residential Interiors",
        },
      };

      const toonOutput = serializeToToon(input);

      // Verify no JSON syntactic waste (curly braces, double quotes around keys, commas)
      expect(toonOutput).toContain("CUSTOMER");
      expect(toonOutput).toContain("name: Rajesh Sharma");
      expect(toonOutput).toContain("phone: +919876543210");
      expect(toonOutput).toContain("LEAD");
      expect(toonOutput).toContain("code: LD-2026-0088");
      expect(toonOutput).toContain("budget: 30 Lakhs");
      expect(toonOutput).not.toContain("{");
      expect(toonOutput).not.toContain("}");
      expect(toonOutput).not.toContain('":');
    });

    it("should accurately count words and enforce maximum 1000 - 1500 words ceiling", () => {
      const shortText = "Hello, this is a short conversational summary.";
      expect(countWords(shortText)).toBe(7);

      // Generate 1600 words text
      const wordList = Array.from({ length: 1600 }, (_, i) => `word${i}`);
      const longText = wordList.join(" ");

      expect(countWords(longText)).toBe(1600);

      const truncated = truncateToWordLimit(longText, 1200);
      const truncatedWordCount = countWords(truncated);

      // Should be strictly <= 1206 words including truncation prefix
      expect(truncatedWordCount).toBeLessThanOrEqual(1210);
      expect(truncated).toContain("[Earlier conversation history summarized]");
    });

    it("should incrementally update conversation summary without blowing token ceiling", () => {
      const initialSummary = "Conversation Key Points:\n• [10:00 AM] Customer asked for modern Italian kitchen catalog.";
      const latestMessage = "Can you send the pricing for acrylic vs PU finish?";
      const aiReply = "Acrylic finishes range from ₹1,800 to ₹2,400 per sq.ft., while PU finishes range from ₹2,500 to ₹3,500 per sq.ft.";

      const updated = updateConversationMemorySummary(initialSummary, latestMessage, aiReply, 1200);

      expect(updated).toContain("modern Italian kitchen catalog");
      expect(updated).toContain("acrylic vs PU finish");
      expect(updated).toContain("Acrylic finishes range");
      expect(countWords(updated)).toBeLessThan(1200);
    });
  });

  // =========================================================================
  // 2. AI Reply Queue & 3-Second Delay Verification
  // =========================================================================
  describe("AI Reply BullMQ Queue Configuration", () => {
    it("should have correct queue name and add job with 3-second delay", async () => {
      expect(AI_REPLY_QUEUE_NAME).toBe("ai-reply");
      expect(aiReplyQueue.name).toBe("ai-reply");

      const addSpy = mock(async (_name, _data, opts) => {
        expect(opts?.delay).toBe(3000);
        expect(opts?.jobId).toBe(`ai_reply_${TEST_CONV_ID}_msg_12345`);
        return {} as any;
      });

      aiReplyQueue.add = addSpy;

      await addAiReplyJob({
        organizationId: TEST_ORG_ID,
        conversationId: TEST_CONV_ID,
        incomingMessageId: "msg_12345",
        incomingMessageText: "What are your interior packages?",
        senderPhone: "+919876543210",
        senderName: "Rajesh",
        leadId: TEST_LEAD_ID,
        enqueuedAt: new Date().toISOString(),
      });

      expect(addSpy).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Autonomous AI Reply Worker Execution Tests
  // =========================================================================
  describe("AI Reply Worker Processing (processAiReplyJob)", () => {
    it("should skip auto-reply when conversation is in MANUAL_HUMAN mode", async () => {
      let generateCalled = false;

      (prisma as any).conversation.findUnique = mock(async () => ({
        id: TEST_CONV_ID,
        organizationId: TEST_ORG_ID,
        handlingMode: ConversationHandlingMode.MANUAL_HUMAN,
        status: ConversationStatus.OPEN,
        isDeleted: false,
      } as any));

      ragService.generateWhatsAppReply = mock(async () => {
        generateCalled = true;
        return {} as any;
      });

      await processAiReplyJob({
        id: "job_test_1",
        data: {
          organizationId: TEST_ORG_ID,
          conversationId: TEST_CONV_ID,
          incomingMessageId: "msg_1",
          incomingMessageText: "Hello human agent",
          senderPhone: "+919876543210",
          enqueuedAt: new Date().toISOString(),
        },
      } as any);

      expect(generateCalled).toBe(false);
    });

    it("should execute RAG, dispatch Meta WhatsApp message, save to DB, and update aiSummary when in AI_AUTONOMOUS mode", async () => {
      let metaDispatched = false;
      let chatMessageCreated = false;
      let summaryUpdated = false;
      const emittedEvents: Array<{ type: WebSocketEventType; payload: any }> = [];

      // Mock conversation in AI_AUTONOMOUS mode
      (prisma as any).conversation.findUnique = mock(async () => ({
        id: TEST_CONV_ID,
        organizationId: TEST_ORG_ID,
        handlingMode: ConversationHandlingMode.AI_AUTONOMOUS,
        status: ConversationStatus.OPEN,
        recipientPhone: "+919876543210",
        recipientName: "Rajesh Sharma",
        aiSummary: "Previous conversation: Customer interested in 3BHK design.",
        leadId: TEST_LEAD_ID,
        lead: {
          id: TEST_LEAD_ID,
          leadCode: "LD-2026-0088",
          title: "Inquiry from Rajesh",
          status: "NEW",
          priority: "HIGH",
          projectType: "RESIDENTIAL",
          budgetLakh: 35,
          propertyName: "Rustomjee Elements",
          propertyCity: "Mumbai",
          leadFunnel: { name: "Luxury Funnel" },
          leadFunnelId: "funnel-123",
        },
        isDeleted: false,
      } as any));

      // Mock active WhatsApp integration
      whatsAppIntegrationRepo.findByOrganizationId = mock(async () => ({
        id: "int_1",
        organizationId: TEST_ORG_ID,
        status: ChannelIntegrationStatus.ACTIVE,
        phoneNumberId: "phone_num_123",
        accessToken: "EAABmockToken",
      } as any));

      // Mock recent chat messages
      (prisma as any).chatMessage.findMany = mock(async () => [
        {
          id: "msg_prev",
          direction: MessageDirection.INCOMING,
          content: "Hi, I need 3BHK turnkey interior design",
        },
      ] as any);

      // Mock RAG reply generation
      ragService.generateWhatsAppReply = mock(async (orgId, query, opts) => {
        expect(orgId).toBe(TEST_ORG_ID);
        expect(query).toBe("Do you provide 10-year warranty on modular woodwork?");
        expect(opts.toonContext).toContain("CUSTOMER");
        expect(opts.toonContext).toContain("Rajesh Sharma");
        expect(opts.toonContext).toContain("Rustomjee Elements");
        expect(opts.conversationSummary).toContain("interested in 3BHK design");
        return {
          text: "Yes! We offer a flat 10-year warranty on all factory-manufactured modular woodwork and hardware.",
          sources: [{ id: "src_1", title: "Warranty Policy", type: "FAQ" as any, similarityScore: 0.92 }],
          confidence: 0.95,
          modelUsed: { provider: "OPENAI" as any, modelKey: "gpt-4o-mini" },
        };
      });

      // Mock Meta dispatch
      metaWhatsAppService.dispatchMessageToMeta = mock(async (phoneId, token, payload) => {
        expect(phoneId).toBe("phone_num_123");
        expect(token).toBe("EAABmockToken");
        expect((payload as any).to).toBe("919876543210");
        expect((payload as any).text.body).toContain("10-year warranty");
        metaDispatched = true;
        return { messages: [{ id: "wamid.meta_ai_outbound_123" }] } as any;
      });

      // Mock chat message persistence
      chatMessageRepo.create = mock(async (msgData: any) => {
        expect(msgData.conversationId).toBe(TEST_CONV_ID);
        expect(msgData.senderType).toBe(MessageSenderType.AI_BOT);
        expect(msgData.direction).toBe(MessageDirection.OUTGOING);
        expect(msgData.externalMessageId).toBe("wamid.meta_ai_outbound_123");
        expect(msgData.aiGenerated).toBe(true);
        chatMessageCreated = true;
        return { id: "ai_chat_msg_1", ...msgData };
      });

      // Mock conversation update
      (prisma as any).conversation.update = mock(async (args: any) => {
        expect(args.where.id).toBe(TEST_CONV_ID);
        expect(args.data.lastMessageDirection).toBe(MessageDirection.OUTGOING);
        expect(args.data.aiSummary).toContain("10-year warranty");
        summaryUpdated = true;
        return {} as any;
      });

      conversationRepo.findById = mock(async () => ({ id: TEST_CONV_ID } as any));

      // Mock WebSocket broadcasts
      wsService.broadcastToConversation = mock((_convId, type, payload) => {
        emittedEvents.push({ type, payload });
      });
      wsService.broadcastToOrganization = mock((_orgId, type, payload) => {
        emittedEvents.push({ type, payload });
      });

      // Execute worker
      await processAiReplyJob({
        id: "job_ai_1",
        data: {
          organizationId: TEST_ORG_ID,
          conversationId: TEST_CONV_ID,
          incomingMessageId: "msg_user_1",
          incomingMessageText: "Do you provide 10-year warranty on modular woodwork?",
          senderPhone: "+919876543210",
          senderName: "Rajesh Sharma",
          leadId: TEST_LEAD_ID,
          enqueuedAt: new Date().toISOString(),
        },
      } as any);

      expect(metaDispatched).toBe(true);
      expect(chatMessageCreated).toBe(true);
      expect(summaryUpdated).toBe(true);
      expect(emittedEvents.some((e) => e.type === WebSocketEventType.MESSAGE_RECEIVED)).toBe(true);
      expect(emittedEvents.some((e) => e.type === WebSocketEventType.CONVERSATION_UPDATED)).toBe(true);
    });
  });

  // =========================================================================
  // 4. Webhook Worker Conditional Trigger Tests
  // =========================================================================
  describe("Webhook Worker Triggering AI Reply Queue", () => {
    it("should enqueue AI reply job with 3-second delay when conversation is AI_AUTONOMOUS", async () => {
      let aiJobEnqueued = false;

      // Mock lead lookup (exists)
      (prisma as any).lead.findFirst = mock(async () => ({
        id: TEST_LEAD_ID,
        leadCode: "LD-2026-0001",
        customer: { phone: "+919876543210" },
      } as any));

      // Mock conversation lookup in AI_AUTONOMOUS mode
      conversationRepo.findByRecipientPhone = mock(async () => ({
        id: TEST_CONV_ID,
        organizationId: TEST_ORG_ID,
        handlingMode: ConversationHandlingMode.AI_AUTONOMOUS,
        leadId: TEST_LEAD_ID,
      } as any));

      chatMessageRepo.findByExternalMessageId = mock(async () => null);
      chatMessageRepo.create = mock(async () => ({ id: "msg_new_1" } as any));
      conversationRepo.recordInboundMessage = mock(async () => ({} as any));
      conversationRepo.findById = mock(async () => ({ id: TEST_CONV_ID } as any));

      aiReplyQueue.add = mock(async (jobName, data, opts) => {
        expect(jobName).toBe("process_ai_reply");
        expect(opts?.delay).toBe(3000);
        expect(data.incomingMessageText).toBe("What is your design fee?");
        aiJobEnqueued = true;
        return {} as any;
      });

      await processInboundMessage({
        jobType: "INBOUND_MESSAGE",
        organizationId: TEST_ORG_ID,
        message: {
          id: "wamid_inbound_test",
          from: "919876543210",
          timestamp: String(Math.floor(Date.now() / 1000)),
          text: { body: "What is your design fee?" },
          type: "text",
        },
        contacts: [{ profile: { name: "Rajesh" }, wa_id: "919876543210" }],
        receivedAt: new Date().toISOString(),
      });

      expect(aiJobEnqueued).toBe(true);
    });

    it("should NOT enqueue AI reply job when conversation is in MANUAL_HUMAN mode", async () => {
      let aiJobEnqueued = false;

      (prisma as any).lead.findFirst = mock(async () => ({
        id: TEST_LEAD_ID,
        leadCode: "LD-2026-0001",
        customer: { phone: "+919876543210" },
      } as any));

      conversationRepo.findByRecipientPhone = mock(async () => ({
        id: TEST_CONV_ID,
        organizationId: TEST_ORG_ID,
        handlingMode: ConversationHandlingMode.MANUAL_HUMAN,
        leadId: TEST_LEAD_ID,
      } as any));

      chatMessageRepo.findByExternalMessageId = mock(async () => null);
      chatMessageRepo.create = mock(async () => ({ id: "msg_new_2" } as any));
      conversationRepo.recordInboundMessage = mock(async () => ({} as any));
      conversationRepo.findById = mock(async () => ({ id: TEST_CONV_ID } as any));

      aiReplyQueue.add = mock(async () => {
        aiJobEnqueued = true;
        return {} as any;
      });

      await processInboundMessage({
        jobType: "INBOUND_MESSAGE",
        organizationId: TEST_ORG_ID,
        message: {
          id: "wamid_inbound_test_2",
          from: "919876543210",
          timestamp: String(Math.floor(Date.now() / 1000)),
          text: { body: "Can I speak to an architect?" },
          type: "text",
        },
        contacts: [{ profile: { name: "Rajesh" }, wa_id: "919876543210" }],
        receivedAt: new Date().toISOString(),
      });

      expect(aiJobEnqueued).toBe(false);
    });

  });
});
