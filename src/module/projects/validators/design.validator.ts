import { z } from "zod";
import { ProjectPriorityEnum, imageTypeSchema } from "./project.validator.js";

// ==========================================
// DESIGN ENUMS VALIDATORS
// ==========================================

export const DesignTypeEnum = z.enum([
  "RENDER_3D",
  "DRAWING_2D",
  "MOODBOARD",
  "ELEVATION",
  "FLOOR_PLAN",
  "SECTION_DETAIL",
  "MEP_LAYOUT",
  "VR_PANORAMA",
  "THREED_WALKTHROUGH",
  "BOQ_SPEC",
  "OTHER",
]);

export const DesignStageEnum = z.enum([
  "CONCEPT_MOODBOARD",
  "SCHEMATIC_DESIGN",
  "DESIGN_DEVELOPMENT",
  "RENDER_3D",
  "WORKING_DRAWINGS_2D",
  "MEP_DRAWINGS",
  "GOOD_FOR_CONSTRUCTION_GFC",
  "AS_BUILT",
]);

export const DesignStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
]);

export const DesignVersionStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "SUPERSEDED",
]);

export const DesignAttachmentTypeEnum = z.enum([
  "RENDER_IMAGE",
  "TECHNICAL_DRAWING_PDF",
  "SPECIFICATION_SHEET",
  "CAD_DWG_FILE",
  "THREED_MODEL_FILE",
  "THREED_PREVIEW_URL",
  "YOUTUBE_VIDEO",
  "VIMEO_VIDEO",
  "VIDEO_FILE",
  "AUDIO_WALKTHROUGH",
  "EXTERNAL_DRIVE_LINK",
  "OTHER",
]);

export const DesignApprovalDecisionEnum = z.enum([
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
  "CHANGES_REQUESTED",
  "REJECTED",
]);

export const DesignChangeCategoryEnum = z.enum([
  "LAYOUT_MODIFICATION",
  "MATERIAL_AND_FINISH",
  "COLOR_AND_TEXTURE",
  "LIGHTING_AND_ELECTRICAL",
  "DIMENSIONS_AND_SIZING",
  "FIXTURES_AND_FITTINGS",
  "COST_AND_BUDGET_REDUCTION",
  "STRUCTURAL_ALIGNMENT",
  "OTHER",
]);

export const DesignChangeRequestStatusEnum = z.enum([
  "PENDING",
  "IN_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "IMPLEMENTED",
]);

// Pin annotation schema for coordinate pins on drawing / render sheets
export const pinAnnotationSchema = z.object({
  id: z.string(),
  attachmentId: z.string().uuid("Invalid attachment ID format").optional(),
  x: z.number().min(0).max(100), // percentage coordinates (0-100%)
  y: z.number().min(0).max(100),
  comment: z.string().min(1).max(2000),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color").optional(),
});

// Digital signature capture schema
export const digitalSignatureSchema = z.object({
  signerName: z.string().min(1).max(150),
  signerEmail: z.string().email().optional(),
  signerPhone: z.string().optional(),
  signatureDataUrl: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  signedAt: z.string().optional(),
});

// ==========================================
// 1. DESIGN FOLDERS SCHEMAS
// ==========================================

export const createDesignFolderSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
  body: z.object({
    parentId: z.string().uuid("Invalid parent folder ID format").optional().nullable(),
    folderCode: z.string().max(50).optional().nullable(),
    name: z.string().min(1, "Folder name is required").max(150),
    description: z.string().max(3000).optional().nullable(),
    roomType: z.string().max(100).optional().nullable(),
    stage: DesignStageEnum.default("RENDER_3D").optional(),
    coverImageUrl: imageTypeSchema.optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    orderIndex: z.number().int().default(0).optional(),
    estimatedBudget: z.number().nonnegative().optional().nullable(),
    isClientPortalVisible: z.boolean().default(true).optional(),
    tags: z.array(z.string().max(50)).default([]).optional(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateDesignFolderSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid folder ID format"),
  }),
  body: z.object({
    parentId: z.string().uuid("Invalid parent folder ID format").optional().nullable(),
    folderCode: z.string().max(50).optional().nullable(),
    name: z.string().min(1).max(150).optional(),
    description: z.string().max(3000).optional().nullable(),
    roomType: z.string().max(100).optional().nullable(),
    stage: DesignStageEnum.optional(),
    coverImageUrl: imageTypeSchema.optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    orderIndex: z.number().int().optional(),
    estimatedBudget: z.number().nonnegative().optional().nullable(),
    isClientPortalVisible: z.boolean().optional(),
    tags: z.array(z.string().max(50)).optional(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const getDesignFoldersQuerySchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
  query: z.object({
    parentId: z.string().uuid().optional().nullable(),
    roomType: z.string().optional(),
    stage: DesignStageEnum.optional(),
    search: z.string().optional(),
    tree: z.string().optional(), // "true" to fetch recursive tree structure
  }),
});

// ==========================================
// 2. MASTER DESIGNS SCHEMAS
// ==========================================

export const createProjectDesignSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
  body: z.object({
    folderId: z.string().uuid("Invalid folder ID format").optional().nullable(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    designCode: z.string().max(50).optional().nullable(),
    title: z.string().min(1, "Title is required").max(200),
    designType: DesignTypeEnum.default("RENDER_3D").optional(),
    designStyle: z.string().max(100).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    roomArea: z.string().max(100).optional().nullable(),

    specifications: z.record(z.string(), z.any()).optional().nullable(),
    softwareUsed: z.array(z.string().max(50)).default([]).optional(),
    priority: ProjectPriorityEnum.default("MEDIUM").optional(),
    estimatedCost: z.number().nonnegative().optional().nullable(),

    createdById: z.string().uuid("Invalid creator ID format").optional().nullable(),
    isClientPortalVisible: z.boolean().default(true).optional(),
    coverImageUrl: imageTypeSchema.optional().nullable(),
    tags: z.array(z.string().max(50)).default([]).optional(),

    // Optional initial version creation in same transaction
    initialVersion: z
      .object({
        versionName: z.string().max(150).optional(),
        changelog: z.string().max(3000).optional(),
        renderingEngine: z.string().max(100).optional(),
        resolution: z.string().max(100).optional(),
        submissionNotes: z.string().max(3000).optional(),
        attachments: z
          .array(
            z.object({
              attachmentType: DesignAttachmentTypeEnum,
              title: z.string().min(1).max(200),
              caption: z.string().max(300).optional(),
              description: z.string().max(2000).optional(),
              file: imageTypeSchema.optional().nullable(),
              externalUrl: z.string().url().optional().nullable(),
              embedCode: z.string().optional().nullable(),
              thumbnail: imageTypeSchema.optional().nullable(),
              mimeType: z.string().max(100).optional(),
              fileSizeBytes: z.number().optional(),
              width: z.number().int().optional(),
              height: z.number().int().optional(),
              durationSeconds: z.number().int().optional(),
              isPrimary: z.boolean().default(false).optional(),
              orderIndex: z.number().int().default(0).optional(),
              isClientVisible: z.boolean().default(true).optional(),
              metadata: z.record(z.string(), z.any()).optional().nullable(),
            })
          )
          .optional(),
      })
      .optional(),
  }),
});

export const updateProjectDesignSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid design ID format"),
  }),
  body: z.object({
    folderId: z.string().uuid("Invalid folder ID format").optional().nullable(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    designCode: z.string().max(50).optional().nullable(),
    title: z.string().min(1).max(200).optional(),
    designType: DesignTypeEnum.optional(),
    designStyle: z.string().max(100).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    roomArea: z.string().max(100).optional().nullable(),

    specifications: z.record(z.string(), z.any()).optional().nullable(),
    softwareUsed: z.array(z.string().max(50)).optional(),
    priority: ProjectPriorityEnum.optional(),
    estimatedCost: z.number().nonnegative().optional().nullable(),

    status: DesignStatusEnum.optional(),
    isClientPortalVisible: z.boolean().optional(),
    coverImageUrl: imageTypeSchema.optional().nullable(),
    tags: z.array(z.string().max(50)).optional(),
  }),
});

export const getProjectDesignsQuerySchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
  query: z.object({
    folderId: z.string().uuid().optional(),
    milestoneId: z.string().uuid().optional(),
    roomArea: z.string().optional(),
    designType: DesignTypeEnum.optional(),
    designStyle: z.string().optional(),
    status: DesignStatusEnum.optional(),
    priority: ProjectPriorityEnum.optional(),
    search: z.string().optional(),
    page: z.string().optional().default("1"),
    limit: z.string().optional().default("20"),
    sortBy: z.enum(["createdAt", "updatedAt", "title", "currentVersionNumber", "priority"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

// ==========================================
// 3. DESIGN VERSIONS SCHEMAS
// ==========================================

export const createDesignVersionSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    designId: z.string().uuid("Invalid design ID format"),
  }),
  body: z.object({
    versionName: z.string().max(150).optional().nullable(), // e.g. "v2.0 - Smoked Oak Finish"
    changelog: z.string().max(5000).optional().nullable(),
    renderingEngine: z.string().max(100).optional().nullable(),
    resolution: z.string().max(100).optional().nullable(),
    submissionNotes: z.string().max(3000).optional().nullable(),
    submittedById: z.string().uuid("Invalid submitter ID format").optional().nullable(),
    autoSubmit: z.boolean().default(false).optional(),
    attachments: z
      .array(
        z.object({
          attachmentType: DesignAttachmentTypeEnum,
          title: z.string().min(1).max(200),
          caption: z.string().max(300).optional(),
          description: z.string().max(2000).optional(),
          file: imageTypeSchema.optional().nullable(),
          externalUrl: z.string().url().optional().nullable(),
          embedCode: z.string().optional().nullable(),
          thumbnail: imageTypeSchema.optional().nullable(),
          mimeType: z.string().max(100).optional(),
          fileSizeBytes: z.number().optional(),
          width: z.number().int().optional(),
          height: z.number().int().optional(),
          durationSeconds: z.number().int().optional(),
          isPrimary: z.boolean().default(false).optional(),
          orderIndex: z.number().int().default(0).optional(),
          isClientVisible: z.boolean().default(true).optional(),
          metadata: z.record(z.string(), z.any()).optional().nullable(),
        })
      )
      .optional(),
  }),
});

export const updateDesignVersionSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    designId: z.string().uuid("Invalid design ID format"),
    versionId: z.string().uuid("Invalid version ID format"),
  }),
  body: z.object({
    versionName: z.string().max(150).optional().nullable(),
    changelog: z.string().max(5000).optional().nullable(),
    renderingEngine: z.string().max(100).optional().nullable(),
    resolution: z.string().max(100).optional().nullable(),
    submissionNotes: z.string().max(3000).optional().nullable(),
  }),
});

export const submitDesignVersionSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    designId: z.string().uuid("Invalid design ID format"),
    versionId: z.string().uuid("Invalid version ID format"),
  }),
  body: z.object({
    submittedById: z.string().uuid("Invalid submitter ID format").optional().nullable(),
    submissionNotes: z.string().max(3000).optional().nullable(),
  }),
});

// ==========================================
// 4. ATTACHMENT SCHEMAS
// ==========================================

export const createDesignAttachmentSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    designId: z.string().uuid("Invalid design ID format"),
    versionId: z.string().uuid("Invalid version ID format"),
  }),
  body: z.object({
    attachmentType: DesignAttachmentTypeEnum,
    title: z.string().min(1, "Attachment title is required").max(200),
    caption: z.string().max(300).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    file: imageTypeSchema.optional().nullable(),
    externalUrl: z.string().url("Invalid external URL format").optional().nullable(),
    embedCode: z.string().max(5000).optional().nullable(),
    thumbnail: imageTypeSchema.optional().nullable(),
    mimeType: z.string().max(100).optional().nullable(),
    fileSizeBytes: z.number().optional().nullable(),
    width: z.number().int().optional().nullable(),
    height: z.number().int().optional().nullable(),
    durationSeconds: z.number().int().optional().nullable(),
    isPrimary: z.boolean().default(false).optional(),
    orderIndex: z.number().int().default(0).optional(),
    isClientVisible: z.boolean().default(true).optional(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateDesignAttachmentSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    designId: z.string().uuid("Invalid design ID format"),
    versionId: z.string().uuid("Invalid version ID format"),
    attachmentId: z.string().uuid("Invalid attachment ID format"),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    caption: z.string().max(300).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    externalUrl: z.string().url().optional().nullable(),
    embedCode: z.string().max(5000).optional().nullable(),
    thumbnail: imageTypeSchema.optional().nullable(),
    isPrimary: z.boolean().optional(),
    orderIndex: z.number().int().optional(),
    isClientVisible: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

// ==========================================
// 5. CLIENT APPROVALS SCHEMAS
// ==========================================

export const createDesignApprovalSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    designId: z.string().uuid("Invalid design ID format"),
    versionId: z.string().uuid("Invalid version ID format"),
  }),
  body: z.object({
    decision: DesignApprovalDecisionEnum,
    customerId: z.string().uuid("Invalid customer ID format").optional().nullable(),
    reviewComments: z.string().max(5000).optional().nullable(),
    conditions: z.array(z.string().max(300)).default([]).optional(),
    rejectionReason: z.string().max(3000).optional().nullable(),
    clientRating: z.number().int().min(1).max(5).optional().nullable(),
    scopeChecklist: z.record(z.string(), z.boolean()).optional().nullable(),
    digitalSignature: digitalSignatureSchema.optional().nullable(),
    signedDocumentUrl: imageTypeSchema.optional().nullable(),
  }),
});

// ==========================================
// 6. CHANGE REQUESTS SCHEMAS
// ==========================================

export const createDesignChangeRequestSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    designId: z.string().uuid("Invalid design ID format"),
    versionId: z.string().uuid("Invalid version ID format"),
  }),
  body: z.object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().min(1, "Description is required").max(5000),
    category: DesignChangeCategoryEnum.default("MATERIAL_AND_FINISH").optional(),
    urgency: ProjectPriorityEnum.default("MEDIUM").optional(),
    pinAnnotations: z.array(pinAnnotationSchema).optional().nullable(),
    referenceAttachments: z.array(imageTypeSchema).optional().nullable(),
  }),
});

export const respondDesignChangeRequestSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    designId: z.string().uuid("Invalid design ID format"),
    versionId: z.string().uuid("Invalid version ID format"),
    changeRequestId: z.string().uuid("Invalid change request ID format"),
  }),
  body: z.object({
    status: DesignChangeRequestStatusEnum,
    responseNotes: z.string().min(1, "Response notes are required").max(5000),
    respondedById: z.string().uuid("Invalid responder ID format").optional().nullable(),
    estimatedImpactDays: z.number().int().nonnegative().optional().nullable(),
    estimatedCostImpact: z.number().optional().nullable(),
    resolvedInVersionNumber: z.number().int().positive().optional().nullable(),
  }),
});

export const getDesignChangeRequestsQuerySchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    designId: z.string().uuid("Invalid design ID format"),
    versionId: z.string().uuid("Invalid version ID format"),
  }),
  query: z.object({
    status: DesignChangeRequestStatusEnum.optional(),
    category: DesignChangeCategoryEnum.optional(),
  }),
});
