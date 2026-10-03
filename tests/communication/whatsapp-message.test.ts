import { describe, expect, it, mock } from "bun:test";
import { whatsAppMessageService } from "../../src/module/communication/services/whatsapp-message.service.js";
import {
  phoneNumberSchema,
  sendWhatsAppCustomMessageSchema,
  sendWhatsAppTemplateMessageSchema,
} from "../../src/module/communication/validators/whatsapp-message.validator.js";
import {
  ChannelIntegrationStatus,
  ChannelProvider,
  CrmMappingEntity,
  WhatsAppHeaderType,
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
  WhatsAppVariableComponent,
} from "../../src/types/types.js";

const MOCK_ORG_A = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MOCK_ORG_B = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const MOCK_TEMPLATE_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const MOCK_LEAD_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

describe("WhatsApp Message Dispatch API Tests (Template & Custom Messages)", () => {
  // =========================================================================
  // 1. Validator Tests: Phone Number Normalization & Validation
  // =========================================================================
  describe("Phone Number Normalization & Validation", () => {
    it("should accept and normalize valid international phone numbers", () => {
      const parsed1 = phoneNumberSchema.safeParse("+91 98765-43210");
      expect(parsed1.success).toBe(true);
      if (parsed1.success) {
        expect(parsed1.data).toBe("+919876543210");
      }

      const parsed2 = phoneNumberSchema.safeParse("919876543210");
      expect(parsed2.success).toBe(true);
      if (parsed2.success) {
        expect(parsed2.data).toBe("919876543210");
      }
    });

    it("should reject invalid phone numbers", () => {
      const invalidShort = phoneNumberSchema.safeParse("1234");
      expect(invalidShort.success).toBe(false);

      const invalidChars = phoneNumberSchema.safeParse("phone-number-abc");
      expect(invalidChars.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Validator Tests: Send Template Message Schema
  // =========================================================================
  describe("POST /api/v1/communication/messages/template (Validation)", () => {
    it("should validate a complete template message payload with contextual IDs", () => {
      const parsed = sendWhatsAppTemplateMessageSchema.safeParse({
        body: {
          to: "+91 98765 43210",
          templateId: MOCK_TEMPLATE_ID,
          language: "en_US",
          mediaUrl: "https://storage.googleapis.com/homio/banner.jpg",
          context: {
            leadId: MOCK_LEAD_ID,
            customOverrides: {
              "{{1}}": "Vikram",
            },
          },
        },
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.body.to).toBe("+919876543210");
        expect(parsed.data.body.templateId).toBe(MOCK_TEMPLATE_ID);
        expect(parsed.data.body.context?.leadId).toBe(MOCK_LEAD_ID);
        expect(parsed.data.body.context?.customOverrides?.["{{1}}"]).toBe("Vikram");
      }
    });

    it("should allow dispatching by templateName when templateId is omitted", () => {
      const parsed = sendWhatsAppTemplateMessageSchema.safeParse({
        body: {
          to: "919876543210",
          templateName: "project_milestone_completed",
        },
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.body.templateName).toBe("project_milestone_completed");
      }
    });

    it("should reject when both templateId and templateName are missing", () => {
      const parsed = sendWhatsAppTemplateMessageSchema.safeParse({
        body: {
          to: "919876543210",
        },
      });

      expect(parsed.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Validator Tests: Send Custom Direct Message Schema
  // =========================================================================
  describe("POST /api/v1/communication/messages/custom (Validation)", () => {
    it("should validate a valid text message payload", () => {
      const parsed = sendWhatsAppCustomMessageSchema.safeParse({
        body: {
          to: "+919876543210",
          messageType: "text",
          text: "Hello, your designer has updated your interior floorplan.",
          previewUrl: true,
        },
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.body.messageType).toBe("text");
        expect(parsed.data.body.text).toBe(
          "Hello, your designer has updated your interior floorplan."
        );
      }
    });

    it("should reject a text message when text body is missing or empty", () => {
      const parsed = sendWhatsAppCustomMessageSchema.safeParse({
        body: {
          to: "+919876543210",
          messageType: "text",
          text: "",
        },
      });

      expect(parsed.success).toBe(false);
    });

    it("should validate an image message payload with mediaUrl and caption", () => {
      const parsed = sendWhatsAppCustomMessageSchema.safeParse({
        body: {
          to: "+919876543210",
          messageType: "image",
          mediaUrl: "https://storage.googleapis.com/homio/render.jpg",
          caption: "3D Visualisation for Living Room",
        },
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.body.messageType).toBe("image");
        expect(parsed.data.body.mediaUrl).toBe(
          "https://storage.googleapis.com/homio/render.jpg"
        );
        expect(parsed.data.body.caption).toBe("3D Visualisation for Living Room");
      }
    });

    it("should reject a media message when mediaUrl is missing", () => {
      const parsed = sendWhatsAppCustomMessageSchema.safeParse({
        body: {
          to: "+919876543210",
          messageType: "document",
          caption: "Contract PDF",
        },
      });

      expect(parsed.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Service Tests: Template Message Dispatch Engine
  // =========================================================================
  describe("WhatsAppMessageService.sendTemplateMessage", () => {
    it("should reject when active WhatsApp integration credentials are not configured", async () => {
      mock.restore();
      mock.module("../../src/module/integration/repos/whatsapp-integration.repo.js", () => ({
        whatsAppIntegrationRepo: {
          findByOrganizationId: mock(async () => null),
        },
      }));

      expect(
        whatsAppMessageService.sendTemplateMessage(MOCK_ORG_A, {
          to: "+919876543210",
          templateName: "sample_template",
        })
      ).rejects.toThrow("Cannot send WhatsApp message: Active WhatsApp Business Integration credentials not configured");
    });

    it("should compile Meta template components and dispatch message successfully", async () => {
      mock.restore();

      // Mock integration repo
      mock.module("../../src/module/integration/repos/whatsapp-integration.repo.js", () => ({
        whatsAppIntegrationRepo: {
          findByOrganizationId: mock(async () => ({
            id: "int-123",
            organizationId: MOCK_ORG_A,
            provider: ChannelProvider.WHATSAPP,
            status: ChannelIntegrationStatus.ACTIVE,
            phoneNumberId: "phone-id-456",
            accessToken: "valid-meta-token",
          })),
        },
      }));

      // Mock template repo
      mock.module("../../src/module/communication/repos/whatsapp-template.repo.js", () => ({
        whatsAppTemplateRepo: {
          findById: mock(async () => ({
            id: MOCK_TEMPLATE_ID,
            organizationId: MOCK_ORG_A,
            name: "site_visit_reminder",
            language: "en_US",
            category: WhatsAppTemplateCategory.UTILITY,
            status: WhatsAppTemplateStatus.APPROVED,
            headerType: WhatsAppHeaderType.IMAGE,
            headerText: null,
            headerMedia: {
              id: "media-1",
              url: "https://storage.googleapis.com/homio/sample.jpg",
              bytes: 50000,
              format: "image/jpeg",
              provider: "LOCAL",
            },
            bodyText: "Hello {{1}}, your site inspection for {{2}} is confirmed for tomorrow.",
            footerText: "Homio Support",
            buttons: null,
            variables: [
              {
                id: "v1",
                component: WhatsAppVariableComponent.BODY,
                position: 1,
                parameter: "{{1}}",
                mappingEntity: CrmMappingEntity.LEAD,
                mappingField: "fullName",
                fallbackValue: "Valued Client",
              },
              {
                id: "v2",
                component: WhatsAppVariableComponent.BODY,
                position: 2,
                parameter: "{{2}}",
                mappingEntity: CrmMappingEntity.PROJECT,
                mappingField: "name",
                fallbackValue: "your property",
              },
            ],
          })),
        },
      }));

      // Mock Meta Cloud API dispatch
      const dispatchMock = mock(async (_phoneId: string, _token: string, payload: Record<string, unknown>) => {
        expect(payload.to).toBe("919876543210");
        expect(payload.type).toBe("template");
        const tpl = payload.template as any;
        expect(tpl.name).toBe("site_visit_reminder");
        expect(tpl.components).toBeDefined();

        return {
          messaging_product: "whatsapp" as const,
          contacts: [{ input: "919876543210", wa_id: "919876543210" }],
          messages: [{ id: "wamid.HBgLMockMessageId12345" }],
        };
      });

      mock.module("../../src/module/communication/services/meta-whatsapp.service.js", () => ({
        metaWhatsAppService: {
          dispatchMessageToMeta: dispatchMock,
        },
      }));

      const result = await whatsAppMessageService.sendTemplateMessage(MOCK_ORG_A, {
        to: "+91 98765-43210",
        templateId: MOCK_TEMPLATE_ID,
        context: {
          customOverrides: {
            "{{1}}": "Vikram Malhotra",
            "{{2}}": "Villa 402 Palm Meadows",
          },
        },
      });

      expect(result.messageId).toBe("wamid.HBgLMockMessageId12345");
      expect(result.status).toBe("SENT");
      expect(result.recipient).toBe("919876543210");
      expect(result.templateName).toBe("site_visit_reminder");
      expect(result.renderedBody).toContain("Hello Vikram Malhotra");
      expect(result.renderedBody).toContain("Villa 402 Palm Meadows");
    });
  });

  // =========================================================================
  // 5. Service Tests: Custom Direct Message Dispatch Engine
  // =========================================================================
  describe("WhatsAppMessageService.sendCustomMessage", () => {
    it("should construct direct text payload and dispatch to Meta", async () => {
      mock.restore();

      mock.module("../../src/module/integration/repos/whatsapp-integration.repo.js", () => ({
        whatsAppIntegrationRepo: {
          findByOrganizationId: mock(async () => ({
            id: "int-123",
            organizationId: MOCK_ORG_A,
            provider: ChannelProvider.WHATSAPP,
            status: ChannelIntegrationStatus.ACTIVE,
            phoneNumberId: "phone-id-456",
            accessToken: "valid-meta-token",
          })),
        },
      }));

      const dispatchMock = mock(async (_phoneId: string, _token: string, payload: Record<string, unknown>) => {
        expect(payload.to).toBe("919876543210");
        expect(payload.type).toBe("text");
        const txt = payload.text as any;
        expect(txt.body).toBe("Your interior quote is ready!");

        return {
          messaging_product: "whatsapp" as const,
          contacts: [{ input: "919876543210", wa_id: "919876543210" }],
          messages: [{ id: "wamid.HBgLCustomMsgId9999" }],
        };
      });

      mock.module("../../src/module/communication/services/meta-whatsapp.service.js", () => ({
        metaWhatsAppService: {
          dispatchMessageToMeta: dispatchMock,
        },
      }));

      const result = await whatsAppMessageService.sendCustomMessage(MOCK_ORG_A, {
        to: "+91 98765-43210",
        messageType: "text",
        text: "Your interior quote is ready!",
      });

      expect(result.messageId).toBe("wamid.HBgLCustomMsgId9999");
      expect(result.status).toBe("SENT");
      expect(result.type).toBe("text");
      expect(result.recipient).toBe("919876543210");
    });
  });

  // =========================================================================
  // 6. Security & Multi-Tenant Isolation (Rule 1, 3)
  // =========================================================================
  describe("Multi-Tenant Security Checks", () => {
    it("should prevent dispatching templates across tenant boundaries", async () => {
      mock.restore();

      mock.module("../../src/module/integration/repos/whatsapp-integration.repo.js", () => ({
        whatsAppIntegrationRepo: {
          findByOrganizationId: mock(async () => ({
            id: "int-b",
            organizationId: MOCK_ORG_B,
            status: ChannelIntegrationStatus.ACTIVE,
            phoneNumberId: "phone-b",
            accessToken: "token-b",
          })),
        },
      }));

      // Template belongs to Org A, but Org B tries to send it
      mock.module("../../src/module/communication/repos/whatsapp-template.repo.js", () => ({
        whatsAppTemplateRepo: {
          findById: mock(async (orgId: string) => {
            // Strictly scoped query returns null if tenant does not match
            if (orgId !== MOCK_ORG_A) return null;
            return { id: MOCK_TEMPLATE_ID, organizationId: MOCK_ORG_A };
          }),
        },
      }));

      expect(
        whatsAppMessageService.sendTemplateMessage(MOCK_ORG_B, {
          to: "+919876543210",
          templateId: MOCK_TEMPLATE_ID,
        })
      ).rejects.toThrow("WhatsApp template");
    });
  });
});
