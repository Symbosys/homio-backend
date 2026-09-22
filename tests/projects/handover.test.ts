import { describe, it, expect } from "bun:test";
import {
  createHandoverSchema,
  updateHandoverSchema,
  updateHandoverStatusSchema,
  commercialClearanceSchema,
  handoverSignoffSchema,
  createHandoverItemSchema,
  updateHandoverItemSchema,
  updateHandoverItemStatusSchema,
  bulkHandoverItemsSchema,
  createHandoverSnagSchema,
  updateHandoverSnagSchema,
  resolveHandoverSnagSchema,
  verifyHandoverSnagSchema,
  getHandoversQuerySchema,
  getHandoverItemsQuerySchema,
  getHandoverSnagsQuerySchema,
  handoverIdParamSchema,
  handoverItemParamSchema,
  handoverSnagParamSchema,
} from "../../src/module/projects/validators/handover.validator.js";
import {
  MOCK_PROJECT_ID,
  MOCK_CUSTOMER_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_EMPLOYEE_ID_2,
} from "../leads-crm/fixtures/crm.fixtures.js";

describe("Project Handover & Possession Management Tests", () => {
  const MOCK_HANDOVER_ID = "11112222-3333-4444-8555-666677778888";
  const MOCK_ITEM_ID = "22223333-4444-4555-8666-777788889999";
  const MOCK_SNAG_ID = "33334444-5555-4666-8777-888899990000";

  // =========================================================================
  // 1. Create Handover Validation
  // =========================================================================
  describe("Create Handover Validation", () => {
    it("should validate full handover creation payload with warranties, nested items, snags and additional information", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID,
        customerId: MOCK_CUSTOMER_ID,
        handoverNumber: "HND-2026-0001",
        title: "Villa 402 Final Possession & Handover Docket",
        description: "Official key handover, warranty certificates, and appliance manuals transfer to client.",
        status: "DRAFT" as const,
        scheduledDate: "2026-10-15",
        isCommercialCleared: false,
        finalSettlementAmount: 1850000.0,
        pendingAmount: 125000.0,
        commercialRemarks: "Final retention amount pending bank disbursement",
        warrantyPeriodMonths: 24,
        warrantyStartDate: "2026-10-15T00:00:00.000Z",
        warrantyEndDate: "2028-10-15T00:00:00.000Z",
        warrantyTerms: "Comprehensive 2-year warranty on modular woodwork, plumbing fittings, and waterproofing.",
        handedOverById: MOCK_EMPLOYEE_ID_1,
        additionalInformation: {
          handoverVenue: "Site Office & Villa 402",
          witnessName: "Vikram Mehta (Legal Counsel)",
          snagResolutionEscrowDays: 14,
        },
        items: [
          {
            category: "KEYS" as const,
            name: "Main Entrance Smart Digital Lock Card & Physical Override Keys",
            description: "2 RFID keycards and 3 brass master keys for Yale smart deadbolt",
            quantity: 3,
            unit: "PCS",
            status: "PENDING" as const,
            additionalInformation: {
              lockSerialNumber: "YALE-SL-88392",
            },
          },
          {
            category: "WARRANTY_DOCUMENT" as const,
            name: "Hafele Modular Kitchen Hardware Warranty Card",
            quantity: 1,
            unit: "DOC",
            status: "VERIFIED" as const,
          },
        ],
        snags: [
          {
            areaRoom: "Master Suite Balcony",
            title: "Minor paint scuff mark near aluminium sliding track",
            severity: "LOW" as const,
            status: "REPORTED" as const,
            assignedToId: MOCK_EMPLOYEE_ID_2,
            targetResolutionDate: "2026-10-10",
            additionalInformation: {
              paintCode: "Asian Paints Royale 0412",
            },
          },
        ],
      };

      const parsed = createHandoverSchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.customerId).toBe(MOCK_CUSTOMER_ID);
      expect(parsed.handoverNumber).toBe("HND-2026-0001");
      expect(parsed.title).toContain("Villa 402 Final Possession");
      expect(parsed.status).toBe("DRAFT");
      expect(parsed.warrantyPeriodMonths).toBe(24);
      expect(parsed.finalSettlementAmount).toBe(1850000.0);
      expect(parsed.pendingAmount).toBe(125000.0);
      expect(parsed.items?.length).toBe(2);
      expect(parsed.items?.[0]?.category).toBe("KEYS");
      expect(parsed.snags?.length).toBe(1);
      expect(parsed.snags?.[0]?.areaRoom).toBe("Master Suite Balcony");
      expect((parsed.additionalInformation as Record<string, any>)?.witnessName).toBe("Vikram Mehta (Legal Counsel)");
    });

    it("should allow minimal handover creation with default values", () => {
      const minimalPayload = {
        projectId: MOCK_PROJECT_ID,
        title: "Penthouse 1401 Handover",
      };

      const parsed = createHandoverSchema.parse(minimalPayload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.title).toBe("Penthouse 1401 Handover");
      expect(parsed.status).toBe("DRAFT");
      expect(parsed.warrantyPeriodMonths).toBe(12);
      expect(parsed.isCommercialCleared).toBe(false);
      expect(parsed.items).toEqual([]);
      expect(parsed.snags).toEqual([]);
    });

    it("should reject creation when required projectId or title is missing", () => {
      expect(() =>
        createHandoverSchema.parse({
          title: "Missing Project ID",
        })
      ).toThrow();

      expect(() =>
        createHandoverSchema.parse({
          projectId: MOCK_PROJECT_ID,
        })
      ).toThrow();
    });

    it("should reject creation with invalid projectId format", () => {
      expect(() =>
        createHandoverSchema.parse({
          projectId: "not-a-valid-uuid",
          title: "Invalid Project UUID",
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Handover Validation
  // =========================================================================
  describe("Update Handover Validation", () => {
    it("should validate partial updates (dirty fields)", () => {
      const updatePayload = {
        scheduledDate: "2026-10-20",
        inspectedDate: "2026-10-18T14:30:00.000Z",
        warrantyPeriodMonths: 36,
        warrantyTerms: "Extended 36-month structural and woodwork warranty applied.",
        additionalInformation: {
          handoverManagerAssigned: "Suresh Pillai",
        },
      };

      const parsed = updateHandoverSchema.parse(updatePayload);
      expect(parsed.scheduledDate).toBe("2026-10-20");
      expect(parsed.warrantyPeriodMonths).toBe(36);
      expect(parsed.warrantyTerms).toContain("Extended 36-month");
      expect((parsed.additionalInformation as Record<string, any>)?.handoverManagerAssigned).toBe("Suresh Pillai");
    });
  });

  // =========================================================================
  // 3. Status Transitions Validation
  // =========================================================================
  describe("Status Transitions Validation", () => {
    it("should validate valid lifecycle status transitions", () => {
      const validStatuses = [
        "DRAFT",
        "SCHEDULED",
        "INSPECTION_PENDING",
        "SNAGS_IN_PROGRESS",
        "CLIENT_REVIEW",
        "ACCEPTED",
        "REJECTED",
        "COMPLETED",
        "CANCELLED",
      ] as const;

      for (const status of validStatuses) {
        const parsed = updateHandoverStatusSchema.parse({
          status,
          statusNotes: `Handover status moved to ${status}`,
        });
        expect(parsed.status).toBe(status);
      }
    });

    it("should reject invalid handover status strings", () => {
      expect(() =>
        updateHandoverStatusSchema.parse({
          status: "INVALID_STATUS_CODE",
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 4. Commercial Clearance Validation
  // =========================================================================
  describe("Commercial Clearance Validation", () => {
    it("should validate financial clearance approval with zero pending amount", () => {
      const clearancePayload = {
        isCommercialCleared: "true",
        finalSettlementAmount: 2450000.0,
        pendingAmount: 0,
        commercialRemarks: "All milestone invoices, change orders, and final retention cleared in full.",
      };

      const parsed = commercialClearanceSchema.parse(clearancePayload);
      expect(parsed.isCommercialCleared).toBe(true);
      expect(parsed.finalSettlementAmount).toBe(2450000.0);
      expect(parsed.pendingAmount).toBe(0);
      expect(parsed.commercialRemarks).toContain("All milestone invoices");
    });

    it("should reject negative financial amounts", () => {
      expect(() =>
        commercialClearanceSchema.parse({
          isCommercialCleared: true,
          finalSettlementAmount: -500,
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 5. Client Sign-off & Digital Signature Validation
  // =========================================================================
  describe("Client Sign-off Validation", () => {
    it("should validate client sign-off with satisfaction rating and feedback", () => {
      const signoffPayload = {
        clientSignoffName: "Dr. Ananya Roy & Mr. Joy Roy",
        clientSignedAt: "2026-10-22T16:00:00.000Z",
        clientFeedback: "Delighted with the craftsmanship and seamless walkthrough process. Snags were resolved quickly!",
        clientRating: "4.8",
        additionalInformation: {
          possessionKitHandedOver: true,
          keysHandoverWitness: "Pooja Verma",
        },
      };

      const parsed = handoverSignoffSchema.parse(signoffPayload);
      expect(parsed.clientSignoffName).toBe("Dr. Ananya Roy & Mr. Joy Roy");
      expect(parsed.clientRating).toBe(4.8);
      expect(parsed.clientFeedback).toContain("Delighted with the craftsmanship");
      expect((parsed.additionalInformation as Record<string, any>)?.possessionKitHandedOver).toBe(true);
    });

    it("should reject invalid client ratings outside 1.0 to 5.0 range", () => {
      expect(() =>
        handoverSignoffSchema.parse({
          clientSignoffName: "Valid Name",
          clientRating: 6.0,
        })
      ).toThrow();

      expect(() =>
        handoverSignoffSchema.parse({
          clientSignoffName: "Valid Name",
          clientRating: 0.5,
        })
      ).toThrow();
    });

    it("should reject signoff when clientSignoffName is empty", () => {
      expect(() =>
        handoverSignoffSchema.parse({
          clientSignoffName: "",
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 6. Deliverable Checklist Items Validation
  // =========================================================================
  describe("Deliverable Checklist Items Validation", () => {
    it("should validate deliverable item creation with category and metadata", () => {
      const itemPayload = {
        category: "ACCESS_CARD_OR_REMOTE" as const,
        name: "Basement Parking RFID Remote & Gate Clicker",
        description: "2 battery-powered remote controllers for automated basement gates",
        quantity: "2",
        unit: "PCS",
        status: "PENDING" as const,
        recipientName: "Joy Roy",
        notes: "Tested range up to 25 meters",
        additionalInformation: {
          frequency: "433.92 MHz",
        },
      };

      const parsed = createHandoverItemSchema.parse(itemPayload);
      expect(parsed.category).toBe("ACCESS_CARD_OR_REMOTE");
      expect(parsed.name).toBe("Basement Parking RFID Remote & Gate Clicker");
      expect(parsed.quantity).toBe(2);
      expect(parsed.recipientName).toBe("Joy Roy");
    });

    it("should validate item status transition to HANDED_OVER", () => {
      const statusPayload = {
        status: "HANDED_OVER" as const,
        handedOverAt: "2026-10-22T15:30:00.000Z",
        recipientName: "Joy Roy",
        notes: "Acknowledged and received in person",
      };

      const parsed = updateHandoverItemStatusSchema.parse(statusPayload);
      expect(parsed.status).toBe("HANDED_OVER");
      expect(parsed.recipientName).toBe("Joy Roy");
      expect(parsed.notes).toContain("Acknowledged and received");
    });

    it("should validate bulk handover checklist items", () => {
      const bulkPayload = {
        itemIds: [MOCK_ITEM_ID, "22223333-4444-4555-8666-777788880001"],
        recipientName: "Dr. Ananya Roy",
        notes: "Handed over together during formal possession walkthrough",
      };

      const parsed = bulkHandoverItemsSchema.parse(bulkPayload);
      expect(parsed.itemIds.length).toBe(2);
      expect(parsed.recipientName).toBe("Dr. Ananya Roy");
    });

    it("should reject bulk handover when itemIds array is empty", () => {
      expect(() =>
        bulkHandoverItemsSchema.parse({
          itemIds: [],
          recipientName: "Anyone",
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 7. Pre-Handover Punch-List Snags Validation
  // =========================================================================
  describe("Pre-Handover Punch-List Snags Validation", () => {
    it("should validate snag creation with severity and assigned technician", () => {
      const snagPayload = {
        areaRoom: "Kitchen Island",
        title: "Quartz countertop corner has 2mm sealant gap",
        description: "Silicone sealant along the breakfast counter edge is discontinuous.",
        severity: "MEDIUM" as const,
        status: "REPORTED" as const,
        assignedToId: MOCK_EMPLOYEE_ID_2,
        targetResolutionDate: "2026-10-12",
        additionalInformation: {
          subcontractorTrade: "Stonework & Countertops",
        },
      };

      const parsed = createHandoverSnagSchema.parse(snagPayload);
      expect(parsed.areaRoom).toBe("Kitchen Island");
      expect(parsed.severity).toBe("MEDIUM");
      expect(parsed.status).toBe("REPORTED");
      expect(parsed.assignedToId).toBe(MOCK_EMPLOYEE_ID_2);
      expect((parsed.additionalInformation as Record<string, any>)?.subcontractorTrade).toBe("Stonework & Countertops");
    });

    it("should validate snag resolution submission", () => {
      const resolvePayload = {
        resolvedNotes: "Resealed with anti-fungal Dow Corning white silicone. Buffed and cured for 24h.",
        resolvedAt: "2026-10-13T11:00:00.000Z",
      };

      const parsed = resolveHandoverSnagSchema.parse(resolvePayload);
      expect(parsed.resolvedNotes).toContain("Resealed with anti-fungal");
      expect(parsed.resolvedAt).toBe("2026-10-13T11:00:00.000Z");
    });

    it("should validate client verification of resolved snag", () => {
      const verifyAccepted = {
        status: "ACCEPTED_BY_CLIENT" as const,
        verificationNotes: "Inspected during final walkthrough; silicone joint is neat and seamless.",
      };

      const parsed = verifyHandoverSnagSchema.parse(verifyAccepted);
      expect(parsed.status).toBe("ACCEPTED_BY_CLIENT");

      const verifyWaived = {
        status: "WAIVED" as const,
        verificationNotes: "Client opted to retain custom accent tile as-is.",
      };

      const parsedWaived = verifyHandoverSnagSchema.parse(verifyWaived);
      expect(parsedWaived.status).toBe("WAIVED");
    });

    it("should reject snag verification with unauthorized status", () => {
      expect(() =>
        verifyHandoverSnagSchema.parse({
          status: "IN_PROGRESS",
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 8. Query Filters & Pagination Tests
  // =========================================================================
  describe("Handover Query Parameters Validation", () => {
    it("should parse query string numbers, booleans, and filters", () => {
      const query = {
        page: "2",
        limit: "15",
        search: "Villa 402",
        projectId: MOCK_PROJECT_ID,
        customerId: MOCK_CUSTOMER_ID,
        status: "ACCEPTED" as const,
        isCommercialCleared: "true",
        handedOverById: MOCK_EMPLOYEE_ID_1,
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        sortBy: "handoverDate",
        sortOrder: "desc" as const,
      };

      const parsed = getHandoversQuerySchema.parse(query);
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(15);
      expect(parsed.search).toBe("Villa 402");
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.customerId).toBe(MOCK_CUSTOMER_ID);
      expect(parsed.status).toBe("ACCEPTED");
      expect(parsed.isCommercialCleared).toBe(true);
      expect(parsed.sortBy).toBe("handoverDate");
      expect(parsed.sortOrder).toBe("desc");
    });

    it("should handle empty query object with standard defaults", () => {
      const parsed = getHandoversQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(10);
      expect(parsed.sortBy).toBe("createdAt");
      expect(parsed.sortOrder).toBe("desc");
    });

    it("should validate sub-query filters for items and snags", () => {
      const itemQuery = {
        category: "KEYS" as const,
        status: "VERIFIED" as const,
        search: "Master",
      };
      const parsedItemQuery = getHandoverItemsQuerySchema.parse(itemQuery);
      expect(parsedItemQuery.category).toBe("KEYS");
      expect(parsedItemQuery.status).toBe("VERIFIED");

      const snagQuery = {
        severity: "CRITICAL" as const,
        status: "REPORTED" as const,
        areaRoom: "Master Suite",
        assignedToId: MOCK_EMPLOYEE_ID_2,
      };
      const parsedSnagQuery = getHandoverSnagsQuerySchema.parse(snagQuery);
      expect(parsedSnagQuery.severity).toBe("CRITICAL");
      expect(parsedSnagQuery.areaRoom).toBe("Master Suite");
    });
  });

  // =========================================================================
  // 9. Route Param Schemas Validation
  // =========================================================================
  describe("Route Param Identifiers Validation", () => {
    it("should validate handoverId param", () => {
      const parsed = handoverIdParamSchema.parse({ id: MOCK_HANDOVER_ID });
      expect(parsed.id).toBe(MOCK_HANDOVER_ID);
    });

    it("should validate handoverItemParamSchema", () => {
      const parsed = handoverItemParamSchema.parse({
        handoverId: MOCK_HANDOVER_ID,
        itemId: MOCK_ITEM_ID,
      });
      expect(parsed.handoverId).toBe(MOCK_HANDOVER_ID);
      expect(parsed.itemId).toBe(MOCK_ITEM_ID);
    });

    it("should validate handoverSnagParamSchema", () => {
      const parsed = handoverSnagParamSchema.parse({
        handoverId: MOCK_HANDOVER_ID,
        snagId: MOCK_SNAG_ID,
      });
      expect(parsed.handoverId).toBe(MOCK_HANDOVER_ID);
      expect(parsed.snagId).toBe(MOCK_SNAG_ID);
    });
  });
});
