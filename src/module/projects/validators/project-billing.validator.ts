import { z } from "zod";
import {
  ProjectBillType,
  ProjectBillStatus,
  BillCommissionStatus,
  ProjectPaymentRecordStatus,
  ProjectStage,
  ProjectPaymentMethod,
} from "../../../types/types.js";
import { imageTypeSchema } from "./project.validator.js";

// ==========================================
// 1. NATIVE ENUMS VALIDATORS (RULE 22)
// ==========================================

export const ProjectBillTypeEnum = z.nativeEnum(ProjectBillType);
export const ProjectBillStatusEnum = z.nativeEnum(ProjectBillStatus);
export const BillCommissionStatusEnum = z.nativeEnum(BillCommissionStatus);
export const ProjectPaymentRecordStatusEnum = z.nativeEnum(ProjectPaymentRecordStatus);
export const ProjectStageEnum = z.nativeEnum(ProjectStage);
export const ProjectPaymentMethodEnum = z.nativeEnum(ProjectPaymentMethod);

// ==========================================
// 2. PARAM VALIDATION SCHEMAS
// ==========================================

export const billIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid bill ID format"),
  }),
});

export const projectBillParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

export const paymentRecordIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payment record ID format"),
  }),
});

export const projectPaymentRecordParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

// ==========================================
// 3. PROJECT BILL SCHEMAS
// ==========================================

/**
 * Validator schema for creating a Project Bill (Material, Labour, Design, Supervision)
 */
export const createProjectBillSchema = z.object({
  params: z
    .object({
      projectId: z.string().uuid("Invalid project ID format").optional(),
    })
    .optional(),
  body: z
    .object({
      projectId: z.string().uuid("Invalid project ID format"),
      billNumber: z.string().max(100).optional(),
      title: z.string().min(2, "Title must be at least 2 characters").max(255),
      billType: ProjectBillTypeEnum,
      stage: ProjectStageEnum.default(ProjectStage.EXECUTION),

      // Material Bill Specific Linkages
      vendorId: z.string().uuid("Invalid vendor ID format").optional().nullable(),
      materialCategory: z.string().max(100).optional().nullable(),

      // Labour Bill Specific Linkages
      labourId: z.string().uuid("Invalid labour ID format").optional().nullable(),
      labourTrade: z.string().max(100).optional().nullable(),

      // Financial Amounts
      totalAmount: z.coerce.number().min(0, "Total amount cannot be negative").default(0),
      taxPercent: z.coerce.number().min(0, "Tax percent cannot be negative").max(100).default(0),
      taxAmount: z.coerce.number().min(0, "Tax amount cannot be negative").default(0),
      grandTotal: z.coerce.number().min(0, "Grand total cannot be negative").default(0),

      // Commission Tracking (Default DUE)
      commissionStatus: BillCommissionStatusEnum.default(BillCommissionStatus.DUE),
      commissionRate: z.coerce.number().min(0).max(100).default(0),
      commissionAmount: z.coerce.number().min(0).default(0),
      commissionPaidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Date format must be YYYY-MM-DD").optional().nullable(),

      // Lifecycles & Dates
      billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Bill date must be in YYYY-MM-DD format"),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Due date must be in YYYY-MM-DD format").optional().nullable(),
      status: ProjectBillStatusEnum.default(ProjectBillStatus.DRAFT),

      // Cloud Attachments (ImageType JSON)
      billDocumentUrl: imageTypeSchema.optional().nullable(),
      attachments: z.array(imageTypeSchema).optional().nullable(),

      // Personnel Attribution (Employee)
      createdById: z.string().uuid("Invalid createdById employee ID format").optional().nullable(),
      approvedById: z.string().uuid("Invalid approvedById employee ID format").optional().nullable(),

      // Notes & Universal Additional Information (Rule 18)
      notes: z.string().max(5000).optional().nullable(),
      additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
    })
    .refine(
      (data) => {
        if (data.billType === ProjectBillType.MATERIAL && !data.vendorId) {
          return false;
        }
        return true;
      },
      {
        message: "Vendor is required for MATERIAL bills",
        path: ["vendorId"],
      }
    )
    .refine(
      (data) => {
        if (data.billType === ProjectBillType.LABOUR && !data.labourId) {
          return false;
        }
        return true;
      },
      {
        message: "Labour is required for LABOUR bills",
        path: ["labourId"],
      }
    ),
});

/**
 * Validator schema for updating an existing Project Bill (Rule 5: Dirty / Partial updates)
 */
export const updateProjectBillSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid bill ID format"),
  }),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    billNumber: z.string().max(100).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(255).optional(),
    billType: ProjectBillTypeEnum.optional(),
    stage: ProjectStageEnum.optional(),

    vendorId: z.string().uuid("Invalid vendor ID format").optional().nullable(),
    materialCategory: z.string().max(100).optional().nullable(),

    labourId: z.string().uuid("Invalid labour ID format").optional().nullable(),
    labourTrade: z.string().max(100).optional().nullable(),

    totalAmount: z.coerce.number().min(0).optional(),
    taxPercent: z.coerce.number().min(0).max(100).optional(),
    taxAmount: z.coerce.number().min(0).optional(),
    grandTotal: z.coerce.number().min(0).optional(),

    commissionStatus: BillCommissionStatusEnum.optional(),
    commissionRate: z.coerce.number().min(0).max(100).optional(),
    commissionAmount: z.coerce.number().min(0).optional(),
    commissionPaidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable(),

    billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable(),
    status: ProjectBillStatusEnum.optional(),

    billDocumentUrl: imageTypeSchema.optional().nullable(),
    attachments: z.array(imageTypeSchema).optional().nullable(),

    createdById: z.string().uuid("Invalid createdById employee ID format").optional().nullable(),
    approvedById: z.string().uuid("Invalid approvedById employee ID format").optional().nullable(),

    notes: z.string().max(5000).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for updating bill status transition
 */
export const updateProjectBillStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid bill ID format"),
  }),
  body: z.object({
    status: ProjectBillStatusEnum,
    notes: z.string().max(1000).optional(),
  }),
});

/**
 * Validator schema for querying paginated Project Bills
 */
export const getProjectBillsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    projectId: z.string().uuid("Invalid project ID format").optional(),
    billType: ProjectBillTypeEnum.optional(),
    stage: ProjectStageEnum.optional(),
    status: ProjectBillStatusEnum.optional(),
    vendorId: z.string().uuid("Invalid vendor ID format").optional(),
    labourId: z.string().uuid("Invalid labour ID format").optional(),
    materialCategory: z.string().optional(),
    commissionStatus: BillCommissionStatusEnum.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortBy: z.enum(["billDate", "grandTotal", "dueAmount", "createdAt", "billNumber"]).default("billDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

// ==========================================
// 4. PROJECT PAYMENT RECORD SCHEMAS
// ==========================================

/**
 * Validator schema for creating a Project Payment Record
 */
export const createProjectPaymentRecordSchema = z.object({
  params: z
    .object({
      projectId: z.string().uuid("Invalid project ID format").optional(),
    })
    .optional(),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    billId: z.string().uuid("Invalid bill ID format").optional().nullable(),

    paymentNumber: z.string().max(100).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(255),
    stage: ProjectStageEnum.default(ProjectStage.EXECUTION),
    billType: ProjectBillTypeEnum,
    status: ProjectPaymentRecordStatusEnum.default(ProjectPaymentRecordStatus.SUCCESS),

    amount: z.coerce.number().positive("Payment amount must be greater than 0"),

    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Payment date must be in YYYY-MM-DD format"),
    paymentMethod: ProjectPaymentMethodEnum.default(ProjectPaymentMethod.BANK_TRANSFER),
    transactionReference: z.string().max(150).optional().nullable(),
    bankName: z.string().max(150).optional().nullable(),

    recordedById: z.string().uuid("Invalid recordedById employee ID format").optional().nullable(),

    receiptUrl: imageTypeSchema.optional().nullable(),
    attachments: z.array(imageTypeSchema).optional().nullable(),

    notes: z.string().max(5000).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for updating an existing Project Payment Record
 */
export const updateProjectPaymentRecordSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payment record ID format"),
  }),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    billId: z.string().uuid("Invalid bill ID format").optional().nullable(),

    paymentNumber: z.string().max(100).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(255).optional(),
    stage: ProjectStageEnum.optional(),
    billType: ProjectBillTypeEnum.optional(),
    status: ProjectPaymentRecordStatusEnum.optional(),

    amount: z.coerce.number().positive("Payment amount must be greater than 0").optional(),

    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    paymentMethod: ProjectPaymentMethodEnum.optional(),
    transactionReference: z.string().max(150).optional().nullable(),
    bankName: z.string().max(150).optional().nullable(),

    recordedById: z.string().uuid("Invalid recordedById employee ID format").optional().nullable(),

    receiptUrl: imageTypeSchema.optional().nullable(),
    attachments: z.array(imageTypeSchema).optional().nullable(),

    notes: z.string().max(5000).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for querying paginated Project Payment Records
 */
export const getProjectPaymentRecordsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    projectId: z.string().uuid("Invalid project ID format").optional(),
    billId: z.string().uuid("Invalid bill ID format").optional(),
    billType: ProjectBillTypeEnum.optional(),
    stage: ProjectStageEnum.optional(),
    status: ProjectPaymentRecordStatusEnum.optional(),
    paymentMethod: ProjectPaymentMethodEnum.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortBy: z.enum(["paymentDate", "amount", "createdAt", "paymentNumber"]).default("paymentDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

/**
 * Validator schema for commercial summary analytics
 */
export const getProjectCommercialSummaryQuerySchema = z.object({
  query: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    stage: ProjectStageEnum.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

// ==========================================
// 5. INFERRED TYPESCRIPT TYPES
// ==========================================

export type CreateProjectBillInput = z.infer<typeof createProjectBillSchema>["body"];
export type UpdateProjectBillInput = z.infer<typeof updateProjectBillSchema>["body"];
export type GetProjectBillsQuery = z.infer<typeof getProjectBillsQuerySchema>["query"];
export type CreateProjectPaymentRecordInput = z.infer<typeof createProjectPaymentRecordSchema>["body"];
export type UpdateProjectPaymentRecordInput = z.infer<typeof updateProjectPaymentRecordSchema>["body"];
export type GetProjectPaymentRecordsQuery = z.infer<typeof getProjectPaymentRecordsQuerySchema>["query"];
export type GetProjectCommercialSummaryQuery = z.infer<typeof getProjectCommercialSummaryQuerySchema>["query"];
