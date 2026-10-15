import { z } from "zod";
import { UserType, UserStatus, LabourStatus } from "../../../types/types.js";

export const LabourStatusEnum = z.nativeEnum(LabourStatus);

/**
 * ImageType Schema adhering to Homio CRM Structured Image Storage (Rule 4)
 */
export const imageTypeSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  },
  z.object({
    id: z.string().optional(),
    url: z.string().url("Valid image URL required"),
    bytes: z.number().nonnegative().optional(),
    format: z.string().optional(),
    provider: z.string().optional(),
  }),
);

/**
 * KYC Document Embed Schema for nested onboarding & update
 */
export const labourKycEmbedSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  },
  z
    .object({
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
    })
    .optional()
    .nullable(),
);

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
    phone: z
      .string()
      .min(10, "Phone number must be at least 10 digits")
      .max(20),
    altPhone: z.string().max(20).optional().nullable().or(z.literal("")),
    email: z
      .string()
      .email("Invalid email format")
      .optional()
      .nullable()
      .or(z.literal("")),
    photoUrl: imageTypeSchema.optional().nullable(),

    // Trade & Rates
    trade: z
      .string()
      .min(
        2,
        "Trade is required (e.g. Carpentry, Masonry, Plumbing, Painting)",
      ),
    skillLevel: z.string().default("Skilled").optional().nullable(),
    dailyRate: z.coerce
      .number()
      .positive("Daily wage rate must be greater than 0"),
    hourlyRate: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? val : num;
    }, z.number().positive("Hourly rate must be positive").optional().nullable()),

    // Address & KYC
    address: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    locality: z.string().optional().nullable(),
    pincode: z.string().max(20).optional().nullable(),
    isAvailable: z.boolean().default(true).optional(),
    isKycVerified: z.boolean().default(false).optional(),
    aadhaarNo: z.string().optional().nullable(),
    aadhaarDoc: imageTypeSchema.optional().nullable(),

    // Bank & Payout Info
    bankName: z.string().optional().nullable(),
    bankAccountNo: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
    upiId: z.string().optional().nullable(),

    // Optional link to existing User account
    userId: z.string().uuid("Invalid user ID format").nullable().optional(),

    // User Account & Credentials for Onboarding / Login Access (SaaS RBAC)
    createUserAccount: z
      .union([
        z.boolean(),
        z.string().transform((v) => v === "true" || v === "1"),
      ])
      .optional(),
    userEmail: z
      .string()
      .trim()
      .email("Invalid user login email")
      .nullable()
      .optional()
      .or(z.literal("")),
    userPhone: z
      .string()
      .trim()
      .max(20)
      .nullable()
      .optional()
      .or(z.literal("")),
    userPassword: z
      .string()
      .trim()
      .min(6, "Password must be at least 6 characters")
      .nullable()
      .optional()
      .or(z.literal("")),
    userRoleIds: z
      .union([
        z.array(z.string().uuid("Invalid role ID")),
        z.string().transform((val) => {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [val];
          } catch {
            return val
              ? val
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
          }
        }),
      ])
      .optional(),
    userStatus: z.nativeEnum(UserStatus).optional(),
    userType: z.nativeEnum(UserType).default(UserType.LABOUR).optional(),

    // Emergency Contact
    emergencyContact: z.string().optional().nullable(),
    emergencyPhone: z.string().optional().nullable(),

    // Status & Extensibility
    status: LabourStatusEnum.default(LabourStatus.PENDING).optional(),
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
    state: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    locality: z.string().optional().nullable(),
    pincode: z.string().max(20).optional().nullable(),
    isAvailable: z.boolean().optional(),
    isKycVerified: z.boolean().optional(),
    aadhaarNo: z.string().optional().nullable(),
    aadhaarDoc: imageTypeSchema.optional().nullable(),

    bankName: z.string().optional().nullable(),
    bankAccountNo: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
    upiId: z.string().optional().nullable(),

    // Optional link to existing User account
    userId: z.string().uuid("Invalid user ID format").nullable().optional(),

    // User Account & Credentials for Onboarding / Login Access (SaaS RBAC)
    createUserAccount: z
      .union([
        z.boolean(),
        z.string().transform((v) => v === "true" || v === "1"),
      ])
      .optional(),
    userEmail: z
      .string()
      .trim()
      .email("Invalid user login email")
      .nullable()
      .optional()
      .or(z.literal("")),
    userPhone: z
      .string()
      .trim()
      .max(20)
      .nullable()
      .optional()
      .or(z.literal("")),
    userPassword: z
      .string()
      .trim()
      .min(6, "Password must be at least 6 characters")
      .nullable()
      .optional()
      .or(z.literal("")),
    userRoleIds: z
      .union([
        z.array(z.string().uuid("Invalid role ID")),
        z.string().transform((val) => {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [val];
          } catch {
            return val
              ? val
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];
          }
        }),
      ])
      .optional(),
    userStatus: z.nativeEnum(UserStatus).optional(),
    userType: z.nativeEnum(UserType).optional(),

    emergencyContact: z.string().optional().nullable(),
    emergencyPhone: z.string().optional().nullable(),

    status: LabourStatusEnum.optional(),
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
    state: z.string().optional(),
    city: z.string().optional(),
    locality: z.string().optional(),
    status: LabourStatusEnum.optional(),
    isKycVerified: z
      .union([
        z.boolean(),
        z.string().transform((v) => v === "true" || v === "1"),
      ])
      .optional(),
    isAvailable: z
      .union([
        z.boolean(),
        z.string().transform((v) => v === "true" || v === "1"),
      ])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z
      .enum(["createdAt", "name", "dailyRate", "trade", "averageRating"])
      .default("createdAt"),
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

/**
 * 5. PLATFORM GET LABOURS QUERY SCHEMA
 */
export const platformGetLaboursQuerySchema = z.object({
  query: z.object({
    scope: z
      .enum(["ALL", "PLATFORM_ONLY", "ORG_ONLY"])
      .default("ALL")
      .optional(),
    organizationId: z.preprocess((val) => {
      if (val === "" || val === "null" || val === "undefined" || val === null)
        return undefined;
      return val;
    }, z.string().uuid("Invalid organization ID format").optional()),
    search: z.string().optional(),
    trade: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    locality: z.string().optional(),
    status: LabourStatusEnum.optional(),
    isKycVerified: z
      .union([
        z.boolean(),
        z.string().transform((v) => v === "true" || v === "1"),
      ])
      .optional(),
    isAvailable: z
      .union([
        z.boolean(),
        z.string().transform((v) => v === "true" || v === "1"),
      ])
      .optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    sortBy: z
      .enum(["createdAt", "name", "dailyRate", "trade", "averageRating"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

/**
 * 6. PLATFORM CREATE LABOUR SCHEMA
 */
export const platformCreateLabourSchema = z.object({
  body: createLabourSchema.shape.body.extend({
    organizationId: z.preprocess((val) => {
      if (val === "" || val === "null" || val === "undefined" || val === null)
        return null;
      return val;
    }, z.string().uuid("Invalid organization ID format").nullable().optional()),
  }),
});

export type PlatformGetLaboursQuery = z.infer<
  typeof platformGetLaboursQuerySchema
>["query"];
export type PlatformCreateLabourInput = z.infer<
  typeof platformCreateLabourSchema
>["body"];

/**
 * 7. PUBLIC LABOUR SELF-REGISTRATION SCHEMA
 */
export const registerLabourSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    phone: z
      .string()
      .min(10, "Phone number must be at least 10 digits")
      .max(20),
    altPhone: z.string().max(20).optional().nullable().or(z.literal("")),
    email: z
      .string()
      .email("Invalid email format")
      .optional()
      .nullable()
      .or(z.literal("")),
    password: z.string().min(6, "Password must be at least 6 characters"),
    photoUrl: imageTypeSchema.optional().nullable(),

    // Trade & Rates
    trade: z
      .string()
      .min(2, "Trade is required (e.g. Carpentry, Masonry, Plumbing, Painting)"),
    skillLevel: z.string().default("Skilled").optional().nullable(),
    dailyRate: z.coerce
      .number()
      .positive("Daily wage rate must be greater than 0"),
    hourlyRate: z.preprocess((val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? val : num;
    }, z.number().positive("Hourly rate must be positive").optional().nullable()),

    // Address & Location
    address: z.string().optional().nullable(),
    state: z.string().min(2, "State is required"),
    city: z.string().min(2, "City is required"),
    locality: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),

    // Identity & KYC Details
    aadhaarNo: z.string().optional().nullable(),
    aadhaarDoc: imageTypeSchema.optional().nullable(),
    selfiePhoto: imageTypeSchema.optional().nullable(),
    policeClearanceDoc: imageTypeSchema.optional().nullable(),
    policeStationName: z.string().optional().nullable(),

    // Bank & Settlement Info
    bankName: z.string().optional().nullable(),
    bankAccountNo: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
    accountHolderName: z.string().optional().nullable(),
    upiId: z.string().optional().nullable(),

    // Emergency Contact
    emergencyContact: z.string().optional().nullable(),
    emergencyPhone: z.string().optional().nullable(),

    additionalInformation: additionalInformationSchema,
  }),
});

export type RegisterLabourInput = z.infer<typeof registerLabourSchema>["body"];

/**
 * 8. PLATFORM APPROVE LABOUR SCHEMA
 */
export const approveLabourSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid labour ID format"),
  }),
  body: z.object({
    status: LabourStatusEnum.default(LabourStatus.AVAILABLE).optional(),
    tradeTestScore: z.number().min(0).max(100).optional().nullable(),
    verificationNotes: z.string().max(2000).optional().nullable(),
  }),
});

export type ApproveLabourInput = z.infer<typeof approveLabourSchema>["body"];

/**
 * 9. PLATFORM REJECT LABOUR SCHEMA
 */
export const rejectLabourSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid labour ID format"),
  }),
  body: z.object({
    rejectionReason: z
      .string()
      .min(3, "Rejection reason must be at least 3 characters")
      .max(1000),
    verificationNotes: z.string().max(2000).optional().nullable(),
  }),
});

export type RejectLabourInput = z.infer<typeof rejectLabourSchema>["body"];

/**
 * 10. UPDATE MY LABOUR PROFILE SCHEMA (Worker Self-Service & Unified KYC Edit)
 */
export const updateMyLabourProfileSchema = z.object({
  body: z.object({
    // Personal Info
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    altPhone: z.string().optional().nullable(),
    email: z.string().email("Invalid email format").optional().nullable(),
    emergencyContact: z.string().optional().nullable(),
    emergencyPhone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    locality: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),

    // Trade & Rates
    trade: z.string().min(2).optional(),
    skillLevel: z.string().optional().nullable(),
    dailyRate: z.coerce.number().positive("Daily rate must be positive").optional(),
    hourlyRate: z.coerce.number().positive("Hourly rate must be positive").optional().nullable(),
    isAvailable: z.preprocess((val) => {
      if (typeof val === "string") return val === "true";
      return val;
    }, z.boolean().optional()),

    // KYC & Bank Details
    aadhaarNo: z.string().optional().nullable(),
    policeStationName: z.string().optional().nullable(),
    bankName: z.string().optional().nullable(),
    bankAccountNo: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
    accountHolderName: z.string().optional().nullable(),
    upiId: z.string().optional().nullable(),

    // Structured JSON Image fallbacks
    photoUrl: imageTypeSchema.optional().nullable(),
    aadhaarDoc: imageTypeSchema.optional().nullable(),
    selfiePhoto: imageTypeSchema.optional().nullable(),
    policeClearanceDoc: imageTypeSchema.optional().nullable(),

    // Universal Additional Information (Rule 18)
    additionalInformation: additionalInformationSchema,
  }),
});

export type UpdateMyLabourProfileInput = z.infer<typeof updateMyLabourProfileSchema>["body"];
