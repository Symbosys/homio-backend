import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  CreateQuotationSchema,
  GetQuotationsQuerySchema,
} from "../../src/module/quotation/validators/quotation.validator.js";
import { quotationService, QuotationService } from "../../src/module/quotation/services/quotation.service.js";
import { quotationRepository, QuotationRepository } from "../../src/module/quotation/repos/quotation.repo.js";
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

describe("Quotation Module - Create & Get APIs Test Suite", () => {
  // =========================================================================
  // 1. Validator Schemas
  // =========================================================================
  describe("Quotation Validator Schemas", () => {
    it("should successfully validate a complete CreateQuotation payload with nested rooms and milestones", () => {
      const payload = {
        leadId: MOCK_LEAD_ID,
        customerId: MOCK_CUSTOMER_ID,
        title: "3BHK Premium Turnkey Proposal",
        quotationType: "residentialInterior",
        status: QuotationStatus.DRAFT,
        salesOwnerName: "Rohan Verma",
        designerName: "Priya Sharma",
        grossSubtotal: 500000,
        discountType: QuotationDiscountType.PERCENTAGE,
        discountPercent: 5,
        discountAmount: 25000,
        taxableAmount: 475000,
        gstPercent: 18,
        gstAmount: 85500,
        grandTotal: 560500,
        targetMarginPercent: 28,
        discountExpiryDate: "2026-10-15T18:30:00.000Z",
        termsAndConditions: "Standard 10-year warranty applies.",
        tags: ["luxury", "modular-kitchen"],
        additionalInformation: { sourceCampaign: "Diwali Promo" },
        rooms: [
          {
            roomName: "Modular Kitchen",
            areaType: QuotationRoomAreaType.KITCHEN,
            carpetAreaSqft: 120,
            sortOrder: 0,
            items: [
              {
                itemCode: "KT-BASE-01",
                name: "Base Cabinet with Soft Close Tandem Boxes",
                category: QuotationItemCategory.MODULAR_KITCHEN,
                materialSpecs: "18mm BWP Ply with Hafele Tandem Box",
                uom: "rft",
                quantity: 12,
                rate: 3500,
                marginPercent: 30,
                amount: 42000,
                sortOrder: 0,
              },
            ],
          },
        ],
        paymentSchedule: [
          {
            stageName: "Booking Advance",
            percentage: 10,
            amount: 56050,
            triggerEvent: "On signing quotation agreement",
            isCompleted: false,
            sortOrder: 0,
          },
        ],
        pdfPages: [
          {
            title: "Studio Obsidian Cover",
            position: PdfPageImagePosition.FRONT,
            sortOrder: 0,
            pageLabel: "Cover Page",
            image: {
              id: "img-cover-01",
              url: "https://cloud.homio.in/assets/cover.jpg",
              bytes: 204800,
              format: "jpg",
              provider: "CLOUDINARY" as const,
            },
          },
        ],
      };

      const result = CreateQuotationSchema.parse(payload);
      expect(result.leadId).toBe(MOCK_LEAD_ID);
      expect(result.title).toBe("3BHK Premium Turnkey Proposal");
      expect(result.rooms.length).toBe(1);
      expect(result.rooms[0]!.items.length).toBe(1);
      expect(result.rooms[0]!.items[0]!.category).toBe(QuotationItemCategory.MODULAR_KITCHEN);
      expect(result.paymentSchedule.length).toBe(1);
      expect(result.pdfPages.length).toBe(1);
    });

    it("should seamlessly normalize camelCase areaType and category values", () => {
      const payload = {
        leadId: MOCK_LEAD_ID,
        title: "1 BHK Scandinavian Proposal",
        rooms: [
          {
            roomName: "Master Bedroom",
            areaType: "masterBedroom",
            carpetAreaSqft: 180,
            items: [
              {
                itemCode: "MB-01",
                name: "Wardrobe",
                category: "carpentry",
                materialSpecs: "BWP Ply with Acrylic Finish",
                rate: 1500,
                quantity: 1,
              },
            ],
          },
        ],
      };

      const result = CreateQuotationSchema.parse(payload);
      expect(result.rooms[0]!.areaType).toBe(QuotationRoomAreaType.MASTER_BEDROOM);
      expect(result.rooms[0]!.items[0]!.category).toBe(QuotationItemCategory.CARPENTRY);
    });

    it("should fail validation when leadId is missing or invalid UUID", () => {
      const invalidPayload = {
        title: "Missing Lead Quote",
        leadId: "invalid-uuid-string",
      };

      expect(() => CreateQuotationSchema.parse(invalidPayload)).toThrow();
    });

    it("should validate GetQuotationsQuery with multi-criteria filters", () => {
      const query = {
        page: "2",
        limit: "20",
        search: "HOM-QT-2026",
        status: QuotationStatus.DRAFT,
        quotationType: "residentialInterior",
        discountExpired: "true",
        minGrandTotal: "100000",
        maxGrandTotal: "1500000",
        sortBy: "grandTotal",
        sortOrder: "desc",
      };

      const result = GetQuotationsQuerySchema.parse(query);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.search).toBe("HOM-QT-2026");
      expect(result.status).toBe(QuotationStatus.DRAFT);
      expect(result.discountExpired).toBe(true);
      expect(result.minGrandTotal).toBe(100000);
      expect(result.maxGrandTotal).toBe(1500000);
      expect(result.sortBy).toBe("grandTotal");
      expect(result.sortOrder).toBe("desc");
    });
  });

  // =========================================================================
  // 2. Service Layer Tests
  // =========================================================================
  describe("Quotation Service", () => {
    let service: QuotationService;
    let repoMock: QuotationRepository;

    beforeEach(() => {
      repoMock = new QuotationRepository();
      service = new QuotationService();
    });

    it("should throw NotFoundError if leadId does not exist in the tenant organization", async () => {
      mock.restore();
      repoMock.findLeadById = mock(async () => null);
      (service as any).generateQuoteNumber = mock(async () => "HOM-QT-202609-0001");
      quotationRepository.findLeadById = repoMock.findLeadById;

      try {
        await service.createQuotation(MOCK_ORG_ID, {
          leadId: MOCK_LEAD_ID,
          title: "Proposal for Non-Existent Lead",
          quotationType: "residentialInterior",
          status: QuotationStatus.DRAFT,
          version: "v1.0",
          grossSubtotal: 0,
          discountType: QuotationDiscountType.PERCENTAGE,
          discountPercent: 0,
          fixedDiscountAmount: 0,
          discountAmount: 0,
          taxableAmount: 0,
          gstPercent: 18,
          gstAmount: 0,
          grandTotal: 0,
          amountPaid: 0,
          targetMarginPercent: 25,
          tags: [],
          rooms: [],
          paymentSchedule: [],
          pdfPages: [],
        });
        expect(true).toBe(false); // Should not reach here
      } catch (err: any) {
        expect(err).toBeInstanceOf(ErrorResponse);
        expect(err.statusCode).toBe(statusCode.Not_Found);
      }
    });

    it("should auto-resolve customerId from lead and auto-generate unique quoteNumber", async () => {
      mock.restore();

      const mockLead = {
        id: MOCK_LEAD_ID,
        organizationId: MOCK_ORG_ID,
        customerId: MOCK_CUSTOMER_ID,
        title: "Mr. Singhania 3BHK",
        leadCode: "LEAD-2026-0042",
        customer: { id: MOCK_CUSTOMER_ID, firstName: "Vikram" },
      };

      const mockCreatedQuotation = {
        id: MOCK_QUOTATION_ID,
        organizationId: MOCK_ORG_ID,
        leadId: MOCK_LEAD_ID,
        customerId: MOCK_CUSTOMER_ID,
        quoteNumber: "HOM-QT-202609-0001",
        title: "3BHK Luxury Proposal",
        status: QuotationStatus.DRAFT,
        grandTotal: 560000,
        rooms: [],
        paymentSchedule: [],
        pdfPages: [],
        revisionHistory: [],
      };

      quotationRepository.findLeadById = mock(async () => mockLead as any);
      quotationRepository.countByPrefix = mock(async () => 0);
      quotationRepository.create = mock(async () => mockCreatedQuotation as any);

      const result = await service.createQuotation(MOCK_ORG_ID, {
        leadId: MOCK_LEAD_ID,
        title: "3BHK Luxury Proposal",
        quotationType: "residentialInterior",
        status: QuotationStatus.DRAFT,
        version: "v1.0",
        grossSubtotal: 500000,
        discountType: QuotationDiscountType.PERCENTAGE,
        discountPercent: 0,
        fixedDiscountAmount: 0,
        discountAmount: 0,
        taxableAmount: 500000,
        gstPercent: 18,
        gstAmount: 90000,
        grandTotal: 590000,
        amountPaid: 0,
        targetMarginPercent: 25,
        tags: [],
        rooms: [],
        paymentSchedule: [],
        pdfPages: [],
      });

      expect(result.id).toBe(MOCK_QUOTATION_ID);
      expect(result.quoteNumber).toBe("HOM-QT-202609-0001");
      expect(result.customerId).toBe(MOCK_CUSTOMER_ID);
    });

    it("should query paginated quotations with multi-criteria filters", async () => {
      mock.restore();

      const mockPaginatedResult = {
        data: [
          {
            id: MOCK_QUOTATION_ID,
            quoteNumber: "HOM-QT-202609-0001",
            title: "3BHK Luxury Proposal",
            status: QuotationStatus.DRAFT,
            grandTotal: 590000,
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };

      quotationRepository.findManyWithFilters = mock(async () => mockPaginatedResult as any);

      const query = {
        page: 1,
        limit: 10,
        search: "Luxury",
        status: QuotationStatus.DRAFT,
        sortBy: "createdAt" as const,
        sortOrder: "desc" as const,
      };

      const result = await service.getQuotations(MOCK_ORG_ID, query);
      expect(result.data.length).toBe(1);
      expect(result.pagination.total).toBe(1);
      expect(result.data[0]!.quoteNumber).toBe("HOM-QT-202609-0001");
    });
  });
});
