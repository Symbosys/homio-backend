import { z } from "zod";

export const serviceVisitTypeEnum = z.enum([
  "INITIAL_INSPECTION",
  "CORRECTIVE_REPAIR",
  "PREVENTIVE_MAINTENANCE",
  "ANNUAL_MAINTENANCE",
  "WARRANTY_RECTIFICATION",
  "POST_HANDOVER_SNAGGING",
  "CUSTOMER_DEMO",
  "TOUCH_UP_FINISHING",
]);

export const serviceVisitStatusEnum = z.enum([
  "SCHEDULED",
  "DISPATCHED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
]);

/**
 * Validator schema for creating a service visit
 */
export const createServiceVisitSchema = z
  .object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    serviceRequestId: z.string().uuid("Invalid service request ID format"),
    visitType: serviceVisitTypeEnum.optional().default("CORRECTIVE_REPAIR"),
    status: serviceVisitStatusEnum.optional().default("SCHEDULED"),
    scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid scheduledDate format"),
    startTime: z.string().max(50).optional().nullable(),
    endTime: z.string().max(50).optional().nullable(),
    assignedEmployeeId: z.string().uuid("Invalid employee ID format").optional().nullable(),
    contactPerson: z.string().max(255).optional().nullable(),
    contactNumber: z.string().max(50).optional().nullable(),
    specialInstructions: z.string().optional().nullable(),
    technicianNotes: z.string().optional().nullable(),
    additionalInformation: z.any().optional(),
  })
  .transform((data) => ({
    ...data,
    specialInstructions: data.specialInstructions ?? data.technicianNotes ?? null,
  }));

/**
 * Validator schema for updating a service visit
 */
export const updateServiceVisitSchema = z
  .object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    serviceRequestId: z.string().uuid("Invalid service request ID format").optional(),
    visitType: serviceVisitTypeEnum.optional(),
    status: serviceVisitStatusEnum.optional(),
    scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid scheduledDate format").optional(),
    startTime: z.string().max(50).optional().nullable(),
    endTime: z.string().max(50).optional().nullable(),
    assignedEmployeeId: z.string().uuid("Invalid employee ID format").optional().nullable(),
    contactPerson: z.string().max(255).optional().nullable(),
    contactNumber: z.string().max(50).optional().nullable(),
    specialInstructions: z.string().optional().nullable(),
    technicianNotes: z.string().optional().nullable(),
    additionalInformation: z.any().optional(),
  })
  .transform((data) => ({
    ...data,
    specialInstructions:
      data.specialInstructions !== undefined
        ? data.specialInstructions
        : data.technicianNotes !== undefined
        ? data.technicianNotes
        : undefined,
  }));

/**
 * Validator schema for technician mobile check-in
 */
export const checkInServiceVisitSchema = z.object({
  checkInLatitude: z.coerce.number().min(-90).max(90),
  checkInLongitude: z.coerce.number().min(-180).max(180),
  checkInAddress: z.string().optional().nullable(),
});

/**
 * Validator schema for work report submission
 */
export const submitWorkReportSchema = z
  .object({
    diagnosisNotes: z.string().optional().nullable(),
    technicianNotes: z.string().optional().nullable(),
    workPerformed: z.string().optional().nullable(),
    workSummary: z.string().optional().nullable(),
    materialsUsed: z.string().optional().nullable(),
    partsUsed: z.string().optional().nullable(),
    labourHours: z.coerce.number().min(0).max(999.99).optional().nullable(),
    laborHours: z.coerce.number().min(0).max(999.99).optional().nullable(),
  })
  .transform((data) => {
    const workPerformed = (data.workPerformed || data.workSummary || "").trim();
    const diagnosisNotes = data.diagnosisNotes || data.technicianNotes || null;
    const materialsUsed = data.materialsUsed || data.partsUsed || null;
    const labourHours = Number(data.labourHours ?? data.laborHours ?? 0);
    return {
      workPerformed,
      diagnosisNotes,
      materialsUsed,
      labourHours,
    };
  })
  .refine((data) => data.workPerformed.length >= 2, {
    message: "Work performed description is required and must be at least 2 characters",
    path: ["workPerformed"],
  });

/**
 * Validator schema for customer digital touch sign-off
 */
export const signOffServiceVisitSchema = z
  .object({
    customerSignatureName: z.string().optional().nullable(),
    customerSignoffName: z.string().optional().nullable(),
    rating: z.coerce.number().min(1.0).max(5.0).optional().nullable(),
    customerRating: z.coerce.number().min(1.0).max(5.0).optional().nullable(),
    customerFeedback: z.string().optional().nullable(),
  })
  .transform((data) => {
    const customerSignatureName = (data.customerSignatureName || data.customerSignoffName || "").trim();
    const rating = data.rating ?? data.customerRating ?? null;
    return {
      customerSignatureName,
      rating,
    };
  })
  .refine((data) => data.customerSignatureName.length >= 2, {
    message: "Signee name must be at least 2 characters",
    path: ["customerSignatureName"],
  });

/**
 * Validator schema for updating visit status
 */
export const updateServiceVisitStatusSchema = z.object({
  status: serviceVisitStatusEnum,
});

/**
 * Validator schema for listing service visits
 */
export const getServiceVisitsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  serviceRequestId: z.string().uuid().optional(),
  assignedEmployeeId: z.string().uuid().optional(),
  visitType: serviceVisitTypeEnum.optional(),
  status: serviceVisitStatusEnum.optional(),
  scheduledDate: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Validator schema for service visit ID param
 */
export const serviceVisitIdParamSchema = z.object({
  id: z.string().uuid("Invalid service visit ID format"),
});

export type CreateServiceVisitInput = z.infer<typeof createServiceVisitSchema>;
export type UpdateServiceVisitInput = z.infer<typeof updateServiceVisitSchema>;
export type CheckInServiceVisitInput = z.infer<typeof checkInServiceVisitSchema>;
export type SubmitWorkReportInput = z.infer<typeof submitWorkReportSchema>;
export type SignOffServiceVisitInput = z.infer<typeof signOffServiceVisitSchema>;
export type UpdateServiceVisitStatusInput = z.infer<typeof updateServiceVisitStatusSchema>;
export type GetServiceVisitsQueryInput = z.infer<typeof getServiceVisitsQuerySchema>;
