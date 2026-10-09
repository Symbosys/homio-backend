import { z } from "zod";
import { OtpType } from "../../../types/types.js";

export const OtpTypeEnum = z.nativeEnum(OtpType);

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

export const sendOtpSchema = z.object({
  body: z.object({
    identifier: z
      .string({ message: "Phone number or Email is required" })
      .trim()
      .min(3, "Identifier must be at least 3 characters"),
    type: OtpTypeEnum.optional(),
    purpose: z.string().trim().default("LOGIN").optional(),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    identifier: z
      .string({ message: "Phone number or Email is required" })
      .trim()
      .min(3, "Identifier must be at least 3 characters"),
    otp: z
      .string({ message: "OTP code is required" })
      .trim()
      .min(4, "OTP must be at least 4 digits")
      .max(10, "OTP cannot exceed 10 digits"),
    type: OtpTypeEnum.optional(),
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
export type SendOtpInput = z.infer<typeof sendOtpSchema>["body"];
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>["body"];
export type UpdateMeInput = z.infer<typeof updateMeSchema>["body"];
