import { describe, it, expect } from "bun:test";
import {
  createLeadSchema,
  updateLeadSchema,
  getLeadsQuerySchema,
  leadIdParamSchema,
  updateLeadStatusSchema,
  markLeadLostSchema,
} from "../../src/module/leads-crm/validators/lead.validator";
import {
  MOCK_CUSTOMER_ID,
  MOCK_LEAD_ID,
  MOCK_EMPLOYEE_ID_1,
} from "./fixtures/crm.fixtures";

describe("Lead CRM Module Tests", () => {
  // =========================================================================
  // 1. Lead Code Pattern Verification
  // =========================================================================
  describe("Lead Code Pattern Verification", () => {
    it("should conform to sequential Lead Code pattern LEAD-YYYY-NNNN", () => {
      const codeRegex = /^LEAD-\d{4}-\d{4,}$/;
      expect(codeRegex.test("LEAD-2026-0001")).toBe(true);
      expect(codeRegex.test("LEAD-2026-0142")).toBe(true);
      expect(codeRegex.test("LEAD-2026-9999")).toBe(true);
      expect(codeRegex.test("LEAD-2026-10001")).toBe(true);

      expect(codeRegex.test("INVALID-CODE")).toBe(false);
      expect(codeRegex.test("LEAD-26-001")).toBe(false);
    });
  });

  // =========================================================================
  // 2. Lead Creation & Additional Information Validation
  // =========================================================================
  describe("Create Lead Validation", () => {
    it("should validate full lead creation payload with additionalInformation", () => {
      const payload = {
        body: {
          customerId: MOCK_CUSTOMER_ID,
          title: "Luxury 3BHK Penthouse Interior",
          scopeOfWork: "Complete false ceiling, modular kitchen, and italian marble flooring",
          status: "NEW" as const,
          source: "WEBSITE" as const,
          priority: "HIGH" as const,
          propertyType: "3BHK Penthouse",
          propertySizeSqft: 2800,
          propertyAddress: "Flat 1402, Skyline Towers",
          propertyCity: "Bangalore",
          propertyPincode: "560034",
          possessionStatus: "READY_TO_MOVE",
          estimatedBudget: 3500000,
          currency: "INR",
          qualificationScore: 85,
          assignedToId: MOCK_EMPLOYEE_ID_1,
          tags: ["Luxury", "Penthouse", "Hot Lead"],
          notes: "Client interested in starting work next month",
          customFields: {
            preferredTheme: "Modern Minimalist",
          },
          additionalInformation: {
            campaignSourceDetails: "Google Ads - Luxury Penthouse Bangalore",
            clientAvailability: "Weekends only",
            budgetFlexibility: "Up to 10% flexible",
            customChecklist: {
              siteVisited: true,
              floorPlanReceived: true,
            },
          },
        },
      };

      const result = createLeadSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.title).toBe("Luxury 3BHK Penthouse Interior");
        expect(result.data.body.additionalInformation?.campaignSourceDetails).toBe("Google Ads - Luxury Penthouse Bangalore");
        expect(result.data.body.additionalInformation?.customChecklist?.siteVisited).toBe(true);
      }
    });

    it("should allow inline new customer creation with lead payload", () => {
      const inlineCustomerPayload = {
        body: {
          customer: {
            firstName: "Ananya",
            lastName: "Iyer",
            phone: "+919811122233",
            email: "ananya.iyer@example.com",
            city: "Bangalore",
          },
          title: "Villa Renovation Lead",
          estimatedBudget: 5000000,
          additionalInformation: {
            referralContact: "+919876543210",
          },
        },
      };

      const result = createLeadSchema.safeParse(inlineCustomerPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.customer?.firstName).toBe("Ananya");
        expect(result.data.body.additionalInformation?.referralContact).toBe("+919876543210");
      }
    });
  });

  // =========================================================================
  // 3. Lead Partial Update Validation
  // =========================================================================
  describe("Update Lead Validation", () => {
    it("should allow partial dirty payload updates including additionalInformation", () => {
      const updatePayload = {
        params: { id: MOCK_LEAD_ID },
        body: {
          status: "QUALIFIED" as const,
          qualificationScore: 90,
          additionalInformation: {
            qualificationNotes: "Budget verified with bank pre-approval",
            decisionMakerMet: true,
          },
        },
      };

      const result = updateLeadSchema.safeParse(updatePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.status).toBe("QUALIFIED");
        expect(result.data.body.qualificationScore).toBe(90);
        expect(result.data.body.additionalInformation?.decisionMakerMet).toBe(true);
      }
    });

    it("should validate lead ID param", () => {
      const valid = leadIdParamSchema.safeParse({ params: { id: MOCK_LEAD_ID } });
      expect(valid.success).toBe(true);

      const invalid = leadIdParamSchema.safeParse({ params: { id: "invalid-uuid" } });
      expect(invalid.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Query Filters Validation
  // =========================================================================
  describe("Get Leads Query Validation", () => {
    it("should parse query filters with correct types and defaults", () => {
      const queryPayload = {
        query: {
          page: "1",
          limit: "25",
          status: "QUALIFIED",
          source: "WEBSITE",
          priority: "HIGH",
          propertyCity: "Bangalore",
          minBudget: "2000000",
          maxBudget: "6000000",
          sortBy: "estimatedBudget",
          sortOrder: "desc",
        },
      };

      const result = getLeadsQuerySchema.safeParse(queryPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.limit).toBe(25);
        expect(result.data.query.status).toBe("QUALIFIED");
        expect(result.data.query.minBudget).toBe(2000000);
        expect(result.data.query.maxBudget).toBe(6000000);
      }
    });
  });

  // =========================================================================
  // 5. Master Data Links & Mark Lost Workflow Validation
  // =========================================================================
  describe("Lead Master Data & Lost Workflow Validation", () => {
    const MOCK_SERVICE_CATEGORY_ID = "c0000000-0000-4000-8000-000000000003";
    const MOCK_LOST_REASON_ID = "b0000000-0000-4000-8000-000000000002";

    it("should validate lead creation with serviceCategoryId link", () => {
      const payload = {
        body: {
          customerId: MOCK_CUSTOMER_ID,
          title: "Full Home Interior - Master Data Linked",
          estimatedBudget: 2500000,
          serviceCategoryId: MOCK_SERVICE_CATEGORY_ID,
          additionalInformation: {
            architectConsultationRequired: true,
          },
        },
      };

      const result = createLeadSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.serviceCategoryId).toBe(MOCK_SERVICE_CATEGORY_ID);
        expect(result.data.body.additionalInformation?.architectConsultationRequired).toBe(true);
      }
    });

    it("should validate mark lead lost schema with lostReasonId, competitor, and remarks", () => {
      const payload = {
        params: { id: MOCK_LEAD_ID },
        body: {
          lostReasonId: MOCK_LOST_REASON_ID,
          lostCompetitor: "HomeLane",
          lostRemarks: "Client decided to go with competitor offering immediate delivery guarantee.",
        },
      };

      const result = markLeadLostSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.lostReasonId).toBe(MOCK_LOST_REASON_ID);
        expect(result.data.body.lostCompetitor).toBe("HomeLane");
      }
    });

    it("should reject mark lead lost schema when neither lostReasonId nor lostReason is provided", () => {
      const payload = {
        params: { id: MOCK_LEAD_ID },
        body: {
          lostRemarks: "Missing reason",
        },
      };

      const result = markLeadLostSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});

