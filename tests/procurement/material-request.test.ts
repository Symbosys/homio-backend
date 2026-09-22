import { describe, it, expect } from "bun:test";
import {
  createMaterialRequestSchema,
  updateMaterialRequestSchema,
  updateMaterialRequestStatusSchema,
  createMaterialRequestItemSchema,
  updateMaterialRequestItemSchema,
  getMaterialRequestsQuerySchema,
  materialRequestIdParamSchema,
  materialRequestItemParamSchema,
} from "../../src/module/procurement/validators/material-request.validator.js";
import {
  MOCK_PROJECT_ID_1,
  MOCK_USER_ID_1,
  MOCK_USER_ID_2,
  MOCK_MATERIAL_PRODUCT_ID_1,
  MOCK_MATERIAL_REQUEST_ID,
  MOCK_MATERIAL_REQUEST_ITEM_ID,
} from "./fixtures/procurement.fixtures.js";

describe("Material Request Validation & Logic Tests", () => {
  // =========================================================================
  // 1. Create Material Request Schema Tests
  // =========================================================================
  describe("Create Material Request Validation", () => {
    it("should validate a complete material request payload with items and additional information", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID_1,
        requestNumber: "MR-2026-0001",
        requestDate: "2026-10-10T10:00:00.000Z",
        requiredByDate: "2026-10-25T18:00:00.000Z",
        priority: "HIGH" as const,
        status: "SUBMITTED" as const,
        siteLocation: "Tower A, 14th Floor Penthouse",
        category: "Electrical & Lighting",
        reason: "Concealed wiring and junction box installation before false ceiling work",
        notes: "Use copper wire coils from approved brands only",
        estimatedCost: 85000.0,
        requestedById: MOCK_USER_ID_1,
        additionalInformation: {
          siteSupervisor: "Rajesh Sharma",
          contractorCode: "CONT-MEP-04",
          isUrgentInspectionRequired: true,
        },
        items: [
          {
            materialProductId: MOCK_MATERIAL_PRODUCT_ID_1,
            name: "Finolex 2.5 sq mm FRLS Copper Wire",
            sku: "FIN-25-RED",
            brand: "Finolex",
            specifications: "IS:694 certified, 1100V grade, 90m coil",
            dimensions: "90m roll",
            quantity: 12,
            unit: "COIL",
            estimatedRate: 2450.0,
            estimatedAmount: 29400.0,
            requiredDate: "2026-10-25T18:00:00.000Z",
            notes: "Red color code",
            additionalInformation: {
              batchPreference: "Q3-2026",
            },
          },
        ],
      };

      const parsed = createMaterialRequestSchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID_1);
      expect(parsed.requestNumber).toBe("MR-2026-0001");
      expect(parsed.priority).toBe("HIGH");
      expect(parsed.status).toBe("SUBMITTED");
      expect(parsed.estimatedCost).toBe(85000.0);
      expect(parsed.items?.length).toBe(1);
      expect(parsed.items?.[0]?.quantity).toBe(12);
      expect((parsed.additionalInformation as Record<string, any>)?.contractorCode).toBe("CONT-MEP-04");
    });

    it("should allow minimal material request with required fields and defaults", () => {
      const minimalPayload = {
        projectId: MOCK_PROJECT_ID_1,
        requiredByDate: "2026-10-30T00:00:00.000Z",
      };

      const parsed = createMaterialRequestSchema.parse(minimalPayload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID_1);
      expect(parsed.priority).toBe("NORMAL");
      expect(parsed.status).toBe("SUBMITTED");
      expect(parsed.estimatedCost).toBe(0);
      expect(parsed.approvedCost).toBe(0);
      expect(parsed.items).toEqual([]);
    });

    it("should reject payload when projectId is not a valid UUID", () => {
      const invalidPayload = {
        projectId: "invalid-uuid-format",
        requiredByDate: "2026-10-30T00:00:00.000Z",
      };

      expect(() => createMaterialRequestSchema.parse(invalidPayload)).toThrow();
    });

    it("should reject payload with negative estimated cost", () => {
      const invalidPayload = {
        projectId: MOCK_PROJECT_ID_1,
        requiredByDate: "2026-10-30T00:00:00.000Z",
        estimatedCost: -500,
      };

      expect(() => createMaterialRequestSchema.parse(invalidPayload)).toThrow();
    });

    it("should reject item with zero or negative quantity", () => {
      const invalidItemPayload = {
        projectId: MOCK_PROJECT_ID_1,
        requiredByDate: "2026-10-30T00:00:00.000Z",
        items: [
          {
            name: "Conduit Pipes",
            quantity: 0,
            unit: "METER",
            requiredDate: "2026-10-30T00:00:00.000Z",
          },
        ],
      };

      expect(() => createMaterialRequestSchema.parse(invalidItemPayload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Material Request Schema Tests
  // =========================================================================
  describe("Update Material Request Validation", () => {
    it("should allow partial updates to reason, siteLocation, and priority", () => {
      const updatePayload = {
        priority: "CRITICAL" as const,
        siteLocation: "Tower B, 12th Floor",
        reason: "Client requested urgent handover date",
        approvedCost: 92000.0,
      };

      const parsed = updateMaterialRequestSchema.parse(updatePayload);
      expect(parsed.priority).toBe("CRITICAL");
      expect(parsed.siteLocation).toBe("Tower B, 12th Floor");
      expect(parsed.approvedCost).toBe(92000.0);
    });

    it("should support updating custom key-value additionalInformation", () => {
      const updatePayload = {
        additionalInformation: {
          siteSupervisor: "Vikram Malhotra",
          safetyClearanceReceived: true,
          revisedBudgetCap: 120000,
        },
      };

      const parsed = updateMaterialRequestSchema.parse(updatePayload);
      expect(parsed.additionalInformation?.safetyClearanceReceived).toBe(true);
    });
  });

  // =========================================================================
  // 3. Status Transition Schema Tests
  // =========================================================================
  describe("Material Request Status Transition Validation", () => {
    it("should validate status transition to APPROVED with approvedCost and review notes", () => {
      const statusPayload = {
        status: "APPROVED" as const,
        notes: "Approved after verifying site survey and estimated BOQ rates",
        approvedCost: 78500.0,
      };

      const parsed = updateMaterialRequestStatusSchema.parse(statusPayload);
      expect(parsed.status).toBe("APPROVED");
      expect(parsed.approvedCost).toBe(78500.0);
    });

    it("should validate status transition to REJECTED or CANCELLED", () => {
      const rejectPayload = {
        status: "REJECTED" as const,
        notes: "Duplicate request already raised under MR-2026-0008",
      };

      const parsed = updateMaterialRequestStatusSchema.parse(rejectPayload);
      expect(parsed.status).toBe("REJECTED");
    });

    it("should reject invalid status string", () => {
      const invalidStatus = {
        status: "UNKNOWN_STATUS",
      };

      expect(() => updateMaterialRequestStatusSchema.parse(invalidStatus)).toThrow();
    });
  });

  // =========================================================================
  // 4. Material Request Items Validation
  // =========================================================================
  describe("Material Request Item Validation", () => {
    it("should validate item update with fulfilled quantity and approved quantity", () => {
      const itemUpdate = {
        approvedQuantity: 10,
        fulfilledQuantity: 8,
        notes: "8 units dispatched by vendor, 2 pending next lot",
      };

      const parsed = updateMaterialRequestItemSchema.parse(itemUpdate);
      expect(parsed.approvedQuantity).toBe(10);
      expect(parsed.fulfilledQuantity).toBe(8);
    });

    it("should validate item param identifiers", () => {
      const params = {
        requestId: MOCK_MATERIAL_REQUEST_ID,
        itemId: MOCK_MATERIAL_REQUEST_ITEM_ID,
      };

      const parsed = materialRequestItemParamSchema.parse(params);
      expect(parsed.requestId).toBe(MOCK_MATERIAL_REQUEST_ID);
      expect(parsed.itemId).toBe(MOCK_MATERIAL_REQUEST_ITEM_ID);
    });
  });

  // =========================================================================
  // 5. Query Filters & Pagination Tests
  // =========================================================================
  describe("Material Request Query Parameters Validation", () => {
    it("should parse query string numbers and provide defaults", () => {
      const query = {
        page: "2",
        limit: "25",
        search: "Copper Wire",
        status: "UNDER_REVIEW" as const,
        priority: "HIGH" as const,
        projectId: MOCK_PROJECT_ID_1,
      };

      const parsed = getMaterialRequestsQuerySchema.parse(query);
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(25);
      expect(parsed.search).toBe("Copper Wire");
      expect(parsed.status).toBe("UNDER_REVIEW");
      expect(parsed.priority).toBe("HIGH");
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID_1);
      expect(parsed.sortBy).toBe("createdAt");
      expect(parsed.sortOrder).toBe("desc");
    });

    it("should handle empty query object with sensible defaults", () => {
      const parsed = getMaterialRequestsQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(10);
      expect(parsed.sortBy).toBe("createdAt");
      expect(parsed.sortOrder).toBe("desc");
    });
  });
});
