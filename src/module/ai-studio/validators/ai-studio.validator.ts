import { z } from "zod";
import {
  AiServiceType,
  AiTransactionType,
} from "../../../types/types.js";

/**
 * Zod Schema for Creating Top-Up Credit Packs
 */
export const CreateCreditPackSchema = z.object({
  name: z.string().min(2, "Name must have at least 2 characters").max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug must contain lowercase letters, numbers, and hyphens"),
  credits: z.number().int().positive("Base credits must be a positive integer"),
  bonusCredits: z.number().int().nonnegative("Bonus credits cannot be negative").default(0),
  price: z.number().positive("Price must be a positive number"),
  currency: z.string().default("INR"),
  discountPercentage: z.number().min(0).max(100).default(0),
  isPopular: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type CreateCreditPackInput = z.infer<typeof CreateCreditPackSchema>;

/**
 * Zod Schema for Updating Top-Up Credit Packs
 */
export const UpdateCreditPackSchema = CreateCreditPackSchema.partial();
export type UpdateCreditPackInput = z.infer<typeof UpdateCreditPackSchema>;

/**
 * Zod Schema for Updating AI Feature Pricing & Rates
 */
export const UpdateServiceRateSchema = z.object({
  serviceType: z.nativeEnum(AiServiceType),
  name: z.string().min(2).max(100).optional(),
  defaultCreditCost: z.number().int().nonnegative("Credit cost must be 0 or a positive integer"),
  billingUnit: z.string().min(1).max(50).default("per render"),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type UpdateServiceRateInput = z.infer<typeof UpdateServiceRateSchema>;

/**
 * Zod Schema for Organization Wallet Recharge by Platform Admin
 */
export const RechargeOrgWalletSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  creditPackId: z.string().uuid("Invalid credit pack ID").optional().nullable(),
  customCredits: z.number().int().positive("Custom credits must be positive").optional().nullable(),
  transactionType: z.nativeEnum(AiTransactionType).default(AiTransactionType.PACK_PURCHASE),
  amountPaid: z.number().nonnegative().optional().nullable(),
  currency: z.string().default("INR"),
  paymentGatewayRef: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  description: z.string().min(3, "Description must have at least 3 characters").max(255),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
}).refine((data) => data.creditPackId || data.customCredits, {
  message: "Either a creditPackId or customCredits must be provided to recharge wallet",
  path: ["creditPackId"],
});

export type RechargeOrgWalletInput = z.infer<typeof RechargeOrgWalletSchema>;

/**
 * Zod Schema for Querying Wallets
 */
export const GetOrgWalletsQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["name", "currentBalance", "lifetimeCreditsConsumed", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type GetOrgWalletsQuery = z.infer<typeof GetOrgWalletsQuerySchema>;
