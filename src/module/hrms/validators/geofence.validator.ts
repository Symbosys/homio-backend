import { z } from "zod";

export const geofenceStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

export const createGeofenceSchema = z.object({
  body: z.object({
    name: z.string({ message: "Geofence name is required" }).trim().min(1, "Name cannot be empty").max(120),
    code: z.string().trim().min(1).max(30).toUpperCase().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    latitude: z.coerce.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
    longitude: z.coerce.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
    radiusMeters: z.coerce.number().int().min(10, "Radius must be at least 10 meters").max(100000, "Radius cannot exceed 100,000 meters").default(100),
    status: geofenceStatusEnum.default("ACTIVE").optional(),
  }),
});

export const updateGeofenceSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid geofence ID format"),
  }),
  body: createGeofenceSchema.shape.body.partial(),
});

export const geofenceIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid geofence ID format"),
  }),
});

export const getGeofencesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    status: geofenceStatusEnum.optional(),
    sortBy: z.enum(["createdAt", "name", "code", "radiusMeters"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const assignEmployeesToGeofenceSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid geofence ID format"),
  }),
  body: z.object({
    employeeIds: z.array(z.string().uuid("Invalid employee ID")).min(1, "At least one employee ID is required"),
    action: z.enum(["ASSIGN", "UNASSIGN"]).default("ASSIGN"),
  }),
});

export const employeeGeofencesParamSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid("Invalid employee ID format"),
  }),
});

export type CreateGeofenceInput = z.infer<typeof createGeofenceSchema>["body"];
export type UpdateGeofenceInput = z.infer<typeof updateGeofenceSchema>["body"];
export type GetGeofencesQueryInput = z.infer<typeof getGeofencesQuerySchema>["query"];
export type AssignEmployeesToGeofenceInput = z.infer<typeof assignEmployeesToGeofenceSchema>["body"];
