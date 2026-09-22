import { describe, it, expect } from "bun:test";
import {
  createServiceRequestSchema,
  updateServiceRequestSchema,
  assignServiceRequestSchema,
  updateServiceRequestStatusSchema,
  resolveServiceRequestSchema,
  reopenServiceRequestSchema,
  getServiceRequestsQuerySchema,
  serviceRequestIdParamSchema,
} from "../../src/module/after-sales/validators/service-request.validator.js";

describe("After-Sales: Service Request Tests", () => {
  const MOCK_PROJECT_ID = "11112222-3333-4444-8555-666677778888";
  const MOCK_CATEGORY_ID = "99991111-2222-4333-8444-555566667777";
  const MOCK_EMPLOYEE_ID = "55556666-7777-4888-8999-000011112222";
  const MOCK_REQUEST_ID = "66667777-8888-4999-8000-111122223333";

  describe("Create Service Request Validation", () => {
    it("should validate full service request ticket payload", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID,
        categoryId: MOCK_CATEGORY_ID,
        priority: "HIGH" as const,
        subject: "Master Bedroom Wardrobe Hydraulic Lift Defective",
        description: "Hydraulic pump on the overhead loft has lost pressure and cabinet door is not staying open.",
        areaRoom: "Master Bedroom",
        specificLocation: "Loft Unit Above 3-Door Wardrobe",
        preferredServiceDate: "2026-10-25",
        preferredTimeSlot: "10:00 AM - 01:00 PM",
        customerAvailabilityNotes: "Customer is available only on weekends or after 6 PM.",
        assignedToId: MOCK_EMPLOYEE_ID,
        isWarrantyCovered: true,
        billingStatus: "FREE_UNDER_WARRANTY" as const,
        estimatedCost: 0,
        internalNotes: "Prioritize visit: High-value VIP client.",
        additionalInformation: { channel: "Mobile App" },
      };

      const parsed = createServiceRequestSchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.categoryId).toBe(MOCK_CATEGORY_ID);
      expect(parsed.priority).toBe("HIGH");
      expect(parsed.subject).toContain("Hydraulic");
      expect(parsed.isWarrantyCovered).toBe(true);
      expect(parsed.billingStatus).toBe("FREE_UNDER_WARRANTY");
    });

    it("should allow minimal creation payload with sensible defaults", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID,
        categoryId: MOCK_CATEGORY_ID,
        subject: "Loose electrical socket in living room",
        description: "The 16A switch plate is loose and sparks occasionally.",
      };

      const parsed = createServiceRequestSchema.parse(payload);
      expect(parsed.priority).toBe("MEDIUM");
      expect(parsed.isWarrantyCovered).toBe(false);
      expect(parsed.billingStatus).toBe("FREE_UNDER_WARRANTY");
    });
  });

  describe("Assignment & Status Transitions", () => {
    it("should validate technician assignment", () => {
      const payload = {
        assignedToId: MOCK_EMPLOYEE_ID,
        internalNotes: "Dispatched expert senior carpenter.",
      };

      const parsed = assignServiceRequestSchema.parse(payload);
      expect(parsed.assignedToId).toBe(MOCK_EMPLOYEE_ID);
      expect(parsed.internalNotes).toContain("senior carpenter");
    });

    it("should validate valid lifecycle status strings", () => {
      for (const status of [
        "OPEN",
        "ASSIGNED",
        "IN_PROGRESS",
        "WAITING_FOR_PARTS",
        "ON_HOLD",
        "RESOLVED",
        "CLOSED",
        "REOPENED",
        "CANCELLED",
      ] as const) {
        const parsed = updateServiceRequestStatusSchema.parse({ status });
        expect(parsed.status).toBe(status);
      }
    });

    it("should reject invalid status strings", () => {
      expect(() => updateServiceRequestStatusSchema.parse({ status: "INVALID_STATUS" })).toThrow();
    });
  });

  describe("Resolution & Reopening Validation", () => {
    it("should validate resolving request with final settlement notes and costs", () => {
      const payload = {
        resolvedNotes: "Replaced dual 150N hydraulic gas struts. Tested door lift and latch.",
        finalCost: 1200.0,
        billingStatus: "CHARGEABLE_ESTIMATED" as const,
        isPaid: true,
      };

      const parsed = resolveServiceRequestSchema.parse(payload);
      expect(parsed.resolvedNotes).toContain("Replaced dual");
      expect(parsed.finalCost).toBe(1200.0);
      expect(parsed.isPaid).toBe(true);
    });

    it("should validate reopening request with reason", () => {
      const payload = {
        reopenReason: "Customer reported hydraulic arm still creaking after 2 days of usage.",
      };

      const parsed = reopenServiceRequestSchema.parse(payload);
      expect(parsed.reopenReason).toContain("hydraulic arm still creaking");
    });
  });

  describe("Query & Param Validation", () => {
    it("should validate query filters with isOverdue boolean", () => {
      const query = {
        projectId: MOCK_PROJECT_ID,
        priority: "HIGH",
        status: "OPEN",
        isOverdue: "true",
        page: "1",
        limit: "10",
      };

      const parsed = getServiceRequestsQuerySchema.parse(query);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.priority).toBe("HIGH");
      expect(parsed.isOverdue).toBe(true);
    });

    it("should validate service request ID param", () => {
      const parsed = serviceRequestIdParamSchema.parse({ id: MOCK_REQUEST_ID });
      expect(parsed.id).toBe(MOCK_REQUEST_ID);
    });
  });
});
