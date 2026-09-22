import { describe, it, expect } from "bun:test";
import {
  createVendorRfqSchema,
  updateVendorRfqSchema,
  updateVendorRfqStatusSchema,
  createRfqItemSchema,
  updateRfqItemSchema,
  createRfqInviteSchema,
  updateRfqInviteSchema,
  getVendorRfqsQuerySchema,
  vendorRfqIdParamSchema,
  rfqItemParamSchema,
  rfqInviteParamSchema,
} from "../../src/module/procurement/validators/vendor-rfq.validator.js";
import {
  MOCK_PROJECT_ID_1,
  MOCK_VENDOR_ID_1,
  MOCK_VENDOR_ID_2,
  MOCK_MATERIAL_PRODUCT_ID_2,
  MOCK_MATERIAL_REQUEST_ID,
  MOCK_VENDOR_RFQ_ID,
  MOCK_VENDOR_RFQ_ITEM_ID,
  MOCK_VENDOR_RFQ_INVITE_ID,
} from "./fixtures/procurement.fixtures.js";

describe("Vendor RFQ Validation & Logic Tests", () => {
  // =========================================================================
  // 1. Create Vendor RFQ Schema Tests
  // =========================================================================
  describe("Create Vendor RFQ Validation", () => {
    it("should validate a complete RFQ with items, invited vendors, and custom fields", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID_1,
        materialRequestId: MOCK_MATERIAL_REQUEST_ID,
        rfqNumber: "RFQ-2026-0045",
        title: "Tender for Italian Marble Flooring (Dyna Classic & Statuario)",
        rfqDate: "2026-10-12T09:00:00.000Z",
        deadline: "2026-10-22T17:00:00.000Z",
        priority: "HIGH" as const,
        status: "SENT" as const,
        deliveryLocation: "Site A, Sector 65, Gurugram",
        terms: "30% Advance, 70% against delivery and physical slab inspection",
        notes: "Only bookmatched lot with zero hairline cracks will be accepted",
        additionalInformation: {
          siteEngineer: "Vikram Malhotra",
          inspectionMandatory: true,
          toleranceInMm: 0.5,
        },
        items: [
          {
            materialProductId: MOCK_MATERIAL_PRODUCT_ID_2,
            name: "Dyna Classic Italian Marble 20mm Polish Slab",
            specifications: "First quality gangsaw cut slab, high gloss epoxy polish",
            brand: "Brescia Origin",
            quantity: 1200,
            unit: "SQFT",
            targetRate: 420.0,
            requiredDate: "2026-11-05T00:00:00.000Z",
            notes: "Thickness 18mm-20mm strictly",
          },
        ],
        vendorIds: [MOCK_VENDOR_ID_1, MOCK_VENDOR_ID_2],
      };

      const parsed = createVendorRfqSchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID_1);
      expect(parsed.materialRequestId).toBe(MOCK_MATERIAL_REQUEST_ID);
      expect(parsed.title).toContain("Italian Marble");
      expect(parsed.vendorIds?.length).toBe(2);
      expect(parsed.items?.length).toBe(1);
      expect(parsed.items?.[0]?.quantity).toBe(1200);
      expect((parsed.additionalInformation as Record<string, any>)?.toleranceInMm).toBe(0.5);
    });

    it("should require a title and valid deadline datetime", () => {
      const invalidPayload = {
        projectId: MOCK_PROJECT_ID_1,
        title: "",
        deadline: "not-a-date",
      };

      expect(() => createVendorRfqSchema.parse(invalidPayload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Vendor RFQ Schema Tests
  // =========================================================================
  describe("Update Vendor RFQ Validation", () => {
    it("should allow partial updates to deadline, terms, and notes", () => {
      const updatePayload = {
        deadline: "2026-10-25T18:00:00.000Z",
        terms: "Revised payment: 50% on dispatch, 50% on receipt",
        notes: "Deadline extended by 3 days upon vendor request",
      };

      const parsed = updateVendorRfqSchema.parse(updatePayload);
      expect(parsed.deadline).toBe("2026-10-25T18:00:00.000Z");
      expect(parsed.notes).toContain("Deadline extended");
    });
  });

  // =========================================================================
  // 3. Status Transitions & Status Schema Tests
  // =========================================================================
  describe("RFQ Status Transitions", () => {
    it("should validate updating status to RESPONSES_RECEIVED and CLOSED", () => {
      const statusPayload1 = { status: "RESPONSES_RECEIVED" as const, notes: "All quotes collected" };
      const parsed1 = updateVendorRfqStatusSchema.parse(statusPayload1);
      expect(parsed1.status).toBe("RESPONSES_RECEIVED");

      const statusPayload2 = { status: "CLOSED" as const, notes: "Awarded to lowest compliant bidder" };
      const parsed2 = updateVendorRfqStatusSchema.parse(statusPayload2);
      expect(parsed2.status).toBe("CLOSED");
    });

    it("should reject invalid status", () => {
      expect(() => updateVendorRfqStatusSchema.parse({ status: "INVALID_STATE" })).toThrow();
    });
  });

  // =========================================================================
  // 4. Vendor RFQ Invites & Vendor Response Tracking Tests
  // =========================================================================
  describe("Vendor RFQ Invites Validation", () => {
    it("should validate creating an invite for a vendor", () => {
      const invitePayload = {
        vendorId: MOCK_VENDOR_ID_1,
        notes: "Preferred natural stone distributor",
        additionalInformation: {
          whatsappSent: true,
          emailDispatched: true,
        },
      };

      const parsed = createRfqInviteSchema.parse(invitePayload);
      expect(parsed.vendorId).toBe(MOCK_VENDOR_ID_1);
      expect(parsed.additionalInformation?.whatsappSent).toBe(true);
    });

    it("should validate updating invite status to VIEWED and RESPONDED", () => {
      const updateInvitePayload = {
        status: "RESPONDED" as const,
        respondedAt: "2026-10-14T14:30:00.000Z",
        notes: "Quotation submitted via vendor portal",
      };

      const parsed = updateRfqInviteSchema.parse(updateInvitePayload);
      expect(parsed.status).toBe("RESPONDED");
      expect(parsed.respondedAt).toBe("2026-10-14T14:30:00.000Z");
    });

    it("should validate invite param schema", () => {
      const params = {
        rfqId: MOCK_VENDOR_RFQ_ID,
        inviteId: MOCK_VENDOR_RFQ_INVITE_ID,
      };

      const parsed = rfqInviteParamSchema.parse(params);
      expect(parsed.rfqId).toBe(MOCK_VENDOR_RFQ_ID);
      expect(parsed.inviteId).toBe(MOCK_VENDOR_RFQ_INVITE_ID);
    });
  });

  // =========================================================================
  // 5. Query Filters Validation Tests
  // =========================================================================
  describe("RFQ Query Parameters Validation", () => {
    it("should parse query filters with pagination", () => {
      const query = {
        page: "1",
        limit: "15",
        search: "Marble",
        status: "SENT" as const,
        priority: "HIGH" as const,
        projectId: MOCK_PROJECT_ID_1,
      };

      const parsed = getVendorRfqsQuerySchema.parse(query);
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(15);
      expect(parsed.search).toBe("Marble");
      expect(parsed.status).toBe("SENT");
    });
  });
});
