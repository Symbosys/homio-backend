import { describe, expect, it, mock } from "bun:test";
import { UpdateServiceRateSchema } from "../../src/module/ai-studio/validators/ai-studio.validator.js";
import { AiStudioPlatformService } from "../../src/module/ai-studio/services/ai-studio-platform.service.js";
import { DoubtSolverService } from "../../src/module/ai-studio/services/doubt-solver.service.js";
import { DoubtSolverChain } from "../../src/lib/langchain/chains/doubt-solver.chain.js";
import { VastuAuditChain } from "../../src/lib/langchain/chains/vastu-audit.chain.js";
import { RoomDesignChain } from "../../src/lib/langchain/chains/room-design.chain.js";
import { LlmFactory } from "../../src/lib/langchain/llm.factory.js";
import { AiServiceType } from "../../src/types/types.js";
import { prisma } from "../../src/lib/prisma.js";

describe("AI Service Rates & Dynamic Model Key Architecture Test Suite", () => {
  // =========================================================================
  // 1. Zod Validation & Schema Testing
  // =========================================================================
  describe("1. Zod Validation & Input Sanitization (UpdateServiceRateSchema)", () => {
    it("TC-01: Accepts valid service rate update with custom modelKey and system prompt", () => {
      const payload = {
        serviceType: AiServiceType.DOUBT_SOLVER,
        name: "AI Technical Assistant",
        defaultCreditCost: 5,
        billingUnit: "per query",
        description: "You are an expert structural engineer. Answer with precise material grades.",
        modelKey: "gpt-4o",
        isActive: true,
      };

      const parsed = UpdateServiceRateSchema.parse(payload);
      expect(parsed.serviceType).toBe(AiServiceType.DOUBT_SOLVER);
      expect(parsed.name).toBe("AI Technical Assistant");
      expect(parsed.defaultCreditCost).toBe(5);
      expect(parsed.modelKey).toBe("gpt-4o");
      expect(parsed.description).toContain("expert structural engineer");
    });

    it("TC-02: Defaults modelKey to gpt-4o-mini when omitted", () => {
      const payload = {
        serviceType: AiServiceType.VASTU_CONSULTATION,
        defaultCreditCost: 10,
        billingUnit: "per audit",
      };

      const parsed = UpdateServiceRateSchema.parse(payload);
      expect(parsed.modelKey).toBe("gpt-4o-mini");
    });

    it("TC-03: Allows any arbitrary model key string (including custom fine-tunes)", () => {
      const customFineTuneModel = "ft:gpt-4o-mini:homio-corp:custom-v2:123456";
      const payload = {
        serviceType: AiServiceType.ROOM_DESIGN,
        defaultCreditCost: 15,
        modelKey: customFineTuneModel,
      };

      const parsed = UpdateServiceRateSchema.parse(payload);
      expect(parsed.modelKey).toBe(customFineTuneModel);
    });

    it("TC-04: Rejects empty or whitespace-only modelKey", () => {
      const payload = {
        serviceType: AiServiceType.DOUBT_SOLVER,
        defaultCreditCost: 5,
        modelKey: "   ",
      };

      let thrownError: any = null;
      try {
        UpdateServiceRateSchema.parse(payload);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
    });

    it("TC-05: Rejects negative credit costs", () => {
      const payload = {
        serviceType: AiServiceType.DOUBT_SOLVER,
        defaultCreditCost: -5,
      };

      let thrownError: any = null;
      try {
        UpdateServiceRateSchema.parse(payload);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
    });
  });

  // =========================================================================
  // 2. Repository & Platform Service Upsert Tests
  // =========================================================================
  describe("2. Database Upsert & Retrieval (Repository & Platform Service)", () => {
    it("TC-06: Correctly maps and persists modelKey and description via upsertServiceRate", async () => {
      const originalUpsert = prisma.aiServiceRate.upsert;

      let capturedData: any = null;
      (prisma.aiServiceRate as any).upsert = mock(async (args: any) => {
        capturedData = args;
        return {
          id: "mock-rate-id",
          serviceType: args.where.serviceType,
          name: args.update.name || "AI Doubt Solver",
          defaultCreditCost: args.update.defaultCreditCost,
          billingUnit: args.update.billingUnit,
          description: args.update.description,
          modelKey: args.update.modelKey,
          isActive: args.update.isActive,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      try {
        const platformService = new AiStudioPlatformService();
        const result = await platformService.updateServiceRate(AiServiceType.DOUBT_SOLVER, {
          serviceType: AiServiceType.DOUBT_SOLVER,
          name: "Updated Doubt Solver",
          defaultCreditCost: 8,
          billingUnit: "per query",
          description: "Always adhere to standard IS:710 plywood specs.",
          modelKey: "o3-mini",
          isActive: true,
        });

        expect(capturedData).not.toBeNull();
        expect(capturedData.update.modelKey).toBe("o3-mini");
        expect(capturedData.update.description).toBe("Always adhere to standard IS:710 plywood specs.");
        expect(result.modelKey).toBe("o3-mini");
      } finally {
        (prisma.aiServiceRate as any).upsert = originalUpsert;
      }
    });

    it("TC-07: Default service rates array provides modelKey for all features", async () => {
      const originalFindMany = prisma.aiServiceRate.findMany;
      (prisma.aiServiceRate as any).findMany = mock(async () => []);

      try {
        const platformService = new AiStudioPlatformService();
        const rates = await platformService.getAllServiceRates();

        expect(rates.length).toBeGreaterThan(0);
        for (const r of rates) {
          expect(r.modelKey).toBeDefined();
          expect(typeof r.modelKey).toBe("string");
          expect(r.modelKey.length).toBeGreaterThan(0);
        }
      } finally {
        (prisma.aiServiceRate as any).findMany = originalFindMany;
      }
    });
  });

  // =========================================================================
  // 3. Dynamic Model Key & Prompt Propagation to Chains
  // =========================================================================
  describe("3. Dynamic Runtime Model & System Prompt Injection across Features", () => {
    it("TC-08: DoubtSolverChain passes dynamic modelKey to LLM provider", async () => {
      const provider = LlmFactory.getProvider("openai");
      const originalGenerate = provider.generate;

      let capturedOptions: any = null;
      provider.generate = mock(async (_messages: any, options: any) => {
        capturedOptions = options;
        return "1. Overview\n- **Point 1**: Description\n### Conclusion\nExecution tip";
      });

      try {
        await DoubtSolverChain.execute({
          question: "Which plywood grade for modular kitchen?",
          topicCategory: "Materials",
          intelligenceMode: "smart",
          customSystemPrompt: "Prioritize moisture resistance.",
          model: "gpt-4o",
        });

        expect(capturedOptions).not.toBeNull();
        expect(capturedOptions.model).toBe("gpt-4o");
        expect(capturedOptions.systemPrompt).toContain("Prioritize moisture resistance.");
      } finally {
        provider.generate = originalGenerate;
      }
    });

    it("TC-09: VastuAuditChain passes dynamic modelKey and jsonMode to OpenAI provider", async () => {
      const provider = LlmFactory.getProvider("openai");
      const originalGenerate = provider.generate;

      let capturedOptions: any = null;
      provider.generate = mock(async (_messages: any, options: any) => {
        capturedOptions = options;
        return JSON.stringify({
          overallScore: 85,
          complianceRating: "GOOD",
          summary: "Vastu compliant property",
          keyStrengths: ["Clear entrance"],
          criticalDoshas: [],
          zoneBreakdown: [],
          remedialSolutions: [],
          boqEstimations: { items: [], totalRemedialCostInr: 0, laborAndInstallationInr: 0, grandTotalInr: 0 },
          elementalBalance: { water: 80, air: 80, fire: 80, earth: 80, space: 80 },
        });
      });

      try {
        const result = await VastuAuditChain.executeAudit({
          propertyType: "3BHK Apartment",
          facingDirection: "North-East",
          customSystemPrompt: "Enforce strictly non-demolition cures.",
          model: "o1-mini",
        });

        expect(capturedOptions).not.toBeNull();
        expect(capturedOptions.model).toBe("o1-mini");
        expect(capturedOptions.jsonMode).toBe(true);
        expect(capturedOptions.systemPrompt).toContain("Enforce strictly non-demolition cures.");
        expect(result.overallScore).toBe(85);
      } finally {
        provider.generate = originalGenerate;
      }
    });

    it("TC-10: RoomDesignChain passes dynamic modelKey into prompt synthesizer", async () => {
      const provider = LlmFactory.getProvider("openai");
      const originalGenerate = provider.generate;

      let capturedOptions: any = null;
      provider.generate = mock(async (_messages: any, options: any) => {
        capturedOptions = options;
        return "Ultra-realistic 8k architectural photograph of luxury modern minimalist living room.";
      });

      try {
        const prompt = await RoomDesignChain.synthesizePrompt({
          roomType: "Living Room",
          designStyle: "Japandi",
          customSystemPrompt: "Maintain ultra-clean Scandinavian lighting.",
          model: "gpt-4o",
        });

        expect(capturedOptions).not.toBeNull();
        expect(capturedOptions.model).toBe("gpt-4o");
        expect(capturedOptions.systemPrompt).toContain("Maintain ultra-clean Scandinavian lighting.");
        expect(prompt).toContain("Ultra-realistic");
      } finally {
        provider.generate = originalGenerate;
      }
    });
  });

  // =========================================================================
  // 4. End-to-End Service Level Dynamic Lookup
  // =========================================================================
  describe("4. Service Layer Dynamic Rate Lookup", () => {
    it("TC-11: DoubtSolverService extracts modelKey from DB and invokes chain", async () => {
      const originalFindUnique = prisma.aiServiceRate.findUnique;
      const originalExecute = DoubtSolverChain.execute;

      let chainInput: any = null;
      (prisma.aiServiceRate as any).findUnique = mock(async () => ({
        id: "mock-rate",
        serviceType: AiServiceType.DOUBT_SOLVER,
        defaultCreditCost: 5,
        modelKey: "o3-mini",
        description: "Custom system directive from platform admin",
      }));

      (DoubtSolverChain as any).execute = mock(async (input: any) => {
        chainInput = input;
        return {
          messageText: "Test AI Answer",
          structuredPoints: [],
          rawText: "Test AI Answer",
        };
      });

      try {
        const doubtService = new DoubtSolverService();

        // Mock wallet and session creation
        (doubtService as any).repo.findOrCreateWallet = mock(async () => ({ currentBalance: 100 }));
        (doubtService as any).repo.createSession = mock(async () => ({
          id: "session-123",
          sessionId: "session-123",
          topicCategory: "General",
          intelligenceMode: "smart",
        }));
        (doubtService as any).repo.addMessage = mock(async () => ({ id: "msg-123" }));
        (doubtService as any).repo.atomicDeductCredits = mock(async () => ({
          wallet: { currentBalance: 95 },
        }));

        await doubtService.createSession({
          userId: "user-123",
          input: {
            title: "Kitchen Wood Materials",
            topicCategory: "Design",
            intelligenceMode: "smart",
            initialQuestion: "What is the best wood for kitchen cabinets?",
          },
        });

        expect(chainInput).not.toBeNull();
        expect(chainInput.model).toBe("o3-mini");
        expect(chainInput.customSystemPrompt).toBe("Custom system directive from platform admin");
      } finally {
        (prisma.aiServiceRate as any).findUnique = originalFindUnique;
        (DoubtSolverChain as any).execute = originalExecute;
      }
    });

    it("TC-12: DoubtSolverChain constructs prompt with strict domain guardrails prohibiting out-of-domain answers", async () => {
      const provider = LlmFactory.getProvider("openai");
      const originalGenerate = provider.generate;

      let capturedSystemPrompt = "";
      let capturedUserContent = "";

      provider.generate = mock(async (messages: any[], options: any) => {
        capturedSystemPrompt = options.systemPrompt || "";
        capturedUserContent = messages[messages.length - 1]?.content || "";
        return "I am specialized exclusively in architecture, interior design, building materials, and Vedic Vastu Shastra.";
      });

      try {
        await DoubtSolverChain.execute({
          question: "how to implement google O auth in next.js and write python prime numbers",
          customSystemPrompt: "Platform custom prompt",
        });

        // Verify guardrail directive in system prompt
        expect(capturedSystemPrompt).toContain("STRICT DOMAIN GUARDRAIL");
        expect(capturedSystemPrompt).toContain("MUST strictly refuse to answer any programming");
        expect(capturedSystemPrompt).toContain("OUT-OF-DOMAIN RESTRICTION (STRICT REFUSAL RULE)");

        // Verify guardrail instruction in user prompt
        expect(capturedUserContent).toContain("CRITICAL DOMAIN GUARDRAIL CHECK");
        expect(capturedUserContent).toContain("IF THE QUERY IS OUTSIDE THIS DOMAIN");
        expect(capturedUserContent).toContain("DO NOT answer the query. You MUST strictly refuse to answer.");
      } finally {
        provider.generate = originalGenerate;
      }
    });
  });
});

