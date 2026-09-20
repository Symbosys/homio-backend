import { z } from "zod";

export const travelStatusEnum = z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

const dateStringSchema = z
  .string({ message: "Date is required" })
  .transform((val) => (val && typeof val === "string" && val.includes("T") ? val.split("T")[0] : val))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"));

const optionalDateStringSchema = z
  .string()
  .optional()
  .transform((val) => (val && typeof val === "string" && val.includes("T") ? val.split("T")[0] : val))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional());

export const createTravelSchema = z.object({
  body: z.object({
    title: z.string({ message: "Travel title is required" }).trim().min(1, "Title cannot be empty").max(150),
    code: z.string().trim().min(1).max(30).toUpperCase().nullable().optional(),
    purpose: z.string().trim().nullable().optional(),
    destination: z.string({ message: "Destination is required" }).trim().min(1, "Destination cannot be empty").max(150),
    origin: z.string().trim().nullable().optional(),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    estimatedBudget: z.coerce.number().min(0, "Budget cannot be negative").nullable().optional(),
    currency: z.string().trim().default("INR").optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
    status: travelStatusEnum.default("PLANNED").optional(),
    employeeIds: z
      .union([
        z.array(z.string().uuid("Invalid employee ID")),
        z.string().transform((val) => {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [val];
          } catch {
            return val ? [val] : [];
          }
        }),
      ])
      .optional(),
  }),
});

export const updateTravelSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid travel ID format"),
  }),
  body: z.object({
    title: z.string().trim().min(1).max(150).optional(),
    code: z.string().trim().min(1).max(30).toUpperCase().nullable().optional(),
    purpose: z.string().trim().nullable().optional(),
    destination: z.string().trim().min(1).max(150).optional(),
    origin: z.string().trim().nullable().optional(),
    startDate: optionalDateStringSchema,
    endDate: optionalDateStringSchema,
    estimatedBudget: z.coerce.number().min(0).nullable().optional(),
    actualExpenses: z.coerce.number().min(0).nullable().optional(),
    currency: z.string().trim().optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
    status: travelStatusEnum.optional(),
  }),
});

export const travelIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid travel ID format"),
  }),
});

export const getTravelsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    status: travelStatusEnum.optional(),
    destination: z.string().trim().optional(),
    startDate: optionalDateStringSchema,
    endDate: optionalDateStringSchema,
    employeeId: z.string().uuid("Invalid employee ID").optional(),
    sortBy: z.enum(["startDate", "endDate", "createdAt", "title"]).default("startDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const assignEmployeesToTravelSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid travel ID format"),
  }),
  body: z.object({
    employeeIds: z.array(z.string().uuid("Invalid employee ID")).min(1, "At least one employee ID is required"),
    action: z.enum(["ASSIGN", "UNASSIGN"]).default("ASSIGN"),
  }),
});

export const updateTravelExpensesSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid travel ID format"),
  }),
  body: z.object({
    actualExpenses: z.coerce.number().min(0, "Expenses cannot be negative"),
    currency: z.string().trim().default("INR").optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
  }),
});

export const updateTravelStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid travel ID format"),
  }),
  body: z.object({
    status: travelStatusEnum,
    remarks: z.string().trim().max(500).nullable().optional(),
  }),
});

export type CreateTravelInput = z.infer<typeof createTravelSchema>["body"];
export type UpdateTravelInput = z.infer<typeof updateTravelSchema>["body"];
export type GetTravelsQueryInput = z.infer<typeof getTravelsQuerySchema>["query"];
export type AssignEmployeesToTravelInput = z.infer<typeof assignEmployeesToTravelSchema>["body"];
export type UpdateTravelExpensesInput = z.infer<typeof updateTravelExpensesSchema>["body"];
export type UpdateTravelStatusInput = z.infer<typeof updateTravelStatusSchema>["body"];
