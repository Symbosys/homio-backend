import { z } from "zod";
import { additionalInformationSchema, imageTypeSchema } from "./labour.validator.js";

export const BOOKING_STATUS_ENUM = [
  "PENDING_ASSIGNMENT",
  "REQUESTED",
  "CONFIRMED",
  "REJECTED_BY_LABOUR",
  "ACCEPTED_BY_LABOUR",
  "QUOTE_PROVIDED",
  "QUOTE_REJECTED",
  "WORK_STARTED",
  "IN_PROGRESS",
  "WORK_COMPLETED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
  "DELAY_REPORTED",
  "REASSIGNED",
  "PENDING",
] as const;

/**
 * 1. CREATE LABOUR BOOKING SCHEMA (B2B Project Site Allocation)
 */
export const createLabourBookingSchema = z.object({
  body: z.object({
    channel: z.enum(["ORGANIZATION_PROJECT", "PLATFORM_MARKETPLACE"]).default("ORGANIZATION_PROJECT").optional(),
    projectId: z.string().uuid("Invalid project ID format"),
    projectServiceId: z.string().uuid("Invalid project service ID format"),
    labourId: z.string().uuid("Invalid labour ID format"),
    workTitle: z.string().min(2, "Work title must be at least 2 characters").max(200),
    workDescription: z.string().optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    agreedDailyRate: z.coerce.number().positive("Agreed daily rate must be greater than 0"),
    estimatedDays: z.coerce.number().int().positive("Estimated days must be at least 1").default(1),
    status: z.enum(BOOKING_STATUS_ENUM).default("CONFIRMED"),
    serviceAddress: z.string().optional().nullable(),
    locality: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),
    latitude: z.coerce.number().optional().nullable(),
    longitude: z.coerce.number().optional().nullable(),
    geofenceRadius: z.coerce.number().int().positive().optional(),
    isStrictGeofence: z.boolean().optional(),
    notes: z.string().optional().nullable(),
    taskChecklist: z
      .union([
        z.array(
          z.object({
            task: z.string().min(1, "Task description is required"),
            done: z.boolean().default(false).optional(),
          })
        ),
        z.array(z.string()),
        z.any(),
      ])
      .optional()
      .nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2. CREATE MARKETPLACE LABOUR BOOKING SCHEMA (B2C Direct Homeowner Request)
 */
export const createMarketplaceBookingSchema = z.object({
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format"),
    workTitle: z.string().min(2, "Work title must be at least 2 characters").max(200),
    workDescription: z.string().optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    serviceAddress: z.string().min(3, "Service address is required"),
    locality: z.string().min(2, "Locality is required"),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    pincode: z.string().optional().nullable(),
    latitude: z.coerce.number().optional().nullable(),
    longitude: z.coerce.number().optional().nullable(),
    geofenceRadius: z.coerce.number().int().positive().default(200).optional(),
    isStrictGeofence: z.boolean().default(true).optional(),
    termsAccepted: z.boolean().refine((val) => val === true, {
      message: "Terms and conditions must be accepted to proceed with service booking",
    }),
    notes: z.string().optional().nullable(),
    taskChecklist: z
      .union([
        z.array(
          z.object({
            task: z.string().min(1, "Task description is required"),
            done: z.boolean().default(false).optional(),
          })
        ),
        z.array(z.string()),
        z.any(),
      ])
      .optional()
      .nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2B. CREATE SERVICE BOOKING SCHEMA (Client Homeowner Service Request)
 * Strictly contains only the user-specified fields:
 * workTitle, startDate, endDate, description, specialInstructions, taskChecklist, state, city, and category
 */
export const createServiceBookingSchema = z.object({
  body: z.object({
    workTitle: z.string().min(2, "Work title must be at least 2 characters").max(200),
    category: z.string().min(2, "Service category is required"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    description: z.string().optional().nullable(),
    specialInstructions: z.string().optional().nullable(),
    taskChecklist: z
      .union([
        z.array(
          z.object({
            task: z.string().min(1, "Task description is required"),
            done: z.boolean().default(false).optional(),
          })
        ),
        z.array(z.string()),
        z.any(),
      ])
      .optional()
      .nullable(),
    state: z.string().min(2, "State is required"),
    city: z.string().min(2, "City is required"),
    labourCount: z.coerce
      .number()
      .int("Labour count must be an integer")
      .min(1, "At least 1 labour must be requested")
      .max(5, "Maximum 5 labours can be requested")
      .default(1),
  }),
});

/**
 * 3. UPDATE LABOUR BOOKING SCHEMA (Symmetric full editability - Rule 19)
 */
export const updateLabourBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional().nullable(),
    projectServiceId: z.string().uuid("Invalid project service ID format").optional().nullable(),
    labourId: z.string().uuid("Invalid labour ID format").optional(),
    workTitle: z.string().min(2, "Work title must be at least 2 characters").max(200).optional(),
    workDescription: z.string().optional().nullable(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    serviceAddress: z.string().optional().nullable(),
    locality: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),
    latitude: z.coerce.number().optional().nullable(),
    longitude: z.coerce.number().optional().nullable(),
    geofenceRadius: z.coerce.number().int().positive().optional(),
    isStrictGeofence: z.boolean().optional(),
    agreedDailyRate: z.coerce.number().positive().optional(),
    estimatedDays: z.coerce.number().int().positive().optional(),
    totalBudget: z.coerce.number().nonnegative().optional(),
    status: z.enum(BOOKING_STATUS_ENUM).optional(),
    notes: z.string().optional().nullable(),
    taskChecklist: z
      .union([
        z.array(
          z.object({
            task: z.string().min(1, "Task description is required"),
            done: z.boolean().default(false).optional(),
          })
        ),
        z.array(z.string()),
        z.any(),
      ])
      .optional()
      .nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 4. UPDATE BOOKING STATUS SCHEMA
 */
export const updateBookingStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    status: z.enum(BOOKING_STATUS_ENUM),
    statusReason: z.string().optional().nullable(),
  }),
});

/**
 * 5. REJECT BOOKING SCHEMA
 */
export const rejectBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    reason: z.string().min(3, "Rejection reason must be at least 3 characters"),
  }),
});

/**
 * 6. SUBMIT ON-SITE QUOTE SCHEMA (Labour to Client)
 */
export const submitQuoteSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    quoteAmount: z.coerce.number().positive("Quote amount must be greater than 0"),
    quoteDescription: z.string().min(3, "Quote description must be at least 3 characters").max(1000),
  }),
});

/**
 * 7. RESPOND TO QUOTE SCHEMA (Client to Labour)
 */
export const respondQuoteSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z
    .object({
      accept: z.boolean().optional(),
      accepted: z.boolean().optional(),
      rejectionReason: z.string().optional().nullable(),
    })
    .refine((data) => data.accept !== undefined || data.accepted !== undefined, {
      message: "Either 'accept' or 'accepted' boolean field is required",
    }),
});

/**
 * 8. COMPLETE WORK WITH CHECKLIST & PROOF SCHEMA
 */
export const completeWorkSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    taskChecklist: z
      .array(
        z.object({
          task: z.string().min(1, "Task description is required"),
          done: z.boolean().default(true),
        })
      )
      .optional()
      .nullable(),
    proofPhotos: z.array(imageTypeSchema).optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});

/**
 * 9. CONFIRM COMPLETION & REVIEW SCHEMA (Client Final Sign-off)
 */
export const confirmCompletionSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    rating: z.coerce.number().min(1).max(5).optional(),
    review: z.string().optional().nullable(),
    reviewNotes: z.string().optional().nullable(),
    qualityRating: z.coerce.number().min(1).max(5).optional(),
    qualityScore: z.coerce.number().min(1).max(5).optional(),
    punctualityRating: z.coerce.number().min(1).max(5).optional(),
    punctualityScore: z.coerce.number().min(1).max(5).optional(),
    behaviorRating: z.coerce.number().min(1).max(5).optional(),
    behaviourScore: z.coerce.number().min(1).max(5).optional(),
  }),
});

/**
 * 10. BOOKING ID PARAM SCHEMA
 */
export const bookingIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
});

/**
 * 11. GET ALL BOOKINGS QUERY SCHEMA
 */
export const getLabourBookingsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    channel: z.enum(["ORGANIZATION_PROJECT", "PLATFORM_MARKETPLACE"]).optional(),
    projectId: z.string().uuid().optional(),
    projectServiceId: z.string().uuid().optional(),
    labourId: z.string().uuid().optional(),
    clientId: z.string().uuid().optional(),
    status: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    locality: z.string().optional(),
    search: z.string().optional(),
    trade: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    date: z.string().optional(),
  }),
});

/**
 * 12. REPORT DELAY SCHEMA (User reports labour failed to reach within 24h)
 */
export const reportDelaySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    reason: z
      .string()
      .min(5, "Delay reason must be at least 5 characters")
      .default("Worker failed to arrive at described service location after 24 hours"),
    evidenceNotes: z.string().optional().nullable(),
  }),
});

/**
 * 13. REASSIGN LABOUR SCHEMA (Platform manually reassigns replacement worker)
 */
export const reassignLabourSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    newLabourId: z.string().uuid("Invalid new labour ID format"),
    reason: z.string().min(3, "Reassignment reason is required"),
    resetStatusTo: z.enum(["REQUESTED", "ACCEPTED_BY_LABOUR"]).default("REQUESTED").optional(),
  }),
});

export type CreateLabourBookingInput = z.infer<typeof createLabourBookingSchema>["body"];
export type CreateMarketplaceBookingInput = z.infer<typeof createMarketplaceBookingSchema>["body"];
export type CreateServiceBookingInput = z.infer<typeof createServiceBookingSchema>["body"];
export type UpdateLabourBookingInput = z.infer<typeof updateLabourBookingSchema>["body"];
export type GetLabourBookingsQuery = z.infer<typeof getLabourBookingsQuerySchema>["query"];
export type SubmitQuoteInput = z.infer<typeof submitQuoteSchema>["body"];
export type RespondQuoteInput = z.infer<typeof respondQuoteSchema>["body"];
export type RejectBookingInput = z.infer<typeof rejectBookingSchema>["body"];
export type CompleteWorkInput = z.infer<typeof completeWorkSchema>["body"];
export type ConfirmCompletionInput = z.infer<typeof confirmCompletionSchema>["body"];
export type ReportDelayInput = z.infer<typeof reportDelaySchema>["body"];
export type ReassignLabourInput = z.infer<typeof reassignLabourSchema>["body"];

/**
 * 14. CHECK AVAILABILITY QUERY SCHEMA
 */
export const checkAvailabilityQuerySchema = z.object({
  query: z.object({
    state: z.string().min(2, "State is required"),
    city: z.string().min(2, "City is required"),
    category: z.string().min(2, "Category is required"),
    labourCount: z.coerce
      .number()
      .int("Labour count must be an integer")
      .min(1, "At least 1 labour must be requested")
      .max(5, "Maximum 5 labours can be requested")
      .default(1)
      .optional(),
  }),
});
export type CheckAvailabilityQuery = z.infer<typeof checkAvailabilityQuerySchema>["query"];

/**
 * 15. MANUAL ASSIGN LABOUR SCHEMA (Platform Admin manually assigns labour)
 */
export const manualAssignLabourSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format"),
    notes: z.string().optional().nullable(),
  }),
});
export type ManualAssignLabourInput = z.infer<typeof manualAssignLabourSchema>["body"];

/**
 * 16. PLATFORM LABOUR SETTING SCHEMA (Toggle switch & thresholds)
 */
export const platformLabourSettingSchema = z.object({
  body: z.object({
    autoAssignLabour: z.boolean().optional(),
    cooldownPeriodDays: z.coerce.number().int().positive().optional(),
    consecutiveRejectionsThreshold: z.coerce.number().int().positive().optional(),
    delayReportMinHours: z.coerce.number().int().positive().optional(),
  }),
});
export type PlatformLabourSettingInput = z.infer<typeof platformLabourSettingSchema>["body"];

