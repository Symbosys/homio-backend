import { describe, expect, it } from "bun:test";
import {
  CreateKnowledgeSourceSchema,
  UpdateKnowledgeSourceSchema,
  CreateKnowledgeFaqSchema,
  UpdateKnowledgeFaqSchema,
  CreateGoldenConversationSchema,
  UpdateGoldenConversationSchema,
  UpsertGuardrailConfigSchema,
  TestAiQuerySchema,
} from "../../src/module/ai-training/validators/ai-training.validator.js";
import { vectorStoreService } from "../../src/ai/vector-store.service.js";
import { ragService } from "../../src/ai/rag.service.js";
import {
  AiCompetitorPolicy,
  AiConversationRole,
  AiSourceType,
} from "../../src/types/types.js";

const TEST_ORG_ID = "11111111-2222-3333-4444-555555555555";

describe("AI Training Module - Unit & Integration Test Suite", () => {
  describe("1. Validator Schema Tests", () => {
    it("should validate a valid Knowledge Source payload", () => {
      const payload = {
        title: "Homio Company Policy & Offerings",
        type: AiSourceType.RAW_TEXT,
        category: "Corporate",
        rawContent: "Homio is an ultra-luxury bespoke interior design studio offering end-to-end turnkey execution.",
        additionalInformation: { author: "Admin", reviewPeriod: "Quarterly" },
        autoIndex: true,
      };

      const result = CreateKnowledgeSourceSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Homio Company Policy & Offerings");
        expect(result.data.type).toBe(AiSourceType.RAW_TEXT);
        expect(result.data.category).toBe("Corporate");
      }
    });

    it("should validate Knowledge Source with optional leadFunnelId linkage", () => {
      const payload = {
        title: "Kitchen Catalog Funnel Dataset",
        type: AiSourceType.DOCUMENT,
        leadFunnelId: "11111111-2222-4444-8888-555555555555",
        category: "Catalog",
        rawContent: "Custom modular kitchen catalogue details.",
      };

      const result = CreateKnowledgeSourceSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.leadFunnelId).toBe("11111111-2222-4444-8888-555555555555");
      }
    });

    it("should reject Knowledge Source with invalid sourceUrl", () => {
      const payload = {
        title: "Invalid URL Source",
        type: AiSourceType.WEBSITE,
        sourceUrl: "not-a-valid-url",
      };

      const result = CreateKnowledgeSourceSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should validate FAQ payload with tags and additionalInformation", () => {
      const payload = {
        category: "Pricing & Quotation",
        question: "What is the minimum budget for a 3BHK project?",
        answer: "Our turnkey luxury design projects start at 15 Lakhs INR.",
        tags: ["pricing", "budget", "3bhk"],
        sortOrder: 1,
        additionalInformation: { verifiedBy: "Sales Head" },
      };

      const result = CreateKnowledgeFaqSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.question).toContain("minimum budget");
        expect(result.data.tags).toHaveLength(3);
      }
    });

    it("should reject FAQ payload missing question or answer", () => {
      const payload = {
        category: "Pricing",
        question: "",
        answer: "Something",
      };

      const result = CreateKnowledgeFaqSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should validate Golden Conversation with dialogue turns", () => {
      const payload = {
        title: "Budget Handling & Premium Positioning",
        scenario: "Client asks why prices are higher than local contractors",
        category: "Sales Objection Handling",
        turns: [
          {
            role: AiConversationRole.USER,
            content: "Why should I choose Homio when local carpenters charge 30% less?",
            turnOrder: 1,
          },
          {
            role: AiConversationRole.ASSISTANT,
            content:
              "Homio provides guaranteed 10-year structural warranties, precision German machinery finishes, fixed-timeline execution with delay penalties, and zero hidden price escalation.",
            turnOrder: 2,
          },
        ],
        additionalInformation: { difficulty: "Medium" },
      };

      const result = CreateGoldenConversationSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.turns).toHaveLength(2);
        expect(result.data.turns[0]?.role).toBe(AiConversationRole.USER);
        expect(result.data.turns[1]?.role).toBe(AiConversationRole.ASSISTANT);
      }
    });

    it("should reject Golden Conversation with empty turns", () => {
      const payload = {
        title: "Empty Turns Exemplar",
        scenario: "Test scenario",
        turns: [],
      };

      const result = CreateGoldenConversationSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should validate Guardrail Config payload", () => {
      const payload = {
        minBudgetLakh: 12.5,
        maxDiscountPercentage: 8,
        competitorPolicy: AiCompetitorPolicy.BLOCK_AND_REDIRECT,
        restrictedKeywords: ["free work", "unlicensed drawings", "cash only"],
        humanEscalationKeywords: ["talk to manager", "lawyer", "escalate dispute", "refund"],
        enableDisclaimerOnQuotes: true,
        disclaimerText: "All estimates are preliminary and subject to detailed site measurement.",
        additionalInformation: { strictMode: true },
      };

      const result = UpsertGuardrailConfigSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minBudgetLakh).toBe(12.5);
        expect(result.data.maxDiscountPercentage).toBe(8);
        expect(result.data.restrictedKeywords).toContain("cash only");
        expect(result.data.competitorPolicy).toBe(AiCompetitorPolicy.BLOCK_AND_REDIRECT);
      }
    });

    it("should validate Test Query simulation payload", () => {
      const payload = {
        query: "What materials do you use for modular kitchen carcasses?",
        similarityThreshold: 0.45,
        maxChunks: 4,
        systemTone: "Ultra-luxurious, consultative, and polite",
      };

      const result = TestAiQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toContain("modular kitchen");
        expect(result.data.similarityThreshold).toBe(0.45);
        expect(result.data.maxChunks).toBe(4);
      }
    });
  });

  describe("2. Vector Store Text Splitter Engine", () => {
    it("should split long text into structured chunks of configured size with token estimates", () => {
      const text = `
        Section 1: Company Profile.
        Homio CRM is an enterprise grade multi-tenant luxury interior design software suite.
        It manages leads, automated quotations, milestone billing, site schedules, and 3D architectural renders.

        Section 2: Material Specifications.
        All kitchen cabinets are fabricated with HDHMR IS 12046 grade water-resistant boards.
        Hardware fittings are strictly sourced from Blum, Hettich, and Hafele with soft-close hinges.

        Section 3: Warranty and Guarantee Terms.
        Homio offers a 10-year comprehensive warranty on all structural cabinetry and 5-year warranty on surface veneers.
      `;

      const chunks = vectorStoreService.splitText(text, { chunkSize: 200, chunkOverlap: 40 });
      expect(chunks.length).toBeGreaterThanOrEqual(2);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        expect(chunk).toBeDefined();
        if (chunk) {
          expect(chunk.chunkIndex).toBe(i);
          expect(chunk.chunkText.length).toBeGreaterThan(0);
          expect(chunk.tokenCount).toBeGreaterThan(0);
        }
      }
    });

    it("should return empty array when splitting empty text", () => {
      const chunks = vectorStoreService.splitText("   ");
      expect(chunks).toHaveLength(0);
    });
  });

  describe("3. BYOK Credential Enforcement & Isolation", () => {
    it("should reject embedding or inference requests when no active BYOK credential exists for tenant", async () => {
      const nonExistentOrg = "00000000-0000-0000-0000-000000000000";

      // Must throw an ErrorResponse stating no verified active API key found (NEVER falling back to .env)
      expect(async () => {
        await vectorStoreService.getTenantEmbeddingClient(nonExistentOrg);
      }).toThrow();
    });

    it("should reject RAG chat model requests when no active BYOK credential exists for tenant", async () => {
      const nonExistentOrg = "00000000-0000-0000-0000-000000000000";

      expect(async () => {
        await ragService.getTenantChatClient(nonExistentOrg);
      }).toThrow();
    });
  });
});
