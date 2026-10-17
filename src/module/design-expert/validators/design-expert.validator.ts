import { z } from "zod";
import { DesignExpertStatus, DayOfWeek } from "../../../types/types.js";

/**
 * Validation schema for creating a new Design Expert profile
 * @route POST /api/v1/design-experts
 * @access PLATFORM_ADMIN
 */
export const CreateDesignExpertSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  title: z.string().trim().min(2, "Title is required"),
  qualification: z.string().trim().optional(),
  experienceYears: z.number().int().min(0, "Experience years must be >= 0").default(0),
  specialties: z.array(z.string().trim()).default([]),
  languages: z.array(z.string().trim()).default(["English", "Hindi"]),
  bio: z.string().trim().optional(),
  avatarUrl: z.any().optional(), // ImageType JSON object or string
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  defaultMeetingUrl: z.string().trim().url("Invalid meeting URL format").optional().or(z.literal("")),
  consultationFee: z.number().min(0, "Fee must be non-negative").default(0),
  slotDurationMinutes: z.number().int().min(15).max(180).default(30),
  status: z.nativeEnum(DesignExpertStatus).default(DesignExpertStatus.ACTIVE),
  additionalInformation: z.record(z.string(), z.any()).optional(),
});

export type CreateDesignExpertInput = z.input<typeof CreateDesignExpertSchema>;

/**
 * Validation schema for partially updating a Design Expert profile (Rule 5: Dirty payload)
 * @route PATCH /api/v1/design-experts/:id
 * @access PLATFORM_ADMIN
 */
export const UpdateDesignExpertSchema = CreateDesignExpertSchema.partial();

export type UpdateDesignExpertInput = z.infer<typeof UpdateDesignExpertSchema>;

/**
 * Validation schema for querying paginated Design Experts directory
 * @route GET /api/v1/design-experts
 * @access Public / Authenticated
 */
export const GetDesignExpertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  specialty: z.string().trim().optional(),
  status: z.nativeEnum(DesignExpertStatus).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minExperience: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(["averageRating", "experienceYears", "consultationFee", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type GetDesignExpertsQuery = z.infer<typeof GetDesignExpertsQuerySchema>;

/**
 * Single shift structure for recurring weekly availability
 */
export const SingleShiftSchema = z.object({
  dayOfWeek: z.nativeEnum(DayOfWeek),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time must be HH:mm (e.g. 10:00)"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be HH:mm (e.g. 18:00)"),
  isAvailable: z.boolean().default(true),
  reason: z.string().trim().optional(),
}).refine(
  (data) => data.startTime < data.endTime,
  {
    message: "Start time must be earlier than end time",
    path: ["endTime"],
  }
);

/**
 * Validation schema for setting recurring weekly availability
 * @route PUT /api/v1/design-experts/:id/availability
 * @access PLATFORM_ADMIN
 */
export const SetWeeklyAvailabilitySchema = z.object({
  shifts: z.array(SingleShiftSchema),
});

export type SetWeeklyAvailabilityInput = z.infer<typeof SetWeeklyAvailabilitySchema>;

/**
 * Validation schema for adding a date-specific override or leave
 * @route POST /api/v1/design-experts/:id/availability/override
 * @access PLATFORM_ADMIN
 */
export const AddDateOverrideSchema = z.object({
  specificDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  isAvailable: z.boolean().default(false), // false = whole day leave
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  reason: z.string().trim().optional(),
}).refine(
  (data) => {
    if (data.isAvailable && data.startTime && data.endTime) {
      return data.startTime < data.endTime;
    }
    return true;
  },
  {
    message: "Start time must be earlier than end time for custom working hours",
    path: ["endTime"],
  }
);

export type AddDateOverrideInput = z.infer<typeof AddDateOverrideSchema>;

/**
 * Validation schema for calculating available time slots for a specific date
 * @route GET /api/v1/design-experts/:id/slots
 * @access Public / Authenticated
 */
export const GetSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export type GetSlotsQuery = z.infer<typeof GetSlotsQuerySchema>;
