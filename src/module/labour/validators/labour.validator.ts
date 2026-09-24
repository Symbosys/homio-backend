import { z } from "zod";

/**
 * ImageType Schema adhering to Homio CRM Structured Image Storage (Rule 4)
 */
export const imageTypeSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}, z.object({
  id: z.string().optional(),
  url: z.string().url("Valid image URL required"),
  bytes: z.number().nonnegative().optional(),
  format: z.string().optional(),
  provider: z.string().optional(),
}));

/**
 * KYC Document Embed Schema for nested onboarding & update
 */
export const labourKycEmbedSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}, z.object({
  aadhaarNumber: z.string().optional().nullable(),
  aadhaarDoc: imageTypeSchema.optional().nullable(),
  selfiePhoto: imageTypeSchema.optional().nullable(),
  policeClearanceDoc: imageTypeSchema.optional().nullable(),
  policeStationName: z.string().optional().nullable(),
  bankAccountNo: z.string().optional().nullable(),
  ifscCode: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountHolderName: z.string().optional().nullable(),
  upiId: z.string().optional().nullable(),
  tradeTestScore: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number().min(0).max(100).optional().nullable()),
  status: z.string().default("PENDING").optional(),
  verificationNotes: z.string().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
  verifiedBy: z.string().optional().nullable(),
}).optional().nullable());

/**
 * Universal Additional Information Schema (Rule 18)
 */
export const additionalInformationSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}, z.record(z.string(), z.any()).nullable().optional());

/**
 * 1. CREATE LABOUR SCHEMA
 */
export const createLabourSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    phone: z.string().min(10, "Phone number must be at least 10 digits").max(20),
    altPhone: z.string().max(20).optional().nullable().or(z.literal("")),
    email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
    photoUrl: imageTypeSchema.optional().nullable(),

    // Trade & Rates
    trade: z.string().min(2, "Trade is required (e.g. Carpentry, Masonry, Plumbing, Painting)"),
    skillLevel: z.string().default("Skilled").optional().nullable(),
    dailyRate: z.coerce.number().positive("Daily wage rate must be greater than 0"),
    hourlyRate: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? val : num;
    }, z.number().positive("Hourly rate must be positive").optional().nullable()),

    // Address & KYC
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    aadhaarNo: z.string().optional().nullable(),
    aadhaarDoc: imageTypeSchema.optional().nullable(),

    // Bank & Payout Info
    bankName: z.string().optional().nullable(),
    bankAccountNo: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
    upiId: z.string().optional().nullable(),

    // Emergency Contact
    emergencyContact: z.string().optional().nullable(),
    emergencyPhone: z.string().optional().nullable(),

    // Status & Extensibility
    status: z.string().default("ACTIVE").optional(),
    kyc: labourKycEmbedSchema.optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2. UPDATE LABOUR SCHEMA (100% SYMMETRIC WITH CREATE - RULE 19)
 */
export const updateLabourSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid labour ID format"),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().min(10).max(20).optional(),
    altPhone: z.string().max(20).optional().nullable().or(z.literal("")),
    email: z.string().email().optional().nullable().or(z.literal("")),
    photoUrl: imageTypeSchema.optional().nullable(),

    trade: z.string().min(2).optional(),
    skillLevel: z.string().optional().nullable(),
    dailyRate: z.coerce.number().positive().optional(),
    hourlyRate: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? val : num;
    }, z.number().positive().optional().nullable()),

    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    aadhaarNo: z.string().optional().nullable(),
    aadhaarDoc: imageTypeSchema.optional().nullable(),

    bankName: z.string().optional().nullable(),
    bankAccountNo: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
    upiId: z.string().optional().nullable(),

    emergencyContact: z.string().optional().nullable(),
    emergencyPhone: z.string().optional().nullable(),

    status: z.string().optional(),
    kyc: labourKycEmbedSchema.optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 3. GET LABOURS QUERY SCHEMA
 */
export const getLaboursQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    trade: z.string().optional(),
    city: z.string().optional(),
    status: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z.enum(["createdAt", "name", "dailyRate", "trade"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

/**
 * 4. LABOUR ID PARAM SCHEMA
 */
export const labourIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid labour ID format"),
  }),
});

export type CreateLabourInput = z.infer<typeof createLabourSchema>["body"];
export type UpdateLabourInput = z.infer<typeof updateLabourSchema>["body"];
export type GetLaboursQuery = z.infer<typeof getLaboursQuerySchema>["query"];
