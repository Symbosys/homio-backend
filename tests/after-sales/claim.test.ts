import { describe, it, expect } from "bun:test";
import {
  createWarrantyClaimSchema,
  updateWarrantyClaimSchema,
  reviewWarrantyClaimSchema,
  getWarrantyClaimsQuerySchema,
  claimIdParamSchema,
} from "../../src/module/after-sales/validators/claim.validator.js";

describe("After-Sales: Warranty Claim Tests", () => {
  const MOCK_WARRANTY_ID = "33334444-5555-4666-8777-888899990000";
  const MOCK_CLAIM_ID = "44445555-6666-4777-8888-999900001111";

  describe("Create Claim Validation", () => {
    it("should validate full warranty claim submission payload", () => {
      const payload = {
        warrantyId: MOCK_WARRANTY_ID,
        title: "Kitchen Sink Cabinet Base Laminate Peeling",
        description: "Laminate near the hot water supply pipe has debonded due to moisture seepage.",
        areaRoom: "Modular Kitchen",
        claimDate: "2026-10-20",
        additionalInformation: { reportedBy: "Customer Care Call" },
      };

      const parsed = createWarrantyClaimSchema.parse(payload);
      expect(parsed.warrantyId).toBe(MOCK_WARRANTY_ID);
      expect(parsed.title).toBe("Kitchen Sink Cabinet Base Laminate Peeling");
      expect(parsed.areaRoom).toBe("Modular Kitchen");
    });

    it("should reject creation when title or description is too short", () => {
      expect(() =>
        createWarrantyClaimSchema.parse({
          warrantyId: MOCK_WARRANTY_ID,
          title: "A",
          description: "Bad",
        })
      ).toThrow();
    });
  });

  describe("Review Claim Validation", () => {
    it("should validate approving a claim with coverage amount", () => {
      const payload = {
        status: "APPROVED" as const,
        approvedCoverageAmount: 15000.0,
      };

      const parsed = reviewWarrantyClaimSchema.parse(payload);
      expect(parsed.status).toBe("APPROVED");
      expect(parsed.approvedCoverageAmount).toBe(15000.0);
    });

    it("should validate rejecting a claim with reason", () => {
      const payload = {
        status: "REJECTED" as const,
        rejectionReason: "Defect caused by unauthorized customer plumbing modifications.",
      };

      const parsed = reviewWarrantyClaimSchema.parse(payload);
      expect(parsed.status).toBe("REJECTED");
      expect(parsed.rejectionReason).toContain("unauthorized customer plumbing");
    });
  });

  describe("Update & Query Validation", () => {
    it("should validate partial update on claim", () => {
      const payload = {
        title: "Updated Claim: Severe Kitchen Base Laminate Peeling",
        areaRoom: "Main Modular Kitchen",
      };

      const parsed = updateWarrantyClaimSchema.parse(payload);
      expect(parsed.title).toContain("Severe");
      expect(parsed.areaRoom).toBe("Main Modular Kitchen");
    });

    it("should validate query filters", () => {
      const query = {
        warrantyId: MOCK_WARRANTY_ID,
        status: "SUBMITTED",
        search: "peeling",
        page: "1",
        limit: "20",
      };

      const parsed = getWarrantyClaimsQuerySchema.parse(query);
      expect(parsed.warrantyId).toBe(MOCK_WARRANTY_ID);
      expect(parsed.status).toBe("SUBMITTED");
      expect(parsed.search).toBe("peeling");
    });

    it("should validate claim ID param", () => {
      const parsed = claimIdParamSchema.parse({ id: MOCK_CLAIM_ID });
      expect(parsed.id).toBe(MOCK_CLAIM_ID);
    });
  });
});
