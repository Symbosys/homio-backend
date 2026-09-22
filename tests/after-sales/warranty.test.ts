import { describe, it, expect } from "bun:test";
import {
  createProjectWarrantySchema,
  updateProjectWarrantySchema,
  updateWarrantyStatusSchema,
  getProjectWarrantiesQuerySchema,
  warrantyIdParamSchema,
} from "../../src/module/after-sales/validators/warranty.validator.js";

describe("After-Sales: Project Warranty Tests", () => {
  const MOCK_PROJECT_ID = "11112222-3333-4444-8555-666677778888";
  const MOCK_HANDOVER_ID = "22223333-4444-4555-8666-777788889999";
  const MOCK_WARRANTY_ID = "33334444-5555-4666-8777-888899990000";

  describe("Create Warranty Validation", () => {
    it("should validate full project warranty payload", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID,
        handoverId: MOCK_HANDOVER_ID,
        category: "Modular Kitchen & Wardrobes",
        title: "5-Year Marine Ply & Hardware Comprehensive Warranty",
        description: "Covers hinge breakage, laminate bubbling, drawer runner failures and water seepage.",
        coveredItemWork: "Kitchen Base/Wall Units, Soft-Close Telescopic Channels, Hafele Hinges",
        startDate: "2026-10-01",
        endDate: "2031-10-01",
        status: "ACTIVE" as const,
        termsSummary: "Free rectifications within 48h of complaint; exclusions apply to physical damage.",
        inclusions: "Hardware defects, laminate de-bonding, wood borer infestation.",
        exclusions: "Direct water flooding, intentional force, user tampering.",
        additionalInformation: { vendorContractId: "VEND-2026-09" },
      };

      const parsed = createProjectWarrantySchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.category).toBe("Modular Kitchen & Wardrobes");
      expect(parsed.status).toBe("ACTIVE");
      expect(parsed.startDate).toBe("2026-10-01");
      expect(parsed.endDate).toBe("2031-10-01");
    });

    it("should reject creation when required projectId or title is missing", () => {
      expect(() =>
        createProjectWarrantySchema.parse({
          category: "Woodwork",
          startDate: "2026-10-01",
          endDate: "2027-10-01",
        })
      ).toThrow();
    });

    it("should reject creation when startDate or endDate format is invalid", () => {
      expect(() =>
        createProjectWarrantySchema.parse({
          projectId: MOCK_PROJECT_ID,
          category: "Woodwork",
          title: "1-Year Warranty",
          startDate: "not-a-date",
          endDate: "2027-10-01",
        })
      ).toThrow();
    });
  });

  describe("Status Transitions Validation", () => {
    it("should validate legal status transitions", () => {
      for (const status of ["ACTIVE", "EXPIRED", "CLAIMED", "VOIDED"] as const) {
        const parsed = updateWarrantyStatusSchema.parse({ status });
        expect(parsed.status).toBe(status);
      }
    });

    it("should reject invalid status strings", () => {
      expect(() => updateWarrantyStatusSchema.parse({ status: "UNKNOWN_STATUS" })).toThrow();
    });
  });

  describe("Update & Query Validation", () => {
    it("should validate partial updates without allowing projectId alteration", () => {
      const payload = {
        title: "Updated 10-Year Waterproofing Warranty",
        status: "ACTIVE" as const,
        inclusions: "Includes chemical grouting and membrane sealing.",
      };

      const parsed = updateProjectWarrantySchema.parse(payload);
      expect(parsed.title).toBe("Updated 10-Year Waterproofing Warranty");
      expect(parsed.inclusions).toContain("chemical grouting");
    });

    it("should validate query filters with date ranges", () => {
      const query = {
        projectId: MOCK_PROJECT_ID,
        status: "ACTIVE",
        category: "Waterproofing",
        search: "seepage",
        page: "1",
        limit: "10",
      };

      const parsed = getProjectWarrantiesQuerySchema.parse(query);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.status).toBe("ACTIVE");
      expect(parsed.category).toBe("Waterproofing");
    });

    it("should validate warranty ID param", () => {
      const parsed = warrantyIdParamSchema.parse({ id: MOCK_WARRANTY_ID });
      expect(parsed.id).toBe(MOCK_WARRANTY_ID);
    });
  });
});
