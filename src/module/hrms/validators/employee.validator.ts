import { z } from "zod";

const imageTypeSchema = z.object({
  id: z.string(),
  url: z.string(),
  bytes: z.number(),
  format: z.string(),
  provider: z.enum(["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"]),
});

export const genderEnum = z.enum(["MALE", "FEMALE", "NON_BINARY", "OTHER", "PREFER_NOT_TO_SAY"]);
export const maritalStatusEnum = z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]);
export const bloodGroupEnum = z.enum([
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
]);
export const employmentTypeEnum = z.enum([
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERN",
  "PROBATIONARY",
  "FREELANCE",
  "TEMPORARY",
]);
export const employmentStatusEnum = z.enum([
  "PROBATION",
  "ACTIVE",
  "NOTICE_PERIOD",
  "RESIGNED",
  "TERMINATED",
  "RETIRED",
  "SUSPENDED",
  "ON_LEAVE",
]);
export const taxRegimeEnum = z.enum(["OLD", "NEW"]);
export const departmentMemberRoleEnum = z.enum([
  "MEMBER",
  "TEAM_LEAD",
  "HEAD_OF_DEPARTMENT",
  "DEPUTY_LEAD",
  "COORDINATOR",
  "CONSULTANT",
  "INTERN",
]);

export const createEmployeeSchema = z.object({
  body: z.object({
    // Optional link to User account
    userId: z.string().uuid("Invalid user ID format").nullable().optional(),

    // Employee Identification
    employeeCode: z.string().trim().min(1, "Employee code cannot be empty").optional(), // Auto-generated if omitted
    firstName: z.string({ message: "First name is required" }).trim().min(1, "First name cannot be empty"),
    middleName: z.string().trim().nullable().optional(),
    lastName: z.string().trim().nullable().optional(),
    displayName: z.string().trim().nullable().optional(),
    avatarUrl: z.union([z.string().trim().url(), imageTypeSchema]).nullable().optional(),

    gender: genderEnum.nullable().optional(),
    dateOfBirth: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
    maritalStatus: maritalStatusEnum.nullable().optional(),
    bloodGroup: bloodGroupEnum.nullable().optional(),

    // Contacts
    workEmail: z.string().trim().email("Invalid work email").nullable().optional(),
    personalEmail: z.string().trim().email("Invalid personal email").nullable().optional(),
    workPhone: z.string().trim().nullable().optional(),
    personalPhone: z.string().trim().nullable().optional(),

    // Emergency Contact
    emergencyContactName: z.string().trim().nullable().optional(),
    emergencyContactRelationship: z.string().trim().nullable().optional(),
    emergencyContactPhone: z.string().trim().nullable().optional(),

    // Residential Addresses
    currentAddress: z.string().trim().nullable().optional(),
    currentCity: z.string().trim().nullable().optional(),
    currentState: z.string().trim().nullable().optional(),
    currentCountry: z.string().trim().default("IN"),
    currentPincode: z.string().trim().nullable().optional(),

    permanentAddress: z.string().trim().nullable().optional(),
    permanentCity: z.string().trim().nullable().optional(),
    permanentState: z.string().trim().nullable().optional(),
    permanentCountry: z.string().trim().default("IN"),
    permanentPincode: z.string().trim().nullable().optional(),

    // Employment details
    employmentType: employmentTypeEnum.default("FULL_TIME"),
    employmentStatus: employmentStatusEnum.default("ACTIVE"),
    designation: z.string({ message: "Designation is required" }).trim().min(1, "Designation cannot be empty"),
    workLocation: z.string().trim().nullable().optional(),
    reportingManagerId: z.string().uuid("Invalid manager ID format").nullable().optional(),

    // Department & Team Assignment
    departmentId: z.string().uuid("Invalid department ID format").nullable().optional(),
    teamId: z.string().uuid("Invalid team ID format").nullable().optional(),
    departmentRole: departmentMemberRoleEnum.default("MEMBER").optional(),

    // Dates
    joiningDate: z.string({ message: "Joining date is required" }),
    probationEndDate: z.string().nullable().optional(),
    confirmationDate: z.string().nullable().optional(),
    noticePeriodDays: z.coerce.number().int().min(0).default(30),

    // Statutory & Compliance
    panNumber: z.string().trim().toUpperCase().nullable().optional(),
    aadhaarNumber: z.string().trim().nullable().optional(),
    uanNumber: z.string().trim().nullable().optional(),
    pfNumber: z.string().trim().nullable().optional(),
    esiNumber: z.string().trim().nullable().optional(),
    passportNumber: z.string().trim().nullable().optional(),
    taxRegime: taxRegimeEnum.default("NEW"),

    // Bank Details
    bankAccountHolderName: z.string().trim().nullable().optional(),
    bankAccountNumber: z.string().trim().nullable().optional(),
    bankName: z.string().trim().nullable().optional(),
    bankIfscCode: z.string().trim().toUpperCase().nullable().optional(),
    bankBranchName: z.string().trim().nullable().optional(),

    // Documents
    documents: z.array(z.any()).nullable().optional(),
  }),
});

export const updateEmployeeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid employee ID"),
  }),
  body: createEmployeeSchema.shape.body.partial().extend({
    resignationDate: z.string().nullable().optional(),
    noticePeriodEndDate: z.string().nullable().optional(),
    relievingDate: z.string().nullable().optional(),
    terminationDate: z.string().nullable().optional(),
    terminationReason: z.string().trim().nullable().optional(),
  }),
});

export const employeeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid employee ID format"),
  }),
});

export const getEmployeesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    status: employmentStatusEnum.optional(),
    employmentType: employmentTypeEnum.optional(),
    reportingManagerId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
    sortBy: z.enum(["createdAt", "joiningDate", "firstName", "employeeCode"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>["body"];
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>["body"];
export type GetEmployeesQueryInput = z.infer<typeof getEmployeesQuerySchema>["query"];
