import { describe, it, expect } from "bun:test";
import {
  createProgressSchema,
  updateProgressSchema,
  reviewProgressSchema,
  getProgressQuerySchema,
} from "../../src/module/projects/validators/progress.validator";
import {
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
} from "../leads-crm/fixtures/crm.fixtures";

describe("Project Site Progress Module Tests", () => {
  // =========================================================================
  // 1. Progress Log Submission Validation
  // =========================================================================
  describe("Create Site Progress Log Validation", () => {
    it("should validate full site progress log submission with media attachments", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          areaRoom: "Master Bedroom",
          workStage: "Wardrobe Framing & Paneling",
          progressDate: "2026-10-15",
          progressPercent: 65.0,
          description: "Completed BWR plywood carcass assembly and internal laminate pressing.",
          workCompleted: "3 sliding wardrobe modules assembled and anchored to wall.",
          workPending: "Hettich soft-close sliding channels and mirror shutter installation.",
          issues: "Minor moisture seepage observed on external balcony adjacent wall.",
          nextAction: "Request civil waterproofing team inspection before closing panel.",
          visibility: "CLIENT_VISIBLE" as const,
          approvalStatus: "SUBMITTED" as const,
          submittedById: MOCK_EMPLOYEE_ID_1,
          media: [
            {
              id: "photo-301",
              url: "https://storage.homio.in/projects/progress-mbr-carcass.jpg",
              bytes: 3145728,
              format: "jpeg",
              provider: "AWS_S3" as const,
            },
            {
              id: "photo-302",
              url: "https://storage.homio.in/projects/progress-moisture-spot.jpg",
              bytes: 2097152,
              format: "jpeg",
              provider: "AWS_S3" as const,
            },
          ],
        },
      };

      const parsed = createProgressSchema.parse(payload);
      expect(parsed.params.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.body.areaRoom).toBe("Master Bedroom");
      expect(parsed.body.workStage).toBe("Wardrobe Framing & Paneling");
      expect(parsed.body.progressPercent).toBe(65.0);
      expect(parsed.body.visibility).toBe("CLIENT_VISIBLE");
      expect(parsed.body.approvalStatus).toBe("SUBMITTED");
      expect(parsed.body.media?.length).toBe(2);
      expect(parsed.body.media?.[0]?.format).toBe("jpeg");
    });

    it("should allow minimal progress log with required fields", () => {
      const minimalPayload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          progressDate: "2026-10-15",
          description: "General site cleaning and debris removal.",
        },
      };

      const parsed = createProgressSchema.parse(minimalPayload);
      expect(parsed.body.progressDate).toBe("2026-10-15");
      expect(parsed.body.progressPercent).toBe(0);
      expect(parsed.body.visibility).toBe("INTERNAL");
      expect(parsed.body.approvalStatus).toBe("SUBMITTED");
    });

    it("should fail validation if progressDate is invalid", () => {
      expect(() => {
        createProgressSchema.parse({
          params: { projectId: MOCK_PROJECT_ID },
          body: {
            progressDate: "invalid-date",
          },
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // 2. Progress Review & Approval Validation
  // =========================================================================
  describe("Review Site Progress Validation", () => {
    it("should validate approving a progress log", () => {
      const reviewPayload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: "12345678-1234-4234-8234-123456789012",
        },
        body: {
          approvalStatus: "APPROVED" as const,
        },
      };

      const parsed = reviewProgressSchema.parse(reviewPayload);
      expect(parsed.body.approvalStatus).toBe("APPROVED");
    });

    it("should validate rejecting a progress log with reason", () => {
      const rejectPayload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: "12345678-1234-4234-8234-123456789012",
        },
        body: {
          approvalStatus: "REJECTED" as const,
          rejectionReason: "Laminate edge banding alignment uneven by 4mm. Needs rework.",
        },
      };

      const parsed = reviewProgressSchema.parse(rejectPayload);
      expect(parsed.body.approvalStatus).toBe("REJECTED");
      expect(parsed.body.rejectionReason).toBe(
        "Laminate edge banding alignment uneven by 4mm. Needs rework."
      );
    });
  });

  // =========================================================================
  // 3. Progress Query Filter Validation
  // =========================================================================
  describe("Get Progress List Query Validation", () => {
    it("should parse progress query filters with date ranges and room", () => {
      const query = {
        page: "1",
        limit: "10",
        areaRoom: "Kitchen",
        approvalStatus: "APPROVED",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      };

      const parsed = getProgressQuerySchema.parse({ query });
      expect(parsed.query.page).toBe(1);
      expect(parsed.query.limit).toBe(10);
      expect(parsed.query.areaRoom).toBe("Kitchen");
      expect(parsed.query.approvalStatus).toBe("APPROVED");
      expect(parsed.query.startDate).toBe("2026-10-01");
      expect(parsed.query.endDate).toBe("2026-10-31");
    });
  });

  // =========================================================================
  // 4. Progress Partial Update Validation
  // =========================================================================
  describe("Update Site Progress Validation", () => {
    it("should validate partial update on site progress entry", () => {
      const updatePayload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: "12345678-1234-4234-8234-123456789012",
        },
        body: {
          progressPercent: 70.0,
          workCompleted: "Updated with newly arrived edge banding material.",
        },
      };

      const parsed = updateProgressSchema.parse(updatePayload);
      expect(parsed.body.progressPercent).toBe(70.0);
      expect(parsed.body.workCompleted).toBe("Updated with newly arrived edge banding material.");
    });
  });
});
