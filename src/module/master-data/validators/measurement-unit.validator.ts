import { z } from "zod";

// ==========================================
// MEASUREMENT UNIT ENUMS
// ==========================================

export const MeasurementUnitTypeEnum = z.enum([
  "AREA",
  "LENGTH",
  "VOLUME",
  "WEIGHT",
  "QUANTITY",
  "TIME",
]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const measurementUnitIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid measurement unit ID format"),
  }),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const createMeasurementUnitSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    symbol: z.string().min(1, "Symbol is required").max(20),
    code: z.string().max(50).optional().nullable(),
    type: MeasurementUnitTypeEnum.default("QUANTITY"),
    description: z.string().max(2000).optional().nullable(),

    precision: z.coerce.number().int().min(0).max(6).default(2),
    conversionFactor: z.coerce.number().positive().default(1.0).optional().nullable(),
    baseUnitSymbol: z.string().max(20).optional().nullable(),

    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateMeasurementUnitSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid measurement unit ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    symbol: z.string().min(1).max(20).optional(),
    code: z.string().max(50).optional().nullable(),
    type: MeasurementUnitTypeEnum.optional(),
    description: z.string().max(2000).optional().nullable(),

    precision: z.coerce.number().int().min(0).max(6).optional(),
    conversionFactor: z.coerce.number().positive().optional().nullable(),
    baseUnitSymbol: z.string().max(20).optional().nullable(),

    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

// ==========================================
// QUERY SCHEMA
// ==========================================

export const getMeasurementUnitsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().optional(),
    type: MeasurementUnitTypeEnum.optional(),
    isActive: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  }),
});

export type CreateMeasurementUnitInput = z.infer<typeof createMeasurementUnitSchema>["body"];
export type UpdateMeasurementUnitInput = z.infer<typeof updateMeasurementUnitSchema>["body"];
export type GetMeasurementUnitsQuery = z.infer<typeof getMeasurementUnitsQuerySchema>["query"];
