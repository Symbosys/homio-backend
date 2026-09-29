import { describe, it, expect } from "bun:test";
import {
  createTermsTemplateSchema,
  updateTermsTemplateSchema,
  getTermsTemplatesQuerySchema,
  termsTemplateIdParamSchema,
  duplicateTermsTemplateSchema,
} from "../../src/module/quotation-master/validators/quotation-terms-template.validator.js";
import { quotationTermsTemplateService } from "../../src/module/quotation-master/services/quotation-terms-template.service.js";
import { quotationTermsTemplateRepo } from "../../src/module/quotation-master/repos/quotation-terms-template.repo.js";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_TERMS_ID_1,
  MOCK_TERMS_ID_2,
  mockTermsTemplateRecord,
} from "./fixtures/quotation-master.fixtures.js";

describe("Quotation Terms & Conditions Template Module Tests", () => {
  // =========================================================================
  // 1. Validator Schemas
  // =========================================================================
  describe("Terms Template Validators", () => {
    it("should validate complete terms template creation payload", () => {
      const payload = {
        body: {
          name: "Standard Villa Turnkey Legal Terms",
          code: "TC-VILLA-01",
          description: "High-spec terms template",
          termsAndConditions: "1. All work per architectural drawings. 2. Variations billed pro-rata.",
          warrantyClauses: "10-year structural & cabinetry warranty.",
          paymentTermsNote: "Milestone completion certificates required before invoice clearance.",
          clientSignoffNote: "Client Acceptance Signature Required.",
          isDefault: true,
          isActive: true,
        },
      };

      const result = createTermsTemplateSchema.parse(payload);
      expect(result.body.name).toBe("Standard Villa Turnkey Legal Terms");
      expect(result.body.isDefault).toBe(true);
      expect(result.body.termsAndConditions).toContain("architectural drawings");
    });

    it("should fail validation if termsAndConditions is empty", () => {
      const invalidPayload = {
        body: {
          name: "Missing Terms",
        },
      };

      expect(() => createTermsTemplateSchema.parse(invalidPayload)).toThrow();
    });

    it("should validate template duplication payload", () => {
      const payload = {
        params: { id: MOCK_TERMS_ID_1 },
        body: {
          name: "Cloned Commercial Fitout Terms",
          code: "TC-COMM-02",
        },
      };

      const result = duplicateTermsTemplateSchema.parse(payload);
      expect(result.body.name).toBe("Cloned Commercial Fitout Terms");
      expect(result.body.code).toBe("TC-COMM-02");
    });
  });

  // =========================================================================
  // 2. Service Layer Logic
  // =========================================================================
  describe("Terms Template Service", () => {
    it("should create terms template and clear existing default", async () => {
      const originalClearDefault = quotationTermsTemplateRepo.clearExistingDefault;
      const originalCreate = quotationTermsTemplateRepo.create;

      let clearCalled = false;
      quotationTermsTemplateRepo.clearExistingDefault = async () => {
        clearCalled = true;
        return { count: 1 } as any;
      };
      quotationTermsTemplateRepo.create = async (_orgId, data) => ({
        ...mockTermsTemplateRecord,
        ...data,
      } as any);

      try {
        const input = {
          name: "Turnkey Terms",
          code: "TC-01",
          description: "Desc",
          termsAndConditions: "Full terms",
          warrantyClauses: "10 years",
          paymentTermsNote: "Note",
          clientSignoffNote: "Sign here",
          isDefault: true,
          isActive: true,
          additionalInformation: null,
        };

        const result = await quotationTermsTemplateService.createTermsTemplate(MOCK_ORGANIZATION_ID_1, input);
        expect(clearCalled).toBe(true);
        expect(result.name).toBe("Turnkey Terms");
      } finally {
        quotationTermsTemplateRepo.clearExistingDefault = originalClearDefault;
        quotationTermsTemplateRepo.create = originalCreate;
      }
    });

    it("should duplicate an existing terms template with new name", async () => {
      const originalFindById = quotationTermsTemplateRepo.findById;
      const originalCreate = quotationTermsTemplateRepo.create;

      quotationTermsTemplateRepo.findById = async () => mockTermsTemplateRecord as any;
      quotationTermsTemplateRepo.create = async (_orgId, data) => ({
        ...mockTermsTemplateRecord,
        ...data,
        id: MOCK_TERMS_ID_2,
      } as any);

      try {
        const input = {
          name: "Cloned Terms for Commercial",
          code: "TC-COMM-01",
        };

        const result = await quotationTermsTemplateService.duplicateTermsTemplate(
          MOCK_TERMS_ID_1,
          MOCK_ORGANIZATION_ID_1,
          input
        );

        expect(result.name).toBe("Cloned Terms for Commercial");
        expect(result.isDefault).toBe(false);
        expect(result.termsAndConditions).toBe(mockTermsTemplateRecord.termsAndConditions);
      } finally {
        quotationTermsTemplateRepo.findById = originalFindById;
        quotationTermsTemplateRepo.create = originalCreate;
      }
    });
  });
});
