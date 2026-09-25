import { z } from "zod";

export const ChannelPartnerStatusEnum = z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED"]);
export const CommissionTypeEnum = z.enum(["PERCENTAGE", "FIXED_AMOUNT"]);
export const KYCStatusEnum = z.enum(["PENDING", "VERIFIED", "REJECTED"]);

export const cpIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Channel Partner ID format"),
  }),
});

export const bankDetailsSchema = z
  .object({
    accountHolderName: z.string().max(150).optional(),
    bankName: z.string().max(150).optional(),
    accountNumber: z.string().max(50).optional(),
    ifscCode: z.string().max(20).optional(),
    branch: z.string().max(100).optional(),
    upiId: z.string().max(100).optional(),
  })
  .optional()
  .nullable();

export const kycDetailsSchema = z
  .object({
    documentType: z.string().max(50).optional(),
    documentUrl: z.record(z.string(), z.any()).optional().nullable(),
    verifiedAt: z.string().datetime().optional().nullable(),
    verifiedBy: z.string().uuid().optional().nullable(),
    remarks: z.string().max(1000).optional().nullable(),
  })
  .optional()
  .nullable();

export const createChannelPartnerSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Partner contact name is required").max(150),
    companyName: z.string().max(150).optional().nullable(),
    partnerType: z.string().max(100).optional().nullable(),
    phone: z.string().min(5, "Valid phone number is required").max(20),
    alternatePhone: z.string().max(20).optional().nullable().or(z.literal("")),
    email: z.string().email("Invalid email address format").optional().nullable().or(z.literal("")),
    address: z.string().max(500).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    pincode: z.string().max(20).optional().nullable(),

    defaultCommissionType: CommissionTypeEnum.default("PERCENTAGE").optional(),
    defaultCommissionValue: z.coerce.number().nonnegative().optional().nullable(),

    bankDetails: bankDetailsSchema,

    panNumber: z.string().max(20).optional().nullable(),
    gstNumber: z.string().max(30).optional().nullable(),
    aadhaarNumber: z.string().max(20).optional().nullable(),
    kycStatus: KYCStatusEnum.default("PENDING").optional(),
    kycDetails: kycDetailsSchema,

    status: ChannelPartnerStatusEnum.default("ACTIVE").optional(),
    notes: z.string().max(3000).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateChannelPartnerSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Channel Partner ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    companyName: z.string().max(150).optional().nullable(),
    partnerType: z.string().max(100).optional().nullable(),
    phone: z.string().min(5).max(20).optional(),
    alternatePhone: z.string().max(20).optional().nullable().or(z.literal("")),
    email: z.string().email().optional().nullable().or(z.literal("")),
    address: z.string().max(500).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    pincode: z.string().max(20).optional().nullable(),

    defaultCommissionType: CommissionTypeEnum.optional(),
    defaultCommissionValue: z.coerce.number().nonnegative().optional().nullable(),

    bankDetails: bankDetailsSchema,

    panNumber: z.string().max(20).optional().nullable(),
    gstNumber: z.string().max(30).optional().nullable(),
    aadhaarNumber: z.string().max(20).optional().nullable(),
    kycStatus: KYCStatusEnum.optional(),
    kycDetails: kycDetailsSchema,

    // Integrated Status update directly on PATCH /:id
    status: ChannelPartnerStatusEnum.optional(),
    notes: z.string().max(3000).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const getChannelPartnersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    status: ChannelPartnerStatusEnum.optional(),
    kycStatus: KYCStatusEnum.optional(),
    partnerType: z.string().optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "name", "partnerCode", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export type CreateChannelPartnerInput = z.infer<typeof createChannelPartnerSchema>["body"];
export type UpdateChannelPartnerInput = z.infer<typeof updateChannelPartnerSchema>["body"];
export type GetChannelPartnersQueryInput = z.infer<typeof getChannelPartnersQuerySchema>["query"];
