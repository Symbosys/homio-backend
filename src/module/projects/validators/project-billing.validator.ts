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
// 1.1 HELPER PREPROCESSORS (FOR MULTIPART / JSON FORMS)
// ==========================================

const nullableUuid = (msg: string) =>
  z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (val === "" || val === "null" || val === "undefined" || val === null) return null;
    return val;
  }, z.string().uuid(msg).nullable().optional());

const nullableDate = (msg: string = "Invalid date format (must be YYYY-MM-DD)") =>
  z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (val === "" || val === "null" || val === "undefined" || val === null) return null;
    return val;
  }, z.string().regex(/^\d{4}-\d{2}-\d{2}/, msg).nullable().optional());

const nullableString = (maxLen: number) =>
  z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (val === "" || val === "null" || val === "undefined" || val === null) return null;
    return val;
  }, z.string().max(maxLen).nullable().optional());

const jsonImagePreprocessor = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === "" || val === "null" || val === "undefined" || val === null) return null;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}, imageTypeSchema.nullable().optional());

const jsonImageArrayPreprocessor = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === "" || val === "null" || val === "undefined" || val === null) return null;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return val;
    }
  }
  return val;
}, z.array(imageTypeSchema).nullable().optional());

const jsonObjectPreprocessor = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === "" || val === "null" || val === "undefined" || val === null) return null;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}, z.record(z.string(), z.any()).nullable().optional());

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
      vendorId: nullableUuid("Invalid vendor ID format"),
      materialCategory: nullableString(100),

      // Labour Bill Specific Linkages
      labourId: nullableUuid("Invalid labour ID format"),
      labourTrade: nullableString(100),

      // Financial Amounts
      totalAmount: z.coerce.number().min(0, "Total amount cannot be negative").default(0),
      taxPercent: z.coerce.number().min(0, "Tax percent cannot be negative").max(100).default(0),
      taxAmount: z.coerce.number().min(0, "Tax amount cannot be negative").default(0),
      grandTotal: z.coerce.number().min(0, "Grand total cannot be negative").default(0),

      // Commission Tracking (Default DUE)
      commissionStatus: BillCommissionStatusEnum.default(BillCommissionStatus.DUE),
      commissionRate: z.coerce.number().min(0).max(100).default(0),
      commissionAmount: z.coerce.number().min(0).default(0),
      commissionPaidDate: nullableDate("Commission paid date must be YYYY-MM-DD"),

      // Lifecycles & Dates
      billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Bill date must be in YYYY-MM-DD format"),
      dueDate: nullableDate("Due date must be in YYYY-MM-DD format"),
      status: ProjectBillStatusEnum.default(ProjectBillStatus.DRAFT),

      // Cloud Attachments (ImageType JSON)
      billDocumentUrl: jsonImagePreprocessor,
      attachments: jsonImageArrayPreprocessor,

      // Personnel Attribution (Employee)
      createdById: nullableUuid("Invalid createdById employee ID format"),
      approvedById: nullableUuid("Invalid approvedById employee ID format"),

      // Notes & Universal Additional Information (Rule 18)
      notes: nullableString(5000),
      additionalInformation: jsonObjectPreprocessor,
    }),
});

/**
 * Validator schema for updating an existing Project Bill (Rule 5: Dirty / Partial updates)
 */
export const updateProjectBillSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid bill ID format"),
  }),
  body: z.object({
    projectId: nullableUuid("Invalid project ID format"),
    billNumber: z.string().max(100).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(255).optional(),
    billType: ProjectBillTypeEnum.optional(),
    stage: ProjectStageEnum.optional(),

    vendorId: nullableUuid("Invalid vendor ID format"),
    materialCategory: nullableString(100),

    labourId: nullableUuid("Invalid labour ID format"),
    labourTrade: nullableString(100),

    totalAmount: z.coerce.number().min(0).optional(),
    taxPercent: z.coerce.number().min(0).max(100).optional(),
    taxAmount: z.coerce.number().min(0).optional(),
    grandTotal: z.coerce.number().min(0).optional(),

    commissionStatus: BillCommissionStatusEnum.optional(),
    commissionRate: z.coerce.number().min(0).max(100).optional(),
    commissionAmount: z.coerce.number().min(0).optional(),
    commissionPaidDate: nullableDate("Commission paid date must be YYYY-MM-DD"),

    billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    dueDate: nullableDate("Due date must be in YYYY-MM-DD format"),
    status: ProjectBillStatusEnum.optional(),

    billDocumentUrl: jsonImagePreprocessor,
    attachments: jsonImageArrayPreprocessor,

    createdById: nullableUuid("Invalid createdById employee ID format"),
    approvedById: nullableUuid("Invalid approvedById employee ID format"),

    notes: nullableString(5000),
    additionalInformation: jsonObjectPreprocessor,
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
    billId: nullableUuid("Invalid bill ID format"),

    paymentNumber: z.string().max(100).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(255),
    stage: ProjectStageEnum.default(ProjectStage.EXECUTION),
    billType: ProjectBillTypeEnum,
    status: ProjectPaymentRecordStatusEnum.default(ProjectPaymentRecordStatus.SUCCESS),

    amount: z.coerce.number().positive("Payment amount must be greater than 0"),

    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Payment date must be in YYYY-MM-DD format"),
    paymentMethod: ProjectPaymentMethodEnum.default(ProjectPaymentMethod.BANK_TRANSFER),
    transactionReference: nullableString(150),
    bankName: nullableString(150),

    recordedById: nullableUuid("Invalid recordedById employee ID format"),

    receiptUrl: jsonImagePreprocessor,
    attachments: jsonImageArrayPreprocessor,

    notes: nullableString(5000),
    additionalInformation: jsonObjectPreprocessor,
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
    projectId: nullableUuid("Invalid project ID format"),
    billId: nullableUuid("Invalid bill ID format"),

    paymentNumber: z.string().max(100).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(255).optional(),
    stage: ProjectStageEnum.optional(),
    billType: ProjectBillTypeEnum.optional(),
    status: ProjectPaymentRecordStatusEnum.optional(),

    amount: z.coerce.number().positive("Payment amount must be greater than 0").optional(),

    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    paymentMethod: ProjectPaymentMethodEnum.optional(),
    transactionReference: nullableString(150),
    bankName: nullableString(150),

    recordedById: nullableUuid("Invalid recordedById employee ID format"),

    receiptUrl: jsonImagePreprocessor,
    attachments: jsonImageArrayPreprocessor,

    notes: nullableString(5000),
    additionalInformation: jsonObjectPreprocessor,
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
