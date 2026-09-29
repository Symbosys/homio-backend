import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  UpdateQuotationSchema,
} from "../../src/module/quotation/validators/quotation.validator.js";
import { quotationService } from "../../src/module/quotation/services/quotation.service.js";
import { quotationRepository } from "../../src/module/quotation/repos/quotation.repo.js";
import {
  QuotationStatus,
  QuotationDiscountType,
  QuotationRoomAreaType,
  QuotationItemCategory,
  PdfPageImagePosition,
  statusCode,
} from "../../src/types/types.js";
import { ErrorResponse } from "../../src/utils/response.util.js";

const MOCK_ORG_ID = "05c35313-038c-4cc3-aed8-304a702fbf55";
const MOCK_LEAD_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const MOCK_QUOTATION_ID = "33333333-3333-4333-8333-333333333333";

describe("Quotation Module - Edit & Update APIs Test Suite", () => {
  describe("UpdateQuotationSchema Validator", () => {
    it("should successfully validate full symmetric update payload", () => {
      const payload = {
        title: "Updated 3BHK Luxury Turnkey Execution Proposal",
        version: "v2.0",
        quotationType: "residentialInterior",
        status: QuotationStatus.INTERNAL_REVIEW,
        salesOwnerName: "Aman Gupta",
        designerName: "Neha Kapoor",
        grossSubtotal: 750000,
        discountType: QuotationDiscountType.PERCENTAGE,
        discountPercent: 10,
        discountAmount: 75000,
        taxableAmount: 675000,
        gstPercent: 18,
        gstAmount: 121500,
        grandTotal: 796500,
        targetMarginPercent: 30,
        discountExpiryDate: "2026-11-01T00:00:00.000Z",
        internalNotes: "Client negotiated 10% discount on entire turnkey scope.",
        termsAndConditions: "Updated payment and warranty clauses.",
        tags: ["luxury", "villa", "updated"],
        additionalInformation: { specialDiscountApprovedBy: "VP Sales" },
        rooms: [
          {
            roomName: "Master Suite",
            areaType: QuotationRoomAreaType.MASTER_BEDROOM,
            carpetAreaSqft: 250,
            sortOrder: 0,
            items: [
              {
                itemCode: "WD-MST-01",
                name: "Floor to ceiling 6-door Wardrobe with Fluted Glass",
                category: QuotationItemCategory.CARPENTRY,
                materialSpecs: "HDHMR with PU finish and Hafele profin",
                uom: "sqft",
                quantity: 80,
                rate: 2200,
                marginPercent: 28,
                amount: 176000,
                sortOrder: 0,
              },
            ],
          },
        ],
        paymentSchedule: [
          {
            stageName: "Advance on Agreement",
            percentage: 20,
            amount: 159300,
            triggerEvent: "On signing estimate",
            isCompleted: true,
            sortOrder: 0,
          },
        ],
        pdfPages: [
          {
            title: "Updated Front Cover",
            position: PdfPageImagePosition.FRONT,
            sortOrder: 0,
            pageLabel: "Cover",
            image: {
              id: "img-edit-01",
              url: "https://cloud.homio.in/assets/cover-v2.jpg",
              bytes: 154000,
              format: "jpg",
              provider: "CLOUDINARY" as const,
            },
          },
        ],
        revisionNotes: "Client scope change: added fluted glass wardrobe",
      };

      const validated = UpdateQuotationSchema.parse(payload);
      expect(validated.title).toBe("Updated 3BHK Luxury Turnkey Execution Proposal");
      expect(validated.version).toBe("v2.0");
      expect(validated.status).toBe(QuotationStatus.INTERNAL_REVIEW);
      expect(validated.grandTotal).toBe(796500);
      expect(validated.rooms).toBeDefined();
      expect(validated.rooms?.length).toBe(1);
      expect(validated.paymentSchedule?.length).toBe(1);
      expect(validated.pdfPages?.length).toBe(1);
    });

    it("should accept partial updates", () => {
      const partial = {
        title: "Renamed Proposal",
        discountPercent: 12,
        grandTotal: 450000,
      };

      const validated = UpdateQuotationSchema.parse(partial);
      expect(validated.title).toBe("Renamed Proposal");
      expect(validated.discountPercent).toBe(12);
      expect(validated.grandTotal).toBe(450000);
    });
  });

  describe("QuotationService.getQuotationById", () => {
    it("should return quotation when found in tenant organization", async () => {
      const mockQuote = {
        id: MOCK_QUOTATION_ID,
        organizationId: MOCK_ORG_ID,
        title: "Test Proposal",
        leadId: MOCK_LEAD_ID,
        rooms: [],
      };

      const origFindById = quotationRepository.findById;
      quotationRepository.findById = mock(async () => mockQuote as any);

      const result = await quotationService.getQuotationById(MOCK_ORG_ID, MOCK_QUOTATION_ID);
      expect(result).toBeDefined();
      expect(result.id).toBe(MOCK_QUOTATION_ID);

      quotationRepository.findById = origFindById;
    });

    it("should throw 404 when quotation is not found in tenant organization", async () => {
      const origFindById = quotationRepository.findById;
      quotationRepository.findById = mock(async () => null);

      try {
        await quotationService.getQuotationById(MOCK_ORG_ID, "non-existent-id");
        expect(true).toBe(false); // Should not reach here
      } catch (err: any) {
        expect(err).toBeInstanceOf(ErrorResponse);
        expect(err.statusCode).toBe(statusCode.Not_Found);
      } finally {
        quotationRepository.findById = origFindById;
      }
    });
  });

  describe("QuotationService.updateQuotation", () => {
    it("should successfully update existing quotation and return updated entity", async () => {
      const existingQuote = {
        id: MOCK_QUOTATION_ID,
        organizationId: MOCK_ORG_ID,
        leadId: MOCK_LEAD_ID,
        title: "Initial Title",
        version: "v1.0",
        revisionNumber: 1,
      };

      const updatedQuote = {
        ...existingQuote,
        title: "Updated Title",
        version: "v2.0",
        revisionNumber: 2,
      };

      const origFindById = quotationRepository.findById;
      const origUpdate = quotationRepository.update;

      quotationRepository.findById = mock(async () => existingQuote as any);
      quotationRepository.update = mock(async () => updatedQuote as any);

      const result = await quotationService.updateQuotation(MOCK_ORG_ID, MOCK_QUOTATION_ID, {
        title: "Updated Title",
        version: "v2.0",
      });

      expect(result).toBeDefined();
      expect(result.title).toBe("Updated Title");
      expect(result.revisionNumber).toBe(2);

      quotationRepository.findById = origFindById;
      quotationRepository.update = origUpdate;
    });

    it("should throw 404 when updating non-existent quotation", async () => {
      const origFindById = quotationRepository.findById;
      quotationRepository.findById = mock(async () => null);

      try {
        await quotationService.updateQuotation(MOCK_ORG_ID, "non-existent-id", {
          title: "New Title",
        });
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err).toBeInstanceOf(ErrorResponse);
        expect(err.statusCode).toBe(statusCode.Not_Found);
      } finally {
        quotationRepository.findById = origFindById;
      }
    });
  });
});
