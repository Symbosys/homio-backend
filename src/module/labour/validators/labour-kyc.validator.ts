import { z } from "zod";
import { imageTypeSchema, additionalInformationSchema } from "./labour.validator.js";

/**
 * KYC Document Upsert Schema
 * Allows updating all identity, bank, and compliance documents
 */
export const upsertLabourKycSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid labour ID format"),
  }),
  body: z.object({
    aadhaarNumber: z.string().optional().nullable(),
    aadhaarDoc: imageTypeSchema.or(z.string()).or(z.any()).optional().nullable(),
    selfiePhoto: imageTypeSchema.or(z.string()).or(z.any()).optional().nullable(),
    policeClearanceDoc: imageTypeSchema.or(z.string()).or(z.any()).optional().nullable(),
    policeStationName: z.string().optional().nullable(),

    // Bank & Payout Details
    bankName: z.string().optional().nullable(),
    bankAccountNo: z.string().optional().nullable(),
    ifscCode: z.string().optional().nullable(),
    accountHolderName: z.string().optional().nullable(),
    upiId: z.string().optional().nullable(),

    // Trade Test & Assessment (Score 0-100)
    tradeTestScore: z.coerce.number().min(0).max(100).optional().nullable(),
    verificationNotes: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * KYC Verification Schema (Supervisor/Admin Review Action)
 */
export const verifyLabourKycSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid labour ID format"),
  }),
  body: z.object({
    status: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
    tradeTestScore: z.coerce.number().min(0).max(100).optional().nullable(),
    verificationNotes: z.string().optional().nullable(),
    rejectionReason: z.string().optional().nullable(),
    verifiedBy: z.string().optional().nullable(),
  }),
});

/**
 * Specific Document Deletion Param Schema
 */
export const deleteKycDocParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid labour ID format"),
    docType: z.enum(["aadhaarDoc", "selfiePhoto", "policeClearanceDoc"]),
  }),
});

export type UpsertLabourKycInput = z.infer<typeof upsertLabourKycSchema>["body"];
export type VerifyLabourKycInput = z.infer<typeof verifyLabourKycSchema>["body"];
