import { describe, it, expect } from "bun:test";
import {
  createProgressSchema,
  updateProgressSchema,
  reviewProgressSchema,
  getProgressQuerySchema,
} from "../../src/module/projects/validators/progress.validator.js";
import {
  getPresignedProgressMediaUrlSchema,
  confirmProgressMediaUploadSchema,
  createDirectProgressMediaSchema,
  updateProgressMediaSchema,
  getProgressMediaQuerySchema,
} from "../../src/module/projects/validators/progress-media.validator.js";
import {
  ProgressMediaType,
  ProgressMediaUploadStatus,
} from "../../src/types/types.js";

const MOCK_PROJECT_ID = "12345678-1234-4234-8234-123456789012";
const MOCK_PROGRESS_ID = "87654321-4321-4321-8321-210987654321";

describe("Site Progress & Media Attachments Subsystem - Validation Tests", () => {
  // =========================================================================
  // 1. Create Progress Validation
  // =========================================================================
  describe("Create Site Progress Validation", () => {
    it("should successfully validate comprehensive site progress entry", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          milestoneId: "11111111-2222-4333-8444-555555555555",
          areaRoom: "Master Bedroom",
          workStage: "Wardrobe Framing & Paneling",
          progressDate: "2026-10-15",
          progressPercent: 65.0,
          description: "Completed framing for walk-in wardrobe and pre-routed electrical conduits.",
          workCompleted: "Framework assembled, marine ply fixed, primer applied.",
          workPending: "Laminate pasting and edge banding pending.",
          issues: "Minor moisture seepage detected near north window sill.",
          nextAction: "Apply silicone sealant and waterproof membrane prior to shutter installation.",
          visibility: "CLIENT_VISIBLE" as const,
          approvalStatus: "SUBMITTED" as const,
        },
      };

      const parsed = createProgressSchema.parse(payload);
      expect(parsed.params.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.body.areaRoom).toBe("Master Bedroom");
      expect(parsed.body.workStage).toBe("Wardrobe Framing & Paneling");
      expect(parsed.body.progressPercent).toBe(65.0);
      expect(parsed.body.visibility).toBe("CLIENT_VISIBLE");
      expect(parsed.body.approvalStatus).toBe("SUBMITTED");
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
          id: MOCK_PROGRESS_ID,
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
          id: MOCK_PROGRESS_ID,
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
  // 3. Progress Media - Presigned URL & Confirmation Validation
  // =========================================================================
  describe("Progress Media Presigned URL & S3 Upload Validation", () => {
    it("should validate presigned URL request for site video", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          progressId: MOCK_PROGRESS_ID,
        },
        body: {
          fileName: "living-room-walkthrough-4k.mp4",
          mimeType: "video/mp4",
          fileSizeBytes: 104857600, // 100MB
          mediaType: ProgressMediaType.VIDEO,
          title: "Living Room False Ceiling Walkthrough",
          description: "4K Inspection walkthrough of gypsum board leveling and recessed lighting channels.",
          takenAt: "2026-10-15T10:30:00Z",
          geoLatitude: 12.9716,
          geoLongitude: 77.5946,
          tags: ["video", "living-room", "ceiling", "walkthrough"],
        },
      };

      const parsed = getPresignedProgressMediaUrlSchema.parse(payload);
      expect(parsed.params.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.params.progressId).toBe(MOCK_PROGRESS_ID);
      expect(parsed.body.fileName).toBe("living-room-walkthrough-4k.mp4");
      expect(parsed.body.mimeType).toBe("video/mp4");
      expect(parsed.body.mediaType).toBe(ProgressMediaType.VIDEO);
      expect(parsed.body.tags).toContain("ceiling");
    });

    it("should validate confirming direct S3 upload with video duration", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          progressId: MOCK_PROGRESS_ID,
          mediaId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        },
        body: {
          durationSeconds: 142.5,
          width: 3840,
          height: 2160,
          uploadStatus: ProgressMediaUploadStatus.COMPLETED,
        },
      };

      const parsed = confirmProgressMediaUploadSchema.parse(payload);
      expect(parsed.body.durationSeconds).toBe(142.5);
      expect(parsed.body.width).toBe(3840);
      expect(parsed.body.height).toBe(2160);
      expect(parsed.body.uploadStatus).toBe("COMPLETED");
    });
  });

  // =========================================================================
  // 4. Progress Media Direct Upload & Update Validation
  // =========================================================================
  describe("Progress Media Direct & Update Validation", () => {
    it("should validate direct media upload body", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          progressId: MOCK_PROGRESS_ID,
        },
        body: {
          mediaType: ProgressMediaType.IMAGE,
          title: "Wardrobe Framing Joint Photo",
          description: "Close-up of moisture resistant ply joint.",
          tags: ["wardrobe", "plywood"],
          isCover: true,
          orderIndex: 1,
        },
      };

      const parsed = createDirectProgressMediaSchema.parse(payload);
      expect(parsed.body.title).toBe("Wardrobe Framing Joint Photo");
      expect(parsed.body.isCover).toBe(true);
      expect(parsed.body.orderIndex).toBe(1);
    });

    it("should validate partial update on media asset", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        },
        body: {
          title: "Updated Living Room Ceiling Title",
          isCover: true,
          tags: ["verified", "cleared"],
        },
      };

      const parsed = updateProgressMediaSchema.parse(payload);
      expect(parsed.body.title).toBe("Updated Living Room Ceiling Title");
      expect(parsed.body.isCover).toBe(true);
      expect(parsed.body.tags).toContain("cleared");
    });

    it("should parse progress media query filters", () => {
      const query = {
        page: "1",
        limit: "25",
        mediaType: ProgressMediaType.VIDEO,
        uploadStatus: ProgressMediaUploadStatus.COMPLETED,
        isCover: "true",
        search: "ceiling",
      };

      const parsed = getProgressMediaQuerySchema.parse({ query });
      expect(parsed.query.page).toBe(1);
      expect(parsed.query.limit).toBe(25);
      expect(parsed.query.mediaType).toBe("VIDEO");
      expect(parsed.query.uploadStatus).toBe("COMPLETED");
      expect(parsed.query.isCover).toBe(true);
      expect(parsed.query.search).toBe("ceiling");
    });
  });
});
