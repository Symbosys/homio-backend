import { describe, it, expect } from "bun:test";
import {
  createCPPayoutSchema,
  getCPPayoutsQuerySchema,
  payoutIdParamSchema,
} from "../../src/module/channel-partner/validators/channel-partner-payout.validator.js";
import {
  MOCK_PARTNER_ID_1,
  MOCK_LEAD_ID,
  MOCK_PAYOUT_ID_1,
} from "./fixtures/channel-partner.fixtures.js";

describe("Channel Partner Payout & Finance Module Tests", () => {
  // =========================================================================
  // 1. Create Payout Validation
  // =========================================================================
  describe("Create Payout Validation", () => {
    it("should validate valid commission payout disbursement payload", () => {
      const payload = {
        body: {
          channelPartnerId: MOCK_PARTNER_ID_1,
          leadId: MOCK_LEAD_ID,
          amount: 25000.0,
          paymentMode: "BANK_TRANSFER",
          transactionReference: "UTR20260925HDFC001234",
          status: "COMPLETED" as const,
          paymentDate: "2026-09-25T10:30:00.000Z",
          remarks: "Advance commission payout for 3BHK Prestige Lakeside deal",
          receiptUrl: {
            id: "receipt_123",
            url: "https://storage.homio.in/payouts/receipt_123.pdf",
            bytes: 145000,
            format: "pdf",
            provider: "AWS_S3",
          },
          additionalInformation: {
            approvalReference: "APPR-9012",
          },
        },
      };

      const result = createCPPayoutSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.channelPartnerId).toBe(MOCK_PARTNER_ID_1);
        expect(result.data.body.amount).toBe(25000.0);
        expect(result.data.body.paymentMode).toBe("BANK_TRANSFER");
        expect(result.data.body.transactionReference).toBe("UTR20260925HDFC001234");
        expect(result.data.body.status).toBe("COMPLETED");
      }
    });

    it("should validate payout across multiple accepted payment modes (UPI, NEFT, CHEQUE)", () => {
      const modes = ["UPI", "NEFT", "RTGS", "CHEQUE", "CASH"];
      for (const mode of modes) {
        const payload = {
          body: {
            channelPartnerId: MOCK_PARTNER_ID_1,
            amount: 10000,
            paymentMode: mode,
          },
        };
        const result = createCPPayoutSchema.safeParse(payload);
        expect(result.success).toBe(true);
      }
    });

    it("should reject payout when amount is zero or negative", () => {
      const zeroPayload = {
        body: {
          channelPartnerId: MOCK_PARTNER_ID_1,
          amount: 0,
          paymentMode: "BANK_TRANSFER",
        },
      };

      const negativePayload = {
        body: {
          channelPartnerId: MOCK_PARTNER_ID_1,
          amount: -5000,
          paymentMode: "BANK_TRANSFER",
        },
      };

      expect(createCPPayoutSchema.safeParse(zeroPayload).success).toBe(false);
      expect(createCPPayoutSchema.safeParse(negativePayload).success).toBe(false);
    });

    it("should reject payout when channelPartnerId is not a valid UUID", () => {
      const invalidPartnerPayload = {
        body: {
          channelPartnerId: "not-a-uuid",
          amount: 5000,
          paymentMode: "UPI",
        },
      };

      const result = createCPPayoutSchema.safeParse(invalidPartnerPayload);
      expect(result.success).toBe(false);
    });

    it("should reject payout when paymentMode is missing", () => {
      const invalidPayload = {
        body: {
          channelPartnerId: MOCK_PARTNER_ID_1,
          amount: 5000,
          paymentMode: "",
        },
      };

      const result = createCPPayoutSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Query Payouts Validation
  // =========================================================================
  describe("Get Payouts Query Validation", () => {
    it("should provide default pagination values (page: 1, limit: 10, sortBy: paymentDate)", () => {
      const query = {
        query: {},
      };

      const result = getCPPayoutsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.limit).toBe(10);
        expect(result.data.query.sortBy).toBe("paymentDate");
        expect(result.data.query.sortOrder).toBe("desc");
      }
    });

    it("should validate channelPartnerId, paymentMode, and date range filters", () => {
      const query = {
        query: {
          page: "1",
          limit: "50",
          channelPartnerId: MOCK_PARTNER_ID_1,
          paymentMode: "BANK_TRANSFER",
          status: "COMPLETED",
          fromDate: "2026-09-01",
          toDate: "2026-09-30",
        },
      };

      const result = getCPPayoutsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.channelPartnerId).toBe(MOCK_PARTNER_ID_1);
        expect(result.data.query.paymentMode).toBe("BANK_TRANSFER");
        expect(result.data.query.status).toBe("COMPLETED");
      }
    });
  });

  // =========================================================================
  // 3. Payout ID Param Schema
  // =========================================================================
  describe("Payout ID Param Schema", () => {
    it("should accept valid UUID param", () => {
      const result = payoutIdParamSchema.safeParse({ params: { id: MOCK_PAYOUT_ID_1 } });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID param", () => {
      const result = payoutIdParamSchema.safeParse({ params: { id: "payout-999" } });
      expect(result.success).toBe(false);
    });
  });
});
