import { describe, it, expect } from "bun:test";
import {
  createVendorQuotationSchema,
  updateVendorQuotationSchema,
  updateVendorQuotationStatusSchema,
  createQuotationItemSchema,
  updateQuotationItemSchema,
  getVendorQuotationsQuerySchema,
  vendorQuotationIdParamSchema,
  quotationItemParamSchema,
} from "../../src/module/procurement/validators/vendor-quotation.validator.js";
import {
  MOCK_PROJECT_ID_1,
  MOCK_VENDOR_ID_1,
  MOCK_VENDOR_RFQ_ID,
  MOCK_VENDOR_RFQ_ITEM_ID,
  MOCK_MATERIAL_PRODUCT_ID_2,
  MOCK_VENDOR_QUOTATION_ID,
  MOCK_VENDOR_QUOTATION_ITEM_ID,
} from "./fixtures/procurement.fixtures.js";

describe("Vendor Quotation Validation & Calculation Tests", () => {
  // =========================================================================
  // 1. Create Vendor Quotation Schema Tests
  // =========================================================================
  describe("Create Vendor Quotation Validation", () => {
    it("should validate complete vendor quotation with item breakdown and commercial terms", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID_1,
        vendorId: MOCK_VENDOR_ID_1,
        rfqId: MOCK_VENDOR_RFQ_ID,
        quotationNumber: "QUO-2026-9901",
        quoteDate: "2026-10-14T10:00:00.000Z",
        validUntil: "2026-11-14T23:59:59.000Z",
        currency: "INR",
        status: "RECEIVED" as const,
        subtotal: 504000.0,
        discount: 14000.0,
        tax: 88200.0,
        freight: 12000.0,
        totalAmount: 590200.0,
        paymentTerms: "30% advance, 70% against delivery challan",
        deliveryTimeline: "7-10 working days from PO confirmation",
        warrantyPeriod: "1 Year against quarry pitting",
        additionalInformation: {
          gstin: "07AAAAA1234A1Z5",
          insuranceCoverage: "Transit insurance included",
        },
        items: [
          {
            rfqItemId: MOCK_VENDOR_RFQ_ITEM_ID,
            materialProductId: MOCK_MATERIAL_PRODUCT_ID_2,
            name: "Dyna Classic Italian Marble 20mm Polish Slab",
            brand: "Brescia Origin",
            specifications: "Export quality bookmatched slabs",
            quantity: 1200,
            unit: "SQFT",
            unitRate: 420.0,
            taxRate: 18.0,
            discountPercent: 2.77,
            totalAmount: 590200.0,
            deliveryDays: "7",
            remarks: "Crated in heavy wooden crates",
          },
        ],
      };

      const parsed = createVendorQuotationSchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID_1);
      expect(parsed.vendorId).toBe(MOCK_VENDOR_ID_1);
      expect(parsed.quotationNumber).toBe("QUO-2026-9901");
      expect(parsed.totalAmount).toBe(590200.0);
      expect(parsed.items?.length).toBe(1);
      expect(parsed.items?.[0]?.unitRate).toBe(420.0);
      expect((parsed.additionalInformation as Record<string, any>)?.gstin).toBe("07AAAAA1234A1Z5");
    });

    it("should reject quotation with negative totalAmount or subtotal", () => {
      const invalidPayload = {
        projectId: MOCK_PROJECT_ID_1,
        vendorId: MOCK_VENDOR_ID_1,
        validUntil: "2026-11-14T23:59:59.000Z",
        totalAmount: -100,
      };

      expect(() => createVendorQuotationSchema.parse(invalidPayload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Vendor Quotation & Evaluation Tests
  // =========================================================================
  describe("Update & Evaluate Vendor Quotation", () => {
    it("should allow partial updates to evaluationNotes and vendorRating", () => {
      const updatePayload = {
        vendorRating: 4.8,
        evaluationNotes: "Vendor offers lowest rate and shortest delivery lead time of 7 days",
        status: "SHORTLISTED" as const,
      };

      const parsed = updateVendorQuotationSchema.parse(updatePayload);
      expect(parsed.vendorRating).toBe(4.8);
      expect(parsed.status).toBe("SHORTLISTED");
      expect(parsed.evaluationNotes).toContain("lowest rate");
    });

    it("should reject vendorRating greater than 5 or less than 0", () => {
      expect(() =>
        updateVendorQuotationSchema.parse({
          vendorRating: 5.5,
        })
      ).toThrow();

      expect(() =>
        updateVendorQuotationSchema.parse({
          vendorRating: -1,
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 3. Status Transitions (Shortlisted, Accepted, Rejected) Tests
  // =========================================================================
  describe("Quotation Status Transitions", () => {
    it("should validate ACCEPTED status with final evaluation notes", () => {
      const acceptPayload = {
        status: "ACCEPTED" as const,
        evaluationNotes: "Commercial terms approved by Project Director",
        vendorRating: 5.0,
      };

      const parsed = updateVendorQuotationStatusSchema.parse(acceptPayload);
      expect(parsed.status).toBe("ACCEPTED");
      expect(parsed.vendorRating).toBe(5.0);
    });

    it("should validate REJECTED status", () => {
      const rejectPayload = {
        status: "REJECTED" as const,
        evaluationNotes: "Price was 15% higher than competitive benchmark",
      };

      const parsed = updateVendorQuotationStatusSchema.parse(rejectPayload);
      expect(parsed.status).toBe("REJECTED");
    });
  });

  // =========================================================================
  // 4. Query Schema & Side-by-Side Comparison Query
  // =========================================================================
  describe("Quotation Query & Comparison Validation", () => {
    it("should parse quotation search filters", () => {
      const query = {
        page: "1",
        limit: "20",
        projectId: MOCK_PROJECT_ID_1,
        rfqId: MOCK_VENDOR_RFQ_ID,
        status: "ACCEPTED" as const,
      };

      const parsed = getVendorQuotationsQuerySchema.parse(query);
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.rfqId).toBe(MOCK_VENDOR_RFQ_ID);
      expect(parsed.status).toBe("ACCEPTED");
    });
  });
});
