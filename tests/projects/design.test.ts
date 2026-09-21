import { describe, it, expect } from "bun:test";
import {
  createDesignFolderSchema,
  updateDesignFolderSchema,
  getDesignFoldersQuerySchema,
  createProjectDesignSchema,
  updateProjectDesignSchema,
  getProjectDesignsQuerySchema,
  createDesignVersionSchema,
  updateDesignVersionSchema,
  submitDesignVersionSchema,
  createDesignAttachmentSchema,
  updateDesignAttachmentSchema,
  createDesignApprovalSchema,
  createDesignChangeRequestSchema,
  respondDesignChangeRequestSchema,
  getDesignChangeRequestsQuerySchema,
} from "../../src/module/projects/validators/design.validator";
import {
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_CUSTOMER_ID,
} from "../leads-crm/fixtures/crm.fixtures";

describe("Design Module Validation & Business Rules Tests", () => {
  const MOCK_FOLDER_ID = "11111111-2222-3333-8444-555555555555";
  const MOCK_DESIGN_ID = "22222222-3333-4444-8555-666666666666";
  const MOCK_VERSION_ID = "33333333-4444-4555-8666-777777777777";
  const MOCK_ATTACHMENT_ID = "44444444-5555-4666-8777-888888888888";
  const MOCK_CHANGE_REQUEST_ID = "55555555-6666-4777-8888-999999999999";
  const MOCK_MILESTONE_ID = "66666666-7777-4888-8999-000000000000";

  // =========================================================================
  // 1. DESIGN FOLDERS VALIDATION
  // =========================================================================
  describe("Design Folders Validation", () => {
    it("should validate full folder creation with room, stage, budget, and color", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          parentId: MOCK_FOLDER_ID,
          folderCode: "FLD-LIV-01",
          name: "Living Room 3D Concepts & Working Drawings",
          description: "Contains 4K Lumion renders and GFC electrical layouts.",
          roomType: "LIVING_ROOM",
          stage: "RENDER_3D" as const,
          color: "#6366F1",
          icon: "LayoutGrid",
          estimatedBudget: 350000,
          isClientPortalVisible: true,
          tags: ["Living", "Luxury", "False Ceiling"],
          coverImageUrl: {
            id: "folder-cover-01",
            url: "https://storage.homio.in/designs/living-room-cover.webp",
            bytes: 512000,
            format: "webp",
            provider: "AWS_S3" as const,
          },
          metadata: { carpetAreaSqft: 450, ceilingHeightFt: 10.5 },
        },
      };

      const parsed = createDesignFolderSchema.parse(payload);
      expect(parsed.params.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.body.name).toBe("Living Room 3D Concepts & Working Drawings");
      expect(parsed.body.stage).toBe("RENDER_3D");
      expect(parsed.body.color).toBe("#6366F1");
      expect(parsed.body.estimatedBudget).toBe(350000);
      expect(parsed.body.coverImageUrl?.url).toContain("living-room-cover.webp");
    });

    it("should allow minimal folder creation with default stage and orderIndex", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: { name: "Master Bedroom" },
      };

      const parsed = createDesignFolderSchema.parse(payload);
      expect(parsed.body.name).toBe("Master Bedroom");
      expect(parsed.body.stage).toBe("RENDER_3D");
      expect(parsed.body.isClientPortalVisible).toBe(true);
      expect(parsed.body.orderIndex).toBe(0);
    });

    it("should fail folder validation when color is not a valid 6-character hex", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          name: "Dining Area",
          color: "blue-500", // Invalid hex
        },
      };

      expect(() => createDesignFolderSchema.parse(payload)).toThrow();
    });

    it("should validate partial folder update schema", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, id: MOCK_FOLDER_ID },
        body: {
          name: "Updated Living Room Renders",
          color: "#10B981",
          estimatedBudget: 420000,
        },
      };

      const parsed = updateDesignFolderSchema.parse(payload);
      expect(parsed.body.name).toBe("Updated Living Room Renders");
      expect(parsed.body.color).toBe("#10B981");
      expect(parsed.body.estimatedBudget).toBe(420000);
    });

    it("should parse folder query parameters with recursive tree flag", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        query: {
          roomType: "LIVING_ROOM",
          stage: "RENDER_3D" as const,
          tree: "true",
        },
      };

      const parsed = getDesignFoldersQuerySchema.parse(payload);
      expect(parsed.query.roomType).toBe("LIVING_ROOM");
      expect(parsed.query.stage).toBe("RENDER_3D");
      expect(parsed.query.tree).toBe("true");
    });
  });

  // =========================================================================
  // 2. MASTER DESIGNS VALIDATION
  // =========================================================================
  describe("Master Designs Validation", () => {
    it("should validate full master design creation with specifications and initial version", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          folderId: MOCK_FOLDER_ID,
          milestoneId: MOCK_MILESTONE_ID,
          designCode: "DSG-001",
          title: "False Ceiling & Cove Lighting Layout",
          designType: "RENDER_3D" as const,
          designStyle: "JAPANDI",
          description: "Minimalist oak wooden rafters with recessed magnetic track lights and warm 3000K LED coves.",
          roomArea: "Living Room",
          specifications: {
            ceilingDropInches: 5,
            coveWidthInches: 4,
            lightingLuxLevel: 300,
            plywoodSpecification: "BWP Marine Grade 12mm",
          },
          softwareUsed: ["3ds Max", "V-Ray 6", "AutoCAD", "Photoshop"],
          priority: "HIGH" as const,
          estimatedCost: 185000,
          createdById: MOCK_EMPLOYEE_ID_1,
          tags: ["Ceiling", "Lighting", "Oak"],
          coverImageUrl: {
            id: "cover-img-01",
            url: "https://storage.homio.in/designs/ceiling-cover.webp",
            bytes: 1048576,
            format: "webp",
            provider: "AWS_S3" as const,
          },
          initialVersion: {
            versionName: "v1.0 - Initial Concept",
            changelog: "Base concept rendered with 4K resolution.",
            renderingEngine: "V-Ray 6.2",
            resolution: "3840x2160 (4K UHD)",
            attachments: [
              {
                attachmentType: "RENDER_IMAGE" as const,
                title: "Perspective Angle 1",
                file: {
                  id: "render-01",
                  url: "https://storage.homio.in/designs/ceiling-p1.webp",
                  bytes: 3145728,
                  format: "webp",
                  provider: "AWS_S3" as const,
                },
                width: 3840,
                height: 2160,
                isPrimary: true,
              },
            ],
          },
        },
      };

      const parsed = createProjectDesignSchema.parse(payload);
      expect(parsed.body.title).toBe("False Ceiling & Cove Lighting Layout");
      expect(parsed.body.designType).toBe("RENDER_3D");
      expect(parsed.body.designStyle).toBe("JAPANDI");
      expect(parsed.body.softwareUsed).toContain("3ds Max");
      expect(parsed.body.initialVersion?.attachments?.length).toBe(1);
    });

    it("should allow minimal design creation with only title", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: { title: "Modular Kitchen Layout" },
      };

      const parsed = createProjectDesignSchema.parse(payload);
      expect(parsed.body.title).toBe("Modular Kitchen Layout");
      expect(parsed.body.designType).toBe("RENDER_3D");
      expect(parsed.body.priority).toBe("MEDIUM");
      expect(parsed.body.isClientPortalVisible).toBe(true);
    });

    it("should validate partial design update schema", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, id: MOCK_DESIGN_ID },
        body: {
          title: "Revised False Ceiling Layout",
          status: "IN_REVIEW" as const,
          estimatedCost: 195000,
        },
      };

      const parsed = updateProjectDesignSchema.parse(payload);
      expect(parsed.body.title).toBe("Revised False Ceiling Layout");
      expect(parsed.body.status).toBe("IN_REVIEW");
      expect(parsed.body.estimatedCost).toBe(195000);
    });

    it("should parse design query filters with pagination", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        query: {
          folderId: MOCK_FOLDER_ID,
          designType: "RENDER_3D" as const,
          status: "APPROVED" as const,
          page: "2",
          limit: "15",
          sortBy: "title" as const,
          sortOrder: "asc" as const,
        },
      };

      const parsed = getProjectDesignsQuerySchema.parse(payload);
      expect(parsed.query.folderId).toBe(MOCK_FOLDER_ID);
      expect(parsed.query.status).toBe("APPROVED");
      expect(parsed.query.page).toBe("2");
      expect(parsed.query.limit).toBe("15");
    });
  });

  // =========================================================================
  // 3. DESIGN VERSIONS VALIDATION
  // =========================================================================
  describe("Design Versions Validation", () => {
    it("should validate revision version creation (v2.0) with changelog and attachments", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID },
        body: {
          versionName: "v2.0 - Smoked Oak & Ambient Strip LED",
          changelog: "Incorporated client change request to darken veneer and add warm 2700K strip lights.",
          renderingEngine: "Corona 9",
          resolution: "7680x4320 (8K Panorama)",
          submittedById: MOCK_EMPLOYEE_ID_1,
          autoSubmit: true,
          attachments: [
            {
              attachmentType: "RENDER_IMAGE" as const,
              title: "8K 360 Panorama",
              externalUrl: "https://kuula.co/share/collection/homio-mbr-360",
              isPrimary: true,
            },
          ],
        },
      };

      const parsed = createDesignVersionSchema.parse(payload);
      expect(parsed.body.versionName).toBe("v2.0 - Smoked Oak & Ambient Strip LED");
      expect(parsed.body.renderingEngine).toBe("Corona 9");
      expect(parsed.body.autoSubmit).toBe(true);
      expect(parsed.body.attachments?.[0]?.attachmentType).toBe("RENDER_IMAGE");
    });

    it("should validate submitting draft design version for client review", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          submittedById: MOCK_EMPLOYEE_ID_1,
          submissionNotes: "Please review the updated finish samples and 3D preview tour.",
        },
      };

      const parsed = submitDesignVersionSchema.parse(payload);
      expect(parsed.body.submittedById).toBe(MOCK_EMPLOYEE_ID_1);
      expect(parsed.body.submissionNotes).toContain("finish samples");
    });

    it("should validate partial version update schema", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          versionName: "v1.1 - Minor Refinements",
          changelog: "Adjusted lighting reflection intensities.",
        },
      };

      const parsed = updateDesignVersionSchema.parse(payload);
      expect(parsed.body.versionName).toBe("v1.1 - Minor Refinements");
    });
  });

  // =========================================================================
  // 4. DEDICATED ATTACHMENTS VALIDATION (PDF, YouTube, 3D Preview URLs)
  // =========================================================================
  describe("Dedicated Attachments Validation", () => {
    it("should validate image render attachment with width and height", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          attachmentType: "RENDER_IMAGE" as const,
          title: "Night Mode Mood Lighting 4K Render",
          file: {
            id: "att-night-render",
            url: "https://storage.homio.in/designs/mbr-night-4k.webp",
            bytes: 4194304,
            format: "webp",
            provider: "AWS_S3" as const,
          },
          width: 3840,
          height: 2160,
          isPrimary: true,
          orderIndex: 0,
        },
      };

      const parsed = createDesignAttachmentSchema.parse(payload);
      expect(parsed.body.attachmentType).toBe("RENDER_IMAGE");
      expect(parsed.body.width).toBe(3840);
      expect(parsed.body.height).toBe(2160);
      expect(parsed.body.isPrimary).toBe(true);
    });

    it("should validate technical drawing PDF sheet attachment", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          attachmentType: "TECHNICAL_DRAWING_PDF" as const,
          title: "GFC Electrical & Conduit Working Drawing",
          caption: "Drawing No. ARCH-DWG-E04 (Rev 2)",
          description: "All dimensions in mm. Conduit routing as approved by MEP consultant.",
          file: {
            id: "att-pdf-dwg",
            url: "https://storage.homio.in/designs/ARCH-DWG-E04-Rev2.pdf",
            bytes: 8388608,
            format: "pdf",
            provider: "AWS_S3" as const,
          },
          mimeType: "application/pdf",
          isPrimary: false,
          orderIndex: 1,
        },
      };

      const parsed = createDesignAttachmentSchema.parse(payload);
      expect(parsed.body.attachmentType).toBe("TECHNICAL_DRAWING_PDF");
      expect(parsed.body.mimeType).toBe("application/pdf");
      expect(parsed.body.file?.url).toContain("ARCH-DWG-E04-Rev2.pdf");
    });

    it("should validate interactive 3D preview URL (Matterport / Sketchfab)", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          attachmentType: "THREED_PREVIEW_URL" as const,
          title: "Matterport Interactive 3D Walkthrough Tour",
          externalUrl: "https://my.matterport.com/show/?m=AbCdEfGh123",
          embedCode: '<iframe width="100%" height="480" src="https://my.matterport.com/show/?m=AbCdEfGh123" frameborder="0" allowfullscreen allow="xr-spatial-tracking"></iframe>',
          thumbnail: {
            id: "matterport-thumb",
            url: "https://storage.homio.in/designs/matterport-thumb.webp",
            bytes: 256000,
            format: "webp",
            provider: "AWS_S3" as const,
          },
          isPrimary: false,
          orderIndex: 2,
        },
      };

      const parsed = createDesignAttachmentSchema.parse(payload);
      expect(parsed.body.attachmentType).toBe("THREED_PREVIEW_URL");
      expect(parsed.body.externalUrl).toBe("https://my.matterport.com/show/?m=AbCdEfGh123");
      expect(parsed.body.embedCode).toContain("<iframe");
    });

    it("should validate YouTube flythrough video walkthrough attachment", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          attachmentType: "YOUTUBE_VIDEO" as const,
          title: "Full Villa 4K Architectural Walkthrough Flythrough",
          externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          embedCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe>',
          durationSeconds: 185,
          orderIndex: 3,
        },
      };

      const parsed = createDesignAttachmentSchema.parse(payload);
      expect(parsed.body.attachmentType).toBe("YOUTUBE_VIDEO");
      expect(parsed.body.durationSeconds).toBe(185);
      expect(parsed.body.externalUrl).toContain("youtube.com");
    });

    it("should validate 3D Model file attachment (.glb / .gltf)", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          attachmentType: "THREED_MODEL_FILE" as const,
          title: "Optimized WebGL 3D Model (.glb)",
          file: {
            id: "model-glb-01",
            url: "https://storage.homio.in/designs/custom-credenza.glb",
            bytes: 12582912,
            format: "glb",
            provider: "AWS_S3" as const,
          },
          mimeType: "model/gltf-binary",
          metadata: { polygonCount: 45200, textureResolution: "2048x2048" },
          orderIndex: 4,
        },
      };

      const parsed = createDesignAttachmentSchema.parse(payload);
      expect(parsed.body.attachmentType).toBe("THREED_MODEL_FILE");
      expect(parsed.body.mimeType).toBe("model/gltf-binary");
    });

    it("should validate partial attachment update schema", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          designId: MOCK_DESIGN_ID,
          versionId: MOCK_VERSION_ID,
          attachmentId: MOCK_ATTACHMENT_ID,
        },
        body: {
          title: "Updated 4K Render Title",
          isPrimary: true,
          orderIndex: 0,
        },
      };

      const parsed = updateDesignAttachmentSchema.parse(payload);
      expect(parsed.body.title).toBe("Updated 4K Render Title");
      expect(parsed.body.isPrimary).toBe(true);
    });
  });

  // =========================================================================
  // 5. CLIENT APPROVALS VALIDATION (Digital Signoff & Checklist)
  // =========================================================================
  describe("Client Approvals Validation", () => {
    it("should validate client formal signoff with digital signature and scope checklist", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          decision: "APPROVED" as const,
          customerId: MOCK_CUSTOMER_ID,
          reviewComments: "Outstanding design! We love the walnut finish and warm lighting. Approved for execution.",
          clientRating: 5,
          scopeChecklist: {
            approvedLayout: true,
            approvedFinishesAndMaterials: true,
            approvedElectricalPoints: true,
            approvedBudgetVariance: true,
          },
          digitalSignature: {
            signerName: "John Doe (Homeowner)",
            signerEmail: "john.doe@example.com",
            signerPhone: "+919876543210",
            signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
          },
          signedDocumentUrl: {
            id: "signoff-cert-01",
            url: "https://storage.homio.in/certificates/signoff-PRJ-001-v2.pdf",
            bytes: 512000,
            format: "pdf",
            provider: "AWS_S3" as const,
          },
        },
      };

      const parsed = createDesignApprovalSchema.parse(payload);
      expect(parsed.body.decision).toBe("APPROVED");
      expect(parsed.body.clientRating).toBe(5);
      expect(parsed.body.digitalSignature?.signerName).toBe("John Doe (Homeowner)");
      expect(parsed.body.scopeChecklist?.approvedLayout).toBe(true);
    });

    it("should validate client conditional approval with required conditions array", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          decision: "APPROVED_WITH_CONDITIONS" as const,
          reviewComments: "Approved conditionally subject to slight shade adjustment on dining accent wall.",
          conditions: [
            "Use Asian Paints Royale shade 0524 instead of 0520.",
            "Verify power socket alignment with refrigerator door swing.",
          ],
        },
      };

      const parsed = createDesignApprovalSchema.parse(payload);
      expect(parsed.body.decision).toBe("APPROVED_WITH_CONDITIONS");
      expect(parsed.body.conditions?.length).toBe(2);
    });

    it("should validate client rejection with rejection reason", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          decision: "REJECTED" as const,
          rejectionReason: "The layout does not meet our storage requirements and exceeds budget limits.",
        },
      };

      const parsed = createDesignApprovalSchema.parse(payload);
      expect(parsed.body.decision).toBe("REJECTED");
      expect(parsed.body.rejectionReason).toContain("storage requirements");
    });
  });

  // =========================================================================
  // 6. CHANGE REQUESTS VALIDATION (Pin Annotations & Feedback Loop)
  // =========================================================================
  describe("Change Requests Validation", () => {
    it("should validate client change request with coordinate pin annotations and reference photos", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        body: {
          title: "Adjust Wall Sconces & Replace Fabric on Headboard",
          description: "Sconces are placed too high for bedside reading. Please lower by 150mm. Also change headboard fabric to bouclé beige.",
          category: "LIGHTING_AND_ELECTRICAL" as const,
          urgency: "HIGH" as const,
          pinAnnotations: [
            {
              id: "pin-01",
              attachmentId: MOCK_ATTACHMENT_ID,
              x: 42.5,
              y: 65.2,
              comment: "Lower wall sconce by 150mm to align with 900mm height.",
              color: "#EF4444",
            },
            {
              id: "pin-02",
              attachmentId: MOCK_ATTACHMENT_ID,
              x: 58.0,
              y: 72.1,
              comment: "Change headboard upholstery to textured bouclé beige.",
              color: "#3B82F6",
            },
          ],
          referenceAttachments: [
            {
              id: "ref-photo-01",
              url: "https://storage.homio.in/inspiration/boucle-headboard.webp",
              bytes: 1048576,
              format: "webp",
              provider: "AWS_S3" as const,
            },
          ],
        },
      };

      const parsed = createDesignChangeRequestSchema.parse(payload);
      expect(parsed.body.title).toBe("Adjust Wall Sconces & Replace Fabric on Headboard");
      expect(parsed.body.category).toBe("LIGHTING_AND_ELECTRICAL");
      expect(parsed.body.urgency).toBe("HIGH");
      expect(parsed.body.pinAnnotations?.length).toBe(2);
      expect(parsed.body.pinAnnotations?.[0]?.x).toBe(42.5);
      expect(parsed.body.pinAnnotations?.[0]?.y).toBe(65.2);
      expect(parsed.body.referenceAttachments?.length).toBe(1);
    });

    it("should validate designer response with impact estimates and resolving version link", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          designId: MOCK_DESIGN_ID,
          versionId: MOCK_VERSION_ID,
          changeRequestId: MOCK_CHANGE_REQUEST_ID,
        },
        body: {
          status: "ACCEPTED" as const,
          responseNotes: "Changes accepted. Sconces repositioned to 950mm AFF and beige bouclé swatch applied. Rendered in version 2.",
          respondedById: MOCK_EMPLOYEE_ID_1,
          estimatedImpactDays: 2,
          estimatedCostImpact: 8500,
          resolvedInVersionNumber: 2,
        },
      };

      const parsed = respondDesignChangeRequestSchema.parse(payload);
      expect(parsed.body.status).toBe("ACCEPTED");
      expect(parsed.body.estimatedImpactDays).toBe(2);
      expect(parsed.body.estimatedCostImpact).toBe(8500);
      expect(parsed.body.resolvedInVersionNumber).toBe(2);
    });

    it("should parse change requests query filters", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID, designId: MOCK_DESIGN_ID, versionId: MOCK_VERSION_ID },
        query: {
          status: "PENDING" as const,
          category: "LIGHTING_AND_ELECTRICAL" as const,
        },
      };

      const parsed = getDesignChangeRequestsQuerySchema.parse(payload);
      expect(parsed.query.status).toBe("PENDING");
      expect(parsed.query.category).toBe("LIGHTING_AND_ELECTRICAL");
    });
  });
});
