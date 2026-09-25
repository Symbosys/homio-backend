import { z } from "zod";

export const ChannelPartnerPayoutStatusEnum = z.enum(["PENDING", "COMPLETED", "FAILED", "REVERSED"]);
export const PaymentModeEnum = z.enum(["BANK_TRANSFER", "UPI", "CHEQUE", "NEFT", "RTGS", "CASH", "OTHER"]);

export const payoutIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Payout ID format"),
  }),
});

export const createCPPayoutSchema = z.object({
  body: z.object({
    channelPartnerId: z.string().uuid("Valid Channel Partner ID is required"),
    leadId: z.string().uuid("Invalid Lead ID format").optional().nullable(),
    cpLeadId: z.string().uuid("Invalid CP Lead ID format").optional().nullable(),
    amount: z.coerce.number().positive("Payout amount must be greater than zero"),
    paymentMode: z.string().min(1, "Payment mode is required"),
    transactionReference: z.string().max(150).optional().nullable(),
    status: ChannelPartnerPayoutStatusEnum.default("COMPLETED").optional(),
    paymentDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    remarks: z.string().max(2000).optional().nullable(),
    receiptUrl: z.record(z.string(), z.any()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const getCPPayoutsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    channelPartnerId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    paymentMode: z.string().optional(),
    status: ChannelPartnerPayoutStatusEnum.optional(),
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    sortBy: z.enum(["paymentDate", "amount", "createdAt"]).default("paymentDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export type CreateCPPayoutInput = z.infer<typeof createCPPayoutSchema>["body"];
export type GetCPPayoutsQueryInput = z.infer<typeof getCPPayoutsQuerySchema>["query"];
