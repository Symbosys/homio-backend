import { z } from "zod";

export const createVendorSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Vendor name is required"),
    code: z.string().trim().optional().nullable(),
    contactPerson: z.string().trim().optional().nullable(),
    email: z.string().trim().email("Invalid email format").optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    address: z.string().trim().optional().nullable(),
    city: z.string().trim().optional().nullable(),
    state: z.string().trim().optional().nullable(),
    pincode: z.string().trim().optional().nullable(),
    gstin: z.string().trim().optional().nullable(),
    defaultCommissionRate: z.number().min(0).max(100).optional().nullable(),
    isActive: z.boolean().optional().default(true),
  }),
});

export const updateVendorSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid vendor ID format"),
  }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
    code: z.string().trim().optional().nullable(),
    contactPerson: z.string().trim().optional().nullable(),
    email: z.string().trim().email("Invalid email format").optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    address: z.string().trim().optional().nullable(),
    city: z.string().trim().optional().nullable(),
    state: z.string().trim().optional().nullable(),
    pincode: z.string().trim().optional().nullable(),
    gstin: z.string().trim().optional().nullable(),
    defaultCommissionRate: z.number().min(0).max(100).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const getVendorsQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
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

export const vendorIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid vendor ID format"),
  }),
});
