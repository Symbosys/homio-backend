import { z } from "zod";
import { marketplaceTypeEnum } from "./category.validator.js";

export const registerSellerCategorySchema = z.object({
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format"),
  }),
});

/**
 * Validator schema for platform admin manually updating organization category commission rate
 */
export const updateSellerCategoryCommissionSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid seller category assignment ID"),
  }),
  body: z.object({
    commissionRate: z
      .number({ message: "Commission rate must be a number" })
      .min(0, "Commission rate must be at least 0%")
      .max(100, "Commission rate cannot exceed 100%"),
  }),
});

export const getSellerCategoriesQuerySchema = z.object({
  query: z.object({
    marketplaceType: marketplaceTypeEnum.optional(),
    isApproved: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    isActive: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  }),
});

export const sellerCategoryIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid seller category ID"),
  }),
});
