import { z } from "zod";
import {
  ProjectPaymentType,
  PaymentFlowDirection,
  ProjectPaymentStatus,
  ProjectPaymentMethod,
} from "../../../types/types";
import { imageTypeSchema } from "./project.validator.js";

// ==========================================
// ENUMS VALIDATORS (PRISMA CLIENT NATIVE ENUMS - RULE 22)
// ==========================================

export const ProjectPaymentTypeEnum = z.nativeEnum(ProjectPaymentType);
export const PaymentFlowDirectionEnum = z.nativeEnum(PaymentFlowDirection);
export const ProjectPaymentStatusEnum = z.nativeEnum(ProjectPaymentStatus);
export const ProjectPaymentMethodEnum = z.nativeEnum(ProjectPaymentMethod);

// ==========================================
// PARAM SCHEMAS
// ==========================================

export const paymentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payment ID format"),
  }),
});

export const projectPaymentParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

/**
 * Validator schema for creating a project payment transaction
 */
export const createPaymentSchema = z.object({
  params: z
    .object({
      projectId: z.string().uuid("Invalid project ID format").optional(),
    })
    .optional(),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    customerId: z.string().uuid("Invalid customer ID format").optional().nullable(),

    paymentNumber: z.string().max(100).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(255),

    paymentType: ProjectPaymentTypeEnum.default(ProjectPaymentType.TURNKEY_PACKAGE),
    flowDirection: PaymentFlowDirectionEnum.default(PaymentFlowDirection.INFLOW),
    status: ProjectPaymentStatusEnum.default(ProjectPaymentStatus.COMPLETED),

    amount: z.coerce.number().positive("Amount must be greater than 0"),

    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Payment date must be in YYYY-MM-DD format"),
    paymentMethod: ProjectPaymentMethodEnum.default(ProjectPaymentMethod.BANK_TRANSFER),
    transactionReference: z.string().max(150).optional().nullable(),
    bankName: z.string().max(150).optional().nullable(),

    recordedById: z.string().uuid("Invalid recordedBy employee ID format").optional().nullable(),

    receiptUrl: imageTypeSchema.optional().nullable(),
    attachments: z.array(imageTypeSchema).optional().nullable(),

    notes: z.string().max(5000).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for updating an existing project payment transaction (Rule 5: Dirty/Partial updates)
 */
export const updatePaymentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payment ID format"),
  }),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    customerId: z.string().uuid("Invalid customer ID format").optional().nullable(),

    paymentNumber: z.string().max(100).optional(),
    title: z.string().min(2, "Title must be at least 2 characters").max(255).optional(),

    paymentType: ProjectPaymentTypeEnum.optional(),
    flowDirection: PaymentFlowDirectionEnum.optional(),
    status: ProjectPaymentStatusEnum.optional(),

    amount: z.coerce.number().positive("Amount must be greater than 0").optional(),

    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Payment date must be in YYYY-MM-DD format").optional(),
    paymentMethod: ProjectPaymentMethodEnum.optional(),
    transactionReference: z.string().max(150).optional().nullable(),
    bankName: z.string().max(150).optional().nullable(),

    recordedById: z.string().uuid("Invalid recordedBy employee ID format").optional().nullable(),

    receiptUrl: imageTypeSchema.optional().nullable(),
    attachments: z.array(imageTypeSchema).optional().nullable(),

    notes: z.string().max(5000).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for fetching paginated payments with filters
 */
export const getPaymentsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    projectId: z.string().uuid("Invalid project ID format").optional(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional(),
    customerId: z.string().uuid("Invalid customer ID format").optional(),
    paymentType: ProjectPaymentTypeEnum.optional(),
    flowDirection: PaymentFlowDirectionEnum.optional(),
    status: ProjectPaymentStatusEnum.optional(),
    paymentMethod: ProjectPaymentMethodEnum.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortBy: z.enum(["paymentDate", "amount", "createdAt", "paymentNumber"]).default("paymentDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

/**
 * Validator schema for payment financial summary analytics
 */
export const getPaymentSummaryQuerySchema = z.object({
  query: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});
