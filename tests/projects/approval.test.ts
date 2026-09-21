import { describe, it, expect } from "bun:test";
import {
  createApprovalSchema,
  updateApprovalSchema,
  reviewApprovalSchema,
  createChangeRequestSchema,
  respondChangeRequestSchema,
  getApprovalsQuerySchema,
} from "../../src/module/projects/validators/approval.validator";
import {
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_CUSTOMER_ID,
} from "../leads-crm/fixtures/crm.fixtures";

describe("Work Approvals & Change Requests Module Tests", () => {
  const MOCK_APPROVAL_ID = "22222222-3333-4444-8555-666666666666";
  const MOCK_CHANGE_REQUEST_ID = "33333333-4444-4555-8666-777777777777";
  const MOCK_MILESTONE_ID = "44444444-5555-4666-8777-888888888888";

  // =========================================================================
  // 1. Create Work Approval Validation
  // =========================================================================
  describe("Create Work Approval Validation", () => {
    it("should validate full work approval payload with drawing attachments and milestone link", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          title: "Master Bedroom 3D Visuals & Material Palette",
          description: "Veneer finish for wardrobe, Italian marble texture for headboard, and ambient lighting layout.",
          type: "DESIGN" as const,
          status: "PENDING" as const,
          priority: "HIGH" as const,
          milestoneId: MOCK_MILESTONE_ID,
          submittedById: MOCK_EMPLOYEE_ID_1,
          dueDate: "2026-11-05",
          isClientPortalVisible: true,
          attachments: [
            {
              id: "render-3d-01",
              url: "https://storage.homio.in/projects/mbr-render-v1.webp",
              bytes: 2048576,
              format: "webp",
              provider: "AWS_S3" as const,
            },
          ],
        },
      };

      const parsed = createApprovalSchema.parse(payload);
      expect(parsed.params.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.body.title).toBe("Master Bedroom 3D Visuals & Material Palette");
      expect(parsed.body.type).toBe("DESIGN");
      expect(parsed.body.status).toBe("PENDING");
      expect(parsed.body.attachments?.length).toBe(1);
    });

    it("should allow minimal approval creation with only title and projectId", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          title: "Modular Kitchen Layout Signoff",
        },
      };

      const parsed = createApprovalSchema.parse(payload);
      expect(parsed.body.title).toBe("Modular Kitchen Layout Signoff");
      expect(parsed.body.type).toBe("DESIGN");
      expect(parsed.body.status).toBe("PENDING");
      expect(parsed.body.priority).toBe("MEDIUM");
    });

    it("should fail validation when title is missing", () => {
      expect(() => {
        createApprovalSchema.parse({
          params: { projectId: MOCK_PROJECT_ID },
          body: {},
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Work Approval Validation
  // =========================================================================
  describe("Update Work Approval Validation", () => {
    it("should validate partial update on work approval", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: MOCK_APPROVAL_ID,
        },
        body: {
          priority: "URGENT" as const,
          dueDate: "2026-11-10",
        },
      };

      const parsed = updateApprovalSchema.parse(payload);
      expect(parsed.body.priority).toBe("URGENT");
      expect(parsed.body.dueDate).toBe("2026-11-10");
    });
  });

  // =========================================================================
  // 3. Client Review Action Validation
  // =========================================================================
  describe("Review Approval Validation", () => {
    it("should validate approval decision APPROVE with client feedback", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: MOCK_APPROVAL_ID,
        },
        body: {
          action: "APPROVE" as const,
          clientFeedback: "Approved with great satisfaction, love the color palette.",
        },
      };

      const parsed = reviewApprovalSchema.parse(payload);
      expect(parsed.body.action).toBe("APPROVE");
      expect(parsed.body.clientFeedback).toContain("great satisfaction");
    });

    it("should validate approval decision REJECT with rejection reason", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: MOCK_APPROVAL_ID,
        },
        body: {
          action: "REJECT" as const,
          rejectionReason: "Scope completely out of agreed design direction.",
        },
      };

      const parsed = reviewApprovalSchema.parse(payload);
      expect(parsed.body.action).toBe("REJECT");
      expect(parsed.body.rejectionReason).toBe("Scope completely out of agreed design direction.");
    });
  });

  // =========================================================================
  // 4. Client Change Requests Validation
  // =========================================================================
  describe("Change Requests Validation", () => {
    it("should validate client submitting a change request with requested modifications", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          approvalId: MOCK_APPROVAL_ID,
        },
        body: {
          title: "Change laminate to dark walnut",
          requestedChanges: "Replace the oak laminate on the wardrobe shutters with textured dark walnut and add profile handles.",
          reason: "Matches better with the existing master flooring.",
          requestedByCustomerId: MOCK_CUSTOMER_ID,
          attachments: [
            {
              id: "ref-photo-01",
              url: "https://storage.homio.in/clients/walnut-sample-ref.jpg",
              bytes: 524288,
              format: "jpg",
              provider: "AWS_S3" as const,
            },
          ],
        },
      };

      const parsed = createChangeRequestSchema.parse(payload);
      expect(parsed.params.approvalId).toBe(MOCK_APPROVAL_ID);
      expect(parsed.body.requestedChanges).toContain("textured dark walnut");
      expect(parsed.body.requestedByCustomerId).toBe(MOCK_CUSTOMER_ID);
    });

    it("should validate organization responding to a change request (IMPLEMENTED)", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          approvalId: MOCK_APPROVAL_ID,
          id: MOCK_CHANGE_REQUEST_ID,
        },
        body: {
          status: "IMPLEMENTED" as const,
          responseNotes: "Dark walnut sample incorporated and renders updated in Rev 2.",
          respondedById: MOCK_EMPLOYEE_ID_1,
          revisedAttachments: [
            {
              id: "render-3d-02",
              url: "https://storage.homio.in/projects/mbr-render-v2.webp",
              bytes: 2100000,
              format: "webp",
              provider: "AWS_S3" as const,
            },
          ],
        },
      };

      const parsed = respondChangeRequestSchema.parse(payload);
      expect(parsed.body.status).toBe("IMPLEMENTED");
      expect(parsed.body.respondedById).toBe(MOCK_EMPLOYEE_ID_1);
      expect(parsed.body.revisedAttachments?.length).toBe(1);
    });
  });

  // =========================================================================
  // 5. Query Filters Validation
  // =========================================================================
  describe("Get Approvals Query Validation", () => {
    it("should parse approval query filters correctly", () => {
      const query = {
        status: "REVISION_REQUESTED",
        type: "DESIGN",
        priority: "HIGH",
        page: "2",
        limit: "10",
        sortBy: "dueDate",
        sortOrder: "asc",
      };

      const parsed = getApprovalsQuerySchema.parse({ query });
      expect(parsed.query.status).toBe("REVISION_REQUESTED");
      expect(parsed.query.type).toBe("DESIGN");
      expect(parsed.query.page).toBe(2);
      expect(parsed.query.limit).toBe(10);
      expect(parsed.query.sortBy).toBe("dueDate");
      expect(parsed.query.sortOrder).toBe("asc");
    });
  });
});
