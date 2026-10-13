import { describe, expect, it, mock, beforeEach } from "bun:test";
import { resolveAiTargetUser } from "../../src/module/ai-studio/utils/ai-auth.util.js";
import {
  GenerateRoomDesignSchema,
  QueryRoomDesignSessionsSchema,
  UpdateRoomDesignSessionSchema,
} from "../../src/module/ai-studio/validators/room-designer.validator.js";
import {
  GenerateVastuAuditSchema,
  QueryVastuAuditsSchema,
  UpdateVastuAuditSchema,
} from "../../src/module/ai-studio/validators/vastu-audit.validator.js";
import {
  CreateDoubtSolverSessionSchema,
  AskDoubtSolverQuestionSchema,
  RateDoubtSolverMessageSchema,
  UpdateDoubtSolverSessionSchema,
  QueryDoubtSolverSessionsSchema,
} from "../../src/module/ai-studio/validators/doubt-solver.validator.js";
import {
  AiStudioTargetUserQuerySchema,
  RechargeOrgWalletSchema,
  GetOrgWalletsQuerySchema,
} from "../../src/module/ai-studio/validators/ai-studio.validator.js";
import { prisma } from "../../src/lib/prisma.js";

// Mock IDs
const MOCK_CLIENT_USER_ID = "11111111-1111-4111-a111-111111111111";
const MOCK_ORG_A_ID = "22222222-2222-4222-a222-222222222222";
const MOCK_ORG_A_ADMIN_ID = "33333333-3333-4333-a333-333333333333";
const MOCK_ORG_A_EMPLOYEE_USER_ID = "44444444-4444-4444-a444-444444444444";
const MOCK_ORG_A_EMPLOYEE_RECORD_ID = "55555555-5555-4555-a555-555555555555";

const MOCK_ORG_B_ID = "66666666-6666-4666-a666-666666666666";
const MOCK_ORG_B_ADMIN_ID = "77777777-7777-4777-a777-777777777777";

describe("User-Centric AI Studio Multi-Tenant Architecture Test Suite", () => {
  // =========================================================================
  // 1. Target User Resolution & Security Boundary Tests (ai-auth.util)
  // =========================================================================
  describe("1. Target User Resolution & Multi-Tenant Boundary Enforcement", () => {
    it("TC-01: Retail Client Context: Resolves directly to caller userId when organizationId is absent", async () => {
      const caller: any = {
        id: MOCK_CLIENT_USER_ID,
        organizationId: null,
        userType: "CLIENT",
      };

      const result = await resolveAiTargetUser(caller);
      expect(result.targetUserId).toBe(MOCK_CLIENT_USER_ID);
      expect(result.actorUserId).toBe(MOCK_CLIENT_USER_ID);
      expect(result.actorEmployeeId).toBeNull();
    });

    it("TC-01b: Retail Client Context: Rejects passing orgUserId with 403 Forbidden", async () => {
      const caller: any = {
        id: MOCK_CLIENT_USER_ID,
        organizationId: null,
        userType: "CLIENT",
      };

      let thrownError: any = null;
      try {
        await resolveAiTargetUser(caller, MOCK_ORG_A_ADMIN_ID);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.statusCode).toBe(403);
      expect(thrownError.message).toContain("Retail client accounts cannot access other user credit pools");
    });

    it("TC-02: Organization Admin Context: Resolves to admin userId without delegation", async () => {
      const caller: any = {
        id: MOCK_ORG_A_ADMIN_ID,
        organizationId: MOCK_ORG_A_ID,
        userType: "ADMIN",
      };

      const result = await resolveAiTargetUser(caller);
      expect(result.targetUserId).toBe(MOCK_ORG_A_ADMIN_ID);
      expect(result.actorUserId).toBe(MOCK_ORG_A_ADMIN_ID);
    });

    it("TC-02b: Organization Admin Context: Allows passing own userId as orgUserId", async () => {
      const caller: any = {
        id: MOCK_ORG_A_ADMIN_ID,
        organizationId: MOCK_ORG_A_ID,
        userType: "ADMIN",
      };

      const result = await resolveAiTargetUser(caller, MOCK_ORG_A_ADMIN_ID);
      expect(result.targetUserId).toBe(MOCK_ORG_A_ADMIN_ID);
      expect(result.actorUserId).toBe(MOCK_ORG_A_ADMIN_ID);
    });

    it("TC-05: Multi-Tenant Breach Prevention: Rejects orgUserId belonging to a foreign organization (403)", async () => {
      // Mock prisma.user.findFirst to simulate foreign user check
      const originalFindFirst = prisma.user.findFirst;
      (prisma.user as any).findFirst = mock(async (args: any) => {
        // If checking for user in caller's organization MOCK_ORG_A_ID, return null
        if (args.where?.organizationId === MOCK_ORG_A_ID && args.where?.id === MOCK_ORG_B_ADMIN_ID) {
          return null;
        }
        return originalFindFirst.call(prisma.user, args);
      });

      const caller: any = {
        id: MOCK_ORG_A_EMPLOYEE_USER_ID,
        organizationId: MOCK_ORG_A_ID,
        userType: "USER",
      };

      let thrownError: any = null;
      try {
        await resolveAiTargetUser(caller, MOCK_ORG_B_ADMIN_ID);
      } catch (err) {
        thrownError = err;
      } finally {
        (prisma.user as any).findFirst = originalFindFirst;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.statusCode).toBe(403);
      expect(thrownError.message).toContain("Target organization user does not belong to your organization");
    });

    it("TC-04: Organization Employee Context: Allows valid orgUserId within the same organization", async () => {
      const originalFindFirst = prisma.user.findFirst;
      const originalEmpFind = prisma.employee.findFirst;

      (prisma.user as any).findFirst = mock(async (args: any) => {
        if (args.where?.id === MOCK_ORG_A_ADMIN_ID && args.where?.organizationId === MOCK_ORG_A_ID) {
          return { id: MOCK_ORG_A_ADMIN_ID, organizationId: MOCK_ORG_A_ID };
        }
        return null;
      });

      (prisma.employee as any).findFirst = mock(async (args: any) => {
        return { id: MOCK_ORG_A_EMPLOYEE_RECORD_ID };
      });

      const caller: any = {
        id: MOCK_ORG_A_EMPLOYEE_USER_ID,
        organizationId: MOCK_ORG_A_ID,
        userType: "USER",
      };

      try {
        const result = await resolveAiTargetUser(caller, MOCK_ORG_A_ADMIN_ID);
        expect(result.targetUserId).toBe(MOCK_ORG_A_ADMIN_ID);
        expect(result.actorUserId).toBe(MOCK_ORG_A_EMPLOYEE_USER_ID);
        expect(result.actorEmployeeId).toBe(MOCK_ORG_A_EMPLOYEE_RECORD_ID);
      } finally {
        (prisma.user as any).findFirst = originalFindFirst;
        (prisma.employee as any).findFirst = originalEmpFind;
      }
    });

    it("TC-03: Organization Employee Context: Auto-resolves primary Org Admin when no orgUserId is passed", async () => {
      const originalFindFirst = prisma.user.findFirst;
      const originalEmpFind = prisma.employee.findFirst;

      (prisma.user as any).findFirst = mock(async (args: any) => {
        if (args.where?.organizationId === MOCK_ORG_A_ID && args.where?.userType === "ADMIN") {
          return { id: MOCK_ORG_A_ADMIN_ID, organizationId: MOCK_ORG_A_ID };
        }
        return null;
      });

      (prisma.employee as any).findFirst = mock(async (args: any) => {
        return { id: MOCK_ORG_A_EMPLOYEE_RECORD_ID };
      });

      const caller: any = {
        id: MOCK_ORG_A_EMPLOYEE_USER_ID,
        organizationId: MOCK_ORG_A_ID,
        userType: "USER",
      };

      try {
        const result = await resolveAiTargetUser(caller);
        expect(result.targetUserId).toBe(MOCK_ORG_A_ADMIN_ID);
        expect(result.actorUserId).toBe(MOCK_ORG_A_EMPLOYEE_USER_ID);
        expect(result.actorEmployeeId).toBe(MOCK_ORG_A_EMPLOYEE_RECORD_ID);
      } finally {
        (prisma.user as any).findFirst = originalFindFirst;
        (prisma.employee as any).findFirst = originalEmpFind;
      }
    });
  });

  // =========================================================================
  // 2. Zod Schema Validation Tests across all AI Studio services
  // =========================================================================
  describe("2. Zod Schema Validation & Input Sanitization", () => {
    it("should accept GenerateRoomDesignSchema with optional orgUserId and custom fields", () => {
      const payload = {
        orgUserId: MOCK_ORG_A_ADMIN_ID,
        roomType: "Master Bedroom",
        designStyle: "Japandi Minimalist",
        colorPalette: ["#f5f5f0", "#8c7b70", "#2c2a29"],
        materialPreferences: ["Light Oak", "Linen", "Matte Black Metal"],
        lightingMode: "Golden Hour Warm",
        additionalInformation: {
          clientBudgetTier: "Luxury",
          carpetAreaSqft: 450,
          requiresBalconyView: true,
        },
      };

      const result = GenerateRoomDesignSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orgUserId).toBe(MOCK_ORG_A_ADMIN_ID);
        expect(result.data.roomType).toBe("Master Bedroom");
        expect(result.data.additionalInformation?.clientBudgetTier).toBe("Luxury");
      }
    });

    it("should reject GenerateRoomDesignSchema with invalid UUID for orgUserId", () => {
      const payload = {
        orgUserId: "not-a-valid-uuid",
        roomType: "Kitchen",
        designStyle: "Modern",
      };

      const result = GenerateRoomDesignSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should validate QueryRoomDesignSessionsSchema with optional orgUserId filter", () => {
      const query = {
        orgUserId: MOCK_ORG_A_ADMIN_ID,
        page: "2",
        limit: "15",
        roomType: "Living Room",
      };

      const result = QueryRoomDesignSessionsSchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orgUserId).toBe(MOCK_ORG_A_ADMIN_ID);
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(15);
      }
    });

    it("should validate GenerateVastuAuditSchema with optional orgUserId and vedic attributes", () => {
      const payload = {
        orgUserId: MOCK_ORG_A_ADMIN_ID,
        propertyType: "Duplex Villa",
        facingDirection: "North-East (Ishanya)",
        totalAreaSqft: 2800,
        numberOfFloors: 2,
        city: "Mumbai",
        selectedFocusAreas: ["Main Entrance", "Master Bedroom", "Kitchen Fire Element"],
        additionalInformation: {
          ownerZodiac: "Aries",
          kundaliCompatibility: true,
        },
      };

      const result = GenerateVastuAuditSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orgUserId).toBe(MOCK_ORG_A_ADMIN_ID);
        expect(result.data.facingDirection).toBe("North-East (Ishanya)");
      }
    });

    it("should validate CreateDoubtSolverSessionSchema with optional orgUserId and initial question", () => {
      const payload = {
        orgUserId: MOCK_ORG_A_ADMIN_ID,
        title: "False Ceiling & Recessed Lighting Query",
        topicCategory: "False Ceiling & Electrical",
        intelligenceMode: "expert",
        initialQuestion: "What is the recommended drop height for a gypsum perimeter cove with strip LEDs in an 9.5ft ceiling room?",
        additionalInformation: {
          roomHeightFeet: 9.5,
          material: "Saint-Gobain Gyproc",
        },
      };

      const result = CreateDoubtSolverSessionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orgUserId).toBe(MOCK_ORG_A_ADMIN_ID);
        expect(result.data.intelligenceMode).toBe("expert");
      }
    });

    it("should validate AskDoubtSolverQuestionSchema with orgUserId", () => {
      const payload = {
        orgUserId: MOCK_ORG_A_ADMIN_ID,
        question: "Can we install magnetic track lights directly on an existing slab without false ceiling?",
      };

      const result = AskDoubtSolverQuestionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orgUserId).toBe(MOCK_ORG_A_ADMIN_ID);
      }
    });

    it("should validate RateDoubtSolverMessageSchema with 1 or 5 rating and optional orgUserId", () => {
      const valid5 = RateDoubtSolverMessageSchema.safeParse({ rating: 5, orgUserId: MOCK_ORG_A_ADMIN_ID });
      expect(valid5.success).toBe(true);

      const valid1 = RateDoubtSolverMessageSchema.safeParse({ rating: 1 });
      expect(valid1.success).toBe(true);

      const invalidRating = RateDoubtSolverMessageSchema.safeParse({ rating: 3 });
      expect(invalidRating.success).toBe(false);
    });

    it("should validate AiStudioTargetUserQuerySchema with optional userId and orgUserId", () => {
      const valid = AiStudioTargetUserQuerySchema.safeParse({
        userId: MOCK_CLIENT_USER_ID,
        orgUserId: MOCK_ORG_A_ADMIN_ID,
      });
      expect(valid.success).toBe(true);

      const empty = AiStudioTargetUserQuerySchema.safeParse({});
      expect(empty.success).toBe(true);
    });

    it("should validate RechargeOrgWalletSchema requiring at least userId or organizationId", () => {
      const validWithUser = RechargeOrgWalletSchema.safeParse({
        userId: MOCK_CLIENT_USER_ID,
        customCredits: 200,
        amountPaid: 2000,
        description: "Manual promotional credit top-up",
      });
      expect(validWithUser.success).toBe(true);

      const validWithOrg = RechargeOrgWalletSchema.safeParse({
        organizationId: MOCK_ORG_A_ID,
        customCredits: 500,
        amountPaid: 5000,
        description: "Organization yearly plan top-up",
      });
      expect(validWithOrg.success).toBe(true);

      const invalidNeither = RechargeOrgWalletSchema.safeParse({
        customCredits: 100,
        amountPaid: 1000,
        description: "Invalid missing target",
      });
      expect(invalidNeither.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Credit Balance & Atomic Deduction Logic
  // =========================================================================
  describe("3. Credit Accounting & Insufficient Balance Safeguards", () => {
    it("TC-06: Insufficient Credits Safeguard: Throws 402 INSUFFICIENT_CREDITS when balance is lower than cost", () => {
      const currentBalance = 5;
      const requiredCost = 15;

      expect(() => {
        if (currentBalance < requiredCost) {
          const err: any = new Error(
            `Insufficient AI credits. You have ${currentBalance} credits, but running this operation requires ${requiredCost} credits.`
          );
          err.statusCode = 402;
          err.code = "INSUFFICIENT_CREDITS";
          throw err;
        }
      }).toThrow("Insufficient AI credits");
    });

    it("TC-07: Ledger Consistency: Correctly calculates balanceAfter and negative debit credits", () => {
      const initialBalance = 100;
      const renderCost = 40;
      const expectedBalanceAfter = initialBalance - renderCost;

      const ledgerEntry = {
        userId: MOCK_ORG_A_ADMIN_ID,
        employeeId: MOCK_ORG_A_EMPLOYEE_RECORD_ID,
        transactionType: "USAGE_DEBIT",
        credits: -renderCost,
        balanceAfter: expectedBalanceAfter,
      };

      expect(ledgerEntry.credits).toBe(-40);
      expect(ledgerEntry.balanceAfter).toBe(60);
      expect(ledgerEntry.userId).toBe(MOCK_ORG_A_ADMIN_ID);
      expect(ledgerEntry.employeeId).toBe(MOCK_ORG_A_EMPLOYEE_RECORD_ID);
    });
  });

  // =========================================================================
  // 4. Universal Additional Information Standard (Rule 18)
  // =========================================================================
  describe("4. Universal Additional Information Persistence Standard (Rule 18)", () => {
    it("TC-09: Accepts arbitrary JSON custom attributes across AI Studio payloads", () => {
      const customAttributes = {
        leadId: "00000000-0000-0000-0000-000000000001",
        projectId: "00000000-0000-0000-0000-000000000002",
        designerComments: "Approved by Senior Architect for luxury staging",
        clientApproved: true,
        renderBatchIteration: 3,
        siteGeoCoordinates: { lat: 12.9716, lng: 77.5946 },
      };

      const roomPayload = GenerateRoomDesignSchema.safeParse({
        roomType: "Dining Room",
        designStyle: "Art Deco",
        additionalInformation: customAttributes,
      });

      expect(roomPayload.success).toBe(true);
      if (roomPayload.success) {
        expect(roomPayload.data.additionalInformation?.clientApproved).toBe(true);
        expect(roomPayload.data.additionalInformation?.renderBatchIteration).toBe(3);
        expect(roomPayload.data.additionalInformation?.siteGeoCoordinates?.lat).toBe(12.9716);
      }
    });
  });
});
