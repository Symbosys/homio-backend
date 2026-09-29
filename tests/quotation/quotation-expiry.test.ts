import { describe, it, expect, mock } from "bun:test";
import {
  AdjustQuotationExpirySchema,
} from "../../src/module/quotation/validators/quotation.validator.js";
import { quotationService } from "../../src/module/quotation/services/quotation.service.js";
import { quotationRepository } from "../../src/module/quotation/repos/quotation.repo.js";
import { QuotationStatus, statusCode } from "../../src/types/types.js";
import { ErrorResponse } from "../../src/utils/response.util.js";

const MOCK_ORG_ID = "05c35313-038c-4cc3-aed8-304a702fbf55";
const MOCK_QUOTATION_ID = "33333333-3333-4333-8333-333333333333";

describe("Quotation Expiry & Reminders Service & Validator Test Suite", () => {
  // =========================================================================
  // 1. Validator Tests
  // =========================================================================
  describe("AdjustQuotationExpirySchema", () => {
    it("should accept valid positive daysDelta (+7 days)", () => {
      const parsed = AdjustQuotationExpirySchema.parse({
        daysDelta: 7,
        reason: "Client requested extension",
      });
      expect(parsed.daysDelta).toBe(7);
      expect(parsed.reason).toBe("Client requested extension");
    });

    it("should accept valid negative daysDelta (-3 days)", () => {
      const parsed = AdjustQuotationExpirySchema.parse({
        daysDelta: -3,
      });
      expect(parsed.daysDelta).toBe(-3);
    });

    it("should accept valid explicit ISO datetime", () => {
      const parsed = AdjustQuotationExpirySchema.parse({
        discountExpiryDate: "2026-10-30T18:30:00.000Z",
      });
      expect(parsed.discountExpiryDate).toBe("2026-10-30T18:30:00.000Z");
    });

    it("should fail validation if neither daysDelta nor discountExpiryDate is provided", () => {
      expect(() => AdjustQuotationExpirySchema.parse({})).toThrow();
    });
  });

  // =========================================================================
  // 2. Service Logic Tests
  // =========================================================================
  describe("QuotationService.adjustDiscountExpiry", () => {
    it("should add days to existing discount expiry and return updated quotation", async () => {
      const initialDate = new Date("2026-10-01T00:00:00.000Z");
      const mockQuote = {
        id: MOCK_QUOTATION_ID,
        organizationId: MOCK_ORG_ID,
        quoteNumber: "HOM-QT-202609-0001",
        discountExpiryDate: initialDate,
        status: QuotationStatus.DRAFT,
      };

      const findByIdSpy = mock(() => Promise.resolve(mockQuote as any));
      const updateSpy = mock((orgId: string, id: string, newDate: Date, status?: any) =>
        Promise.resolve({
          ...mockQuote,
          discountExpiryDate: newDate,
          status: status || mockQuote.status,
        } as any)
      );

      quotationRepository.findById = findByIdSpy as any;
      quotationRepository.updateDiscountExpiry = updateSpy as any;

      const result = await quotationService.adjustDiscountExpiry(MOCK_ORG_ID, MOCK_QUOTATION_ID, {
        daysDelta: 7,
        reason: "Extended for customer review",
      });

      expect(findByIdSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      const updatedTime = new Date(result.discountExpiryDate!).getTime();
      const expectedTime = initialDate.getTime() + 7 * 86400000;
      expect(updatedTime).toBe(expectedTime);
    });

    it("should reactivate EXPIRED quote when expiry is extended into the future", async () => {
      const expiredDate = new Date(Date.now() - 86400000 * 2); // 2 days ago
      const mockQuote = {
        id: MOCK_QUOTATION_ID,
        organizationId: MOCK_ORG_ID,
        quoteNumber: "HOM-QT-202609-0002",
        discountExpiryDate: expiredDate,
        status: QuotationStatus.EXPIRED,
      };

      const findByIdSpy = mock(() => Promise.resolve(mockQuote as any));
      const updateSpy = mock((orgId: string, id: string, newDate: Date, status?: any) =>
        Promise.resolve({
          ...mockQuote,
          discountExpiryDate: newDate,
          status: status || mockQuote.status,
        } as any)
      );

      quotationRepository.findById = findByIdSpy as any;
      quotationRepository.updateDiscountExpiry = updateSpy as any;

      const result = await quotationService.adjustDiscountExpiry(MOCK_ORG_ID, MOCK_QUOTATION_ID, {
        daysDelta: 10,
      });

      expect(result.status).toBe(QuotationStatus.SENT);
    });

    it("should throw 404 when quotation is not found", async () => {
      quotationRepository.findById = mock(() => Promise.resolve(null)) as any;

      expect(
        quotationService.adjustDiscountExpiry(MOCK_ORG_ID, "non-existent-id", {
          daysDelta: 3,
        })
      ).rejects.toThrow(ErrorResponse);
    });
  });
});
