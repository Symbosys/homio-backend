import { describe, it, expect } from "bun:test";
import {
  createComplaintSchema,
  updateComplaintSchema,
  updateComplaintStatusSchema,
  addComplaintCommentSchema,
  getComplaintsQuerySchema,
} from "../../src/module/projects/validators/complaint.validator";
import {
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_EMPLOYEE_ID_2,
  MOCK_CUSTOMER_ID,
} from "../leads-crm/fixtures/crm.fixtures";

describe("Project Complaints & Issue Tracking Module Tests", () => {
  const MOCK_COMPLAINT_ID = "55555555-6666-4777-8888-999999999999";
  const MOCK_MILESTONE_ID = "44444444-5555-4666-8777-888888888888";

  // =========================================================================
  // 1. Create Complaint Validation
  // =========================================================================
  describe("Create Complaint Validation", () => {
    it("should validate full complaint filing with site photos and location room", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          title: "Misaligned tile grout and chipped edge in master bathroom",
          description: "Three floor tiles near the shower glass enclosure have uneven 5mm grouting and one chipped corner.",
          type: "QUALITY" as const,
          status: "OPEN" as const,
          severity: "HIGH" as const,
          priority: "HIGH" as const,
          areaRoom: "Master Bathroom",
          milestoneId: MOCK_MILESTONE_ID,
          reportedByCustomerId: MOCK_CUSTOMER_ID,
          assignedToId: MOCK_EMPLOYEE_ID_1,
          targetResolutionDate: "2026-10-30",
          attachments: [
            {
              id: "defect-photo-01",
              url: "https://storage.homio.in/projects/tile-chipped-defect.jpg",
              bytes: 1048576,
              format: "jpg",
              provider: "AWS_S3" as const,
            },
          ],
        },
      };

      const parsed = createComplaintSchema.parse(payload);
      expect(parsed.params.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.body.title).toContain("Misaligned tile grout");
      expect(parsed.body.type).toBe("QUALITY");
      expect(parsed.body.severity).toBe("HIGH");
      expect(parsed.body.areaRoom).toBe("Master Bathroom");
      expect(parsed.body.attachments?.length).toBe(1);
    });

    it("should allow minimal complaint creation with title and description", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          title: "Air conditioning drainage leak in dining area",
          description: "Water dripping from AC copper pipe joint onto the drywall ceiling.",
        },
      };

      const parsed = createComplaintSchema.parse(payload);
      expect(parsed.body.title).toContain("Air conditioning drainage leak");
      expect(parsed.body.status).toBe("OPEN");
      expect(parsed.body.severity).toBe("MEDIUM");
      expect(parsed.body.priority).toBe("MEDIUM");
    });

    it("should fail validation when title or description is missing", () => {
      expect(() => {
        createComplaintSchema.parse({
          params: { projectId: MOCK_PROJECT_ID },
          body: { title: "Incomplete complaint" },
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Complaint Details Validation
  // =========================================================================
  describe("Update Complaint Validation", () => {
    it("should validate partial update on complaint parameters", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: MOCK_COMPLAINT_ID,
        },
        body: {
          severity: "CRITICAL" as const,
          priority: "URGENT" as const,
          assignedToId: MOCK_EMPLOYEE_ID_2,
          targetResolutionDate: "2026-10-25",
        },
      };

      const parsed = updateComplaintSchema.parse(payload);
      expect(parsed.body.severity).toBe("CRITICAL");
      expect(parsed.body.priority).toBe("URGENT");
      expect(parsed.body.assignedToId).toBe(MOCK_EMPLOYEE_ID_2);
    });
  });

  // =========================================================================
  // 3. Update Complaint Status & Resolution Validation
  // =========================================================================
  describe("Update Complaint Status Validation", () => {
    it("should validate marking a complaint as RESOLVED with resolution notes", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: MOCK_COMPLAINT_ID,
        },
        body: {
          status: "RESOLVED" as const,
          resolvedById: MOCK_EMPLOYEE_ID_1,
          resolutionNotes: "Chipped tile replaced, epoxy regrouting applied, and leak tested.",
        },
      };

      const parsed = updateComplaintStatusSchema.parse(payload);
      expect(parsed.body.status).toBe("RESOLVED");
      expect(parsed.body.resolvedById).toBe(MOCK_EMPLOYEE_ID_1);
      expect(parsed.body.resolutionNotes).toContain("Chipped tile replaced");
    });

    it("should validate marking a complaint as REJECTED with rejection reason", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: MOCK_COMPLAINT_ID,
        },
        body: {
          status: "REJECTED" as const,
          rejectionReason: "Damage caused by external client appliance vendor post-handover.",
        },
      };

      const parsed = updateComplaintStatusSchema.parse(payload);
      expect(parsed.body.status).toBe("REJECTED");
      expect(parsed.body.rejectionReason).toContain("external client appliance vendor");
    });
  });

  // =========================================================================
  // 4. Complaint Comments Validation
  // =========================================================================
  describe("Complaint Comments Validation", () => {
    it("should validate posting comment to complaint timeline", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          complaintId: MOCK_COMPLAINT_ID,
        },
        body: {
          authorType: "EMPLOYEE" as const,
          employeeId: MOCK_EMPLOYEE_ID_1,
          message: "Site supervisor visited the location. Replacement Italian tile ordered from vendor.",
          attachments: [
            {
              id: "po-doc-01",
              url: "https://storage.homio.in/procurement/tile-po-09.pdf",
              bytes: 1048576,
              format: "pdf",
              provider: "AWS_S3" as const,
            },
          ],
        },
      };

      const parsed = addComplaintCommentSchema.parse(payload);
      expect(parsed.params.complaintId).toBe(MOCK_COMPLAINT_ID);
      expect(parsed.body.message).toContain("Replacement Italian tile ordered");
      expect(parsed.body.attachments?.length).toBe(1);
    });
  });

  // =========================================================================
  // 5. Query Filters Validation
  // =========================================================================
  describe("Get Complaints Query Validation", () => {
    it("should parse complaint query filters correctly", () => {
      const query = {
        status: "IN_PROGRESS",
        type: "QUALITY",
        severity: "HIGH",
        priority: "HIGH",
        page: "1",
        limit: "25",
        sortBy: "targetResolutionDate",
        sortOrder: "asc",
      };

      const parsed = getComplaintsQuerySchema.parse({ query });
      expect(parsed.query.status).toBe("IN_PROGRESS");
      expect(parsed.query.severity).toBe("HIGH");
      expect(parsed.query.page).toBe(1);
      expect(parsed.query.limit).toBe(25);
      expect(parsed.query.sortBy).toBe("targetResolutionDate");
      expect(parsed.query.sortOrder).toBe("asc");
    });
  });
});
