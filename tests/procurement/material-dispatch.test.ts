import { describe, it, expect } from "bun:test";
import {
  createMaterialDispatchSchema,
  updateMaterialDispatchSchema,
  updateMaterialDispatchStatusSchema,
  bulkReceiveDispatchSchema,
  createDispatchItemSchema,
  updateDispatchItemSchema,
  getMaterialDispatchesQuerySchema,
  materialDispatchIdParamSchema,
  dispatchItemParamSchema,
} from "../../src/module/procurement/validators/material-dispatch.validator.js";
import {
  MOCK_PROJECT_ID_1,
  MOCK_VENDOR_ID_1,
  MOCK_MATERIAL_PRODUCT_ID_2,
  MOCK_MATERIAL_DISPATCH_ID,
  MOCK_MATERIAL_DISPATCH_ITEM_ID,
  MOCK_VENDOR_QUOTATION_ID,
} from "./fixtures/procurement.fixtures.js";

describe("Material Dispatch & Delivery Tracking Tests", () => {
  // =========================================================================
  // 1. Create Material Dispatch Schema Tests
  // =========================================================================
  describe("Create Material Dispatch Validation", () => {
    it("should validate full dispatch creation payload with logistics & tracking data", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID_1,
        vendorId: MOCK_VENDOR_ID_1,
        quotationId: MOCK_VENDOR_QUOTATION_ID,
        dispatchNumber: "DSP-2026-0881",
        dispatchDate: "2026-10-25T09:00:00.000Z",
        expectedArrival: "2026-10-26T18:00:00.000Z",
        status: "IN_TRANSIT" as const,
        destinationAddress: "Site Villa 12, Emerald Hills, Sector 65, Gurugram",
        transporterName: "Delhivery Surface Freight Express",
        vehicleNumber: "HR-26-DD-4501",
        driverContact: "+91-9811223344",
        challanNumber: "CH-2026-4401",
        eWayBillNumber: "EWB-109283746501",
        freightAmount: 12000.0,
        additionalInformation: {
          gatePassRequired: true,
          craneAssistanceBooked: true,
        },
        items: [
          {
            materialProductId: MOCK_MATERIAL_PRODUCT_ID_2,
            name: "Dyna Classic Italian Marble 20mm Polish Slab",
            unit: "SQFT",
            dispatchedQuantity: 1200,
            condition: "GOOD" as const,
            batchLot: "LOT-IT-2026-09",
            remarks: "Packed across 3 wooden crates",
          },
        ],
      };

      const parsed = createMaterialDispatchSchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID_1);
      expect(parsed.vendorId).toBe(MOCK_VENDOR_ID_1);
      expect(parsed.dispatchNumber).toBe("DSP-2026-0881");
      expect(parsed.status).toBe("IN_TRANSIT");
      expect(parsed.transporterName).toBe("Delhivery Surface Freight Express");
      expect(parsed.items?.length).toBe(1);
      expect(parsed.items?.[0]?.dispatchedQuantity).toBe(1200);
      expect(parsed.items?.[0]?.condition).toBe("GOOD");
      expect((parsed.additionalInformation as Record<string, any>)?.craneAssistanceBooked).toBe(true);
    });

    it("should reject dispatch without expectedArrival date", () => {
      const invalidPayload = {
        projectId: MOCK_PROJECT_ID_1,
        vendorId: MOCK_VENDOR_ID_1,
      };

      expect(() => createMaterialDispatchSchema.parse(invalidPayload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Bulk Delivery Receipt & Site QA Inspection Tests
  // =========================================================================
  describe("Bulk Delivery Receipt & QA Inspection", () => {
    it("should validate bulk receipt with accepted, rejected, and shortage breakdown", () => {
      const receiptPayload = {
        actualArrival: "2026-10-26T17:30:00.000Z",
        siteInspectionNotes: "Verified at site unloading. 1150 sqft intact, 50 sqft chipped at corner.",
        status: "PARTIALLY_RECEIVED" as const,
        items: [
          {
            id: MOCK_MATERIAL_DISPATCH_ITEM_ID,
            receivedQuantity: 1200,
            acceptedQuantity: 1150,
            rejectedQuantity: 50,
            condition: "DAMAGED" as const,
            remarks: "50 sqft damaged in transit due to strap compression",
          },
        ],
      };

      const parsed = bulkReceiveDispatchSchema.parse(receiptPayload);
      expect(parsed.status).toBe("PARTIALLY_RECEIVED");
      expect(parsed.items.length).toBe(1);
      expect(parsed.items[0]?.acceptedQuantity).toBe(1150);
      expect(parsed.items[0]?.rejectedQuantity).toBe(50);
      expect(parsed.items[0]?.condition).toBe("DAMAGED");
    });

    it("should reject bulk receipt with empty items list", () => {
      const emptyItemsPayload = {
        status: "RECEIVED" as const,
        items: [],
      };

      expect(() => bulkReceiveDispatchSchema.parse(emptyItemsPayload)).toThrow();
    });
  });

  // =========================================================================
  // 3. Status Transition Schema Tests
  // =========================================================================
  describe("Dispatch Status Transitions", () => {
    it("should validate transition to DELIVERED and RECEIVED", () => {
      const deliveredPayload = {
        status: "DELIVERED" as const,
        actualArrival: "2026-10-26T16:45:00.000Z",
        siteInspectionNotes: "Truck reached site gate, waiting for unloading crew",
      };

      const parsed = updateMaterialDispatchStatusSchema.parse(deliveredPayload);
      expect(parsed.status).toBe("DELIVERED");
      expect(parsed.actualArrival).toBe("2026-10-26T16:45:00.000Z");
    });
  });

  // =========================================================================
  // 4. Query Schema Validation Tests
  // =========================================================================
  describe("Material Dispatch Query Parameters Validation", () => {
    it("should parse query string filters for tracking and statuses", () => {
      const query = {
        page: "1",
        limit: "10",
        search: "Delhivery",
        status: "IN_TRANSIT" as const,
        projectId: MOCK_PROJECT_ID_1,
        vendorId: MOCK_VENDOR_ID_1,
      };

      const parsed = getMaterialDispatchesQuerySchema.parse(query);
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(10);
      expect(parsed.search).toBe("Delhivery");
      expect(parsed.status).toBe("IN_TRANSIT");
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID_1);
    });
  });
});
