import { z } from "zod";
import { RateCardTierType, QuotationItemCategory } from "../../../types/types.js";

/**
 * Zod NativeEnums for Rate Card Tiers and Item Categories
 */
export const RateCardTierTypeEnum = z.nativeEnum(RateCardTierType);
export const QuotationItemCategoryEnum = z.nativeEnum(QuotationItemCategory);

/**
 * URL parameter schema for Rate Card ID
 */
export const rateCardIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Rate Card ID format"),
  }),
});

/**
 * Category-specific markup override record (e.g. { "CIVIL": 20, "CARPENTRY": 30 })
 */
export const categoryMarkupsSchema = z.record(z.string(), z.coerce.number().min(0).max(500)).optional().nullable();

/**
 * Validator schema for creating a Quotation Rate Card
 */
export const createRateCardSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Rate card name is required").max(150, "Name cannot exceed 150 characters"),
    code: z.string().min(1, "Rate card code is required").max(50, "Code cannot exceed 50 characters"),
    tierType: RateCardTierTypeEnum.default(RateCardTierType.STANDARD),
    description: z.string().optional().nullable(),
    defaultMarkupPercent: z.coerce.number().min(0, "Default markup cannot be negative").max(500, "Markup cannot exceed 500%").default(25),
    categoryMarkups: categoryMarkupsSchema,
    applicableCategories: z.array(QuotationItemCategoryEnum).optional().default([]),
    isDefault: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.coerce.number().int().optional().default(0),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for updating a Quotation Rate Card (Dirty/Partial updates)
 */
export const updateRateCardSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Rate Card ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    code: z.string().min(1).max(50).optional(),
    tierType: RateCardTierTypeEnum.optional(),
    description: z.string().optional().nullable(),
    defaultMarkupPercent: z.coerce.number().min(0).max(500).optional(),
    categoryMarkups: categoryMarkupsSchema,
    applicableCategories: z.array(QuotationItemCategoryEnum).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for listing non-paginated rate cards
 */
export const getRateCardsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    tierType: RateCardTierTypeEnum.optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      }),
  }),
});

/**
 * Validator schema for reordering rate cards
 */
export const reorderRateCardsSchema = z.object({
  body: z.object({
    orders: z.array(
      z.object({
        id: z.string().uuid("Invalid Rate Card ID format"),
        sortOrder: z.coerce.number().int().nonnegative(),
      })
    ).min(1, "At least one rate card order is required"),
  }),
});

export type CreateRateCardInput = z.infer<typeof createRateCardSchema>["body"];
export type UpdateRateCardInput = z.infer<typeof updateRateCardSchema>["body"];
export type GetRateCardsQueryInput = z.infer<typeof getRateCardsQuerySchema>["query"];
export type ReorderRateCardsInput = z.infer<typeof reorderRateCardsSchema>["body"];
