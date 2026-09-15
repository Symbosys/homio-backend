import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ message: "Email is required" })
      .email("Invalid email format")
      .trim()
      .toLowerCase(),
    password: z
      .string({ message: "Password is required" })
      .min(1, "Password is required"),
  }),
});

export const updateMeSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1, "First name cannot be empty").optional(),
    lastName: z.string().trim().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    avatarUrl: z.string().url("Invalid avatar URL").nullable().optional(),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type UpdateMeInput = z.infer<typeof updateMeSchema>["body"];
