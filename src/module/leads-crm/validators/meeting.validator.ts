import { z } from "zod";

export const MeetingTypeEnum = z.enum(["ONLINE", "SITE_VISIT", "OFFLINE", "PHONE_CALL", "OTHER"]);
export const MeetingStatusEnum = z.enum([
  "SCHEDULED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_SHOW",
]);
export const AttendeeRoleEnum = z.enum(["ORGANIZER", "HOST", "CO_HOST", "ATTENDEE", "OPTIONAL"]);
export const AttendeeStatusEnum = z.enum(["INVITED", "ACCEPTED", "TENTATIVE", "DECLINED"]);

export const meetingIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meeting ID format"),
  }),
});

export const meetingAttendeeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meeting ID format"),
    attendeeId: z.string().uuid("Invalid attendee ID format"),
  }),
});

export const attendeePayloadSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID").optional().nullable(),
  userId: z.string().uuid("Invalid user ID").optional().nullable(),
  name: z.string().min(1, "Attendee name is required").max(100),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().max(20).optional().nullable().or(z.literal("")),
  role: AttendeeRoleEnum.default("ATTENDEE").optional(),
  isCustomer: z.boolean().default(false).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const createMeetingSchema = z.object({
  body: z.object({
    // Polymorphic Linkage
    leadId: z.string().uuid("Invalid lead ID").optional().nullable(),
    customerId: z.string().uuid("Invalid customer ID").optional().nullable(),
    projectId: z.string().uuid("Invalid project ID").optional().nullable(),

    title: z.string().min(1, "Meeting title is required").max(200),
    description: z.string().max(2000).optional().nullable(),
    agenda: z.string().max(2000).optional().nullable(),
    type: MeetingTypeEnum.default("ONLINE").optional(),
    status: MeetingStatusEnum.default("SCHEDULED").optional(),

    // Date & Timings
    meetingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    startTime: z.string().datetime({ message: "startTime must be a valid ISO datetime" }),
    endTime: z.string().datetime({ message: "endTime must be a valid ISO datetime" }),
    durationMinutes: z.coerce.number().int().positive().default(30).optional(),
    timezone: z.string().default("Asia/Kolkata").optional(),

    // Online Meeting Details
    meetingUrl: z.string().url("Invalid meeting URL").optional().nullable().or(z.literal("")),
    meetingProvider: z.string().max(50).optional().nullable(), // GOOGLE_MEET, ZOOM, MICROSOFT_TEAMS, etc.
    meetingId: z.string().max(100).optional().nullable(),
    meetingPasscode: z.string().max(50).optional().nullable(),

    // Physical Location / Site Details
    locationName: z.string().max(150).optional().nullable(),
    locationAddress: z.string().max(500).optional().nullable(),
    locationCity: z.string().max(100).optional().nullable(),
    locationPincode: z.string().max(20).optional().nullable(),
    locationMapUrl: z.string().url().optional().nullable().or(z.literal("")),
    locationCoordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional()
      .nullable(),

    organizerId: z.string().uuid("Invalid employee ID").optional().nullable(),

    remindAt: z.string().datetime().optional().nullable(),
    tags: z.array(z.string()).default([]).optional(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),

    // Initial attendees
    attendees: z.array(attendeePayloadSchema).default([]).optional(),
  }),
});

export const updateMeetingSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meeting ID format"),
  }),
  body: z.object({
    leadId: z.string().uuid("Invalid lead ID").optional().nullable(),
    customerId: z.string().uuid("Invalid customer ID").optional().nullable(),
    projectId: z.string().uuid("Invalid project ID").optional().nullable(),

    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    agenda: z.string().max(2000).optional().nullable(),
    type: MeetingTypeEnum.optional(),

    status: MeetingStatusEnum.optional(),

    meetingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    durationMinutes: z.coerce.number().int().positive().optional(),
    timezone: z.string().optional(),

    meetingUrl: z.string().url().optional().nullable().or(z.literal("")),
    meetingProvider: z.string().max(50).optional().nullable(),
    meetingId: z.string().max(100).optional().nullable(),
    meetingPasscode: z.string().max(50).optional().nullable(),

    locationName: z.string().max(150).optional().nullable(),
    locationAddress: z.string().max(500).optional().nullable(),
    locationCity: z.string().max(100).optional().nullable(),
    locationPincode: z.string().max(20).optional().nullable(),
    locationMapUrl: z.string().url().optional().nullable().or(z.literal("")),
    locationCoordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional()
      .nullable(),

    organizerId: z.string().uuid().optional().nullable(),
    remindAt: z.string().datetime().optional().nullable(),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),

    attendees: z.array(attendeePayloadSchema).optional(),
  }),
});

export const updateMeetingStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meeting ID format"),
  }),
  body: z.object({
    status: MeetingStatusEnum,
    cancellationReason: z.string().max(1000).optional().nullable(),
  }),
});

export const rescheduleMeetingSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meeting ID format"),
  }),
  body: z.object({
    meetingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    reason: z.string().max(1000).optional().nullable(),
  }),
});

export const updateMeetingMomSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meeting ID format"),
  }),
  body: z.object({
    minutesOfMeeting: z.string().min(1, "Minutes of meeting is required").max(10000),
    outcomeNotes: z.string().max(2000).optional().nullable(),
    recordingUrl: z.string().url("Invalid recording URL").optional().nullable().or(z.literal("")),
  }),
});

export const addMeetingAttendeeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meeting ID format"),
  }),
  body: attendeePayloadSchema,
});

export const updateMeetingAttendeeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meeting ID format"),
    attendeeId: z.string().uuid("Invalid attendee ID format"),
  }),
  body: z.object({
    role: AttendeeRoleEnum.optional(),
    status: AttendeeStatusEnum.optional(),
    notes: z.string().max(500).optional().nullable(),
  }),
});

export const uploadMeetingDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid meeting ID format"),
  }),
  body: z.object({
    name: z.string().min(1, "Document name is required").max(150),
  }),
});

export const getMeetingsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    type: MeetingTypeEnum.optional(),
    status: MeetingStatusEnum.optional(),
    leadId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    organizerId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    fromStartTime: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toStartTime: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    sortBy: z.enum(["startTime", "meetingDate", "createdAt"]).default("startTime"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export const getMeetingCalendarQuerySchema = z.object({
  query: z.object({
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    organizerId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
  }),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>["body"];
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>["body"];
export type UpdateMeetingStatusInput = z.infer<typeof updateMeetingStatusSchema>["body"];
export type RescheduleMeetingInput = z.infer<typeof rescheduleMeetingSchema>["body"];
export type UpdateMeetingMomInput = z.infer<typeof updateMeetingMomSchema>["body"];
export type AddMeetingAttendeeInput = z.infer<typeof addMeetingAttendeeSchema>["body"];
export type UpdateMeetingAttendeeInput = z.infer<typeof updateMeetingAttendeeSchema>["body"];
export type UploadMeetingDocumentInput = z.infer<typeof uploadMeetingDocumentSchema>["body"];
export type GetMeetingsQueryInput = z.infer<typeof getMeetingsQuerySchema>["query"];
export type GetMeetingCalendarQueryInput = z.infer<typeof getMeetingCalendarQuerySchema>["query"];
