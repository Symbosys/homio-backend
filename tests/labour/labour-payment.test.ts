import { describe, it, expect } from "bun:test";
import {
  createLabourPaymentSchema,
  updateLabourPaymentSchema,
  updatePaymentStatusSchema,
  getLabourPaymentsQuerySchema,
} from "../../src/module/labour/validators/labour-payment.validator.js";
import {
  MOCK_LABOUR_ID_1,
  MOCK_BOOKING_ID_1,
  MOCK_PAYMENT_ID_1,
  MOCK_RECEIPT_PHOTO,
} from "./fixtures/labour.fixtures.js";

describe("Labour Module - Payments & Wage Payout Tests", () => {
  describe("1. Payment Creation Validation", () => {
    it("should validate wage payout voucher with amount, method, and receipt photo", () => {
      const payload = {
        body: {
          labourId: MOCK_LABOUR_ID_1,
          bookingId: MOCK_BOOKING_ID_1,
          amount: 6000.0,
          daysCount: 5,
          paymentDate: "2026-10-05",
          paymentMethod: "UPI" as const,
          transactionRef: "UPI-AXIS-20261005-9921",
          receiptPhoto: MOCK_RECEIPT_PHOTO,
          status: "PAID" as const,
          remarks: "5-day wage advance for false ceiling framing.",
          additionalInformation: {
            approvedByFinance: true,
            voucherNo: "VCH-2026-0812",
          },
        },
      };

      const parsed = createLabourPaymentSchema.parse(payload);
      expect(parsed.body.amount).toBe(6000.0);
      expect(parsed.body.daysCount).toBe(5);
      expect(parsed.body.paymentMethod).toBe("UPI");
      expect(parsed.body.receiptPhoto?.id).toBe(MOCK_RECEIPT_PHOTO.id);
    });

    it("should reject payments with zero or negative amounts", () => {
      expect(() =>
        createLabourPaymentSchema.parse({
          body: {
            labourId: MOCK_LABOUR_ID_1,
            amount: -100,
          },
        })
      ).toThrow();
    });
  });

  describe("2. Symmetric Full Editability Validation (Rule 19)", () => {
    it("should allow editing payment details and updating transaction reference", () => {
      const updatePayload = {
        params: { id: MOCK_PAYMENT_ID_1 },
        body: {
          amount: 7200.0,
          daysCount: 6,
          paymentMethod: "BANK_TRANSFER" as const,
          transactionRef: "NEFT-SBI-20261005-0012",
          remarks: "Adjusted to 6 full days.",
        },
      };

      const parsed = updateLabourPaymentSchema.parse(updatePayload);
      expect(parsed.body.amount).toBe(7200.0);
      expect(parsed.body.paymentMethod).toBe("BANK_TRANSFER");
      expect(parsed.body.transactionRef).toContain("NEFT-SBI");
    });
  });

  describe("3. Payment Status Transitions", () => {
    it("should accept valid payment status changes", () => {
      const statuses = ["PAID", "PENDING", "CANCELLED"] as const;
      for (const status of statuses) {
        const parsed = updatePaymentStatusSchema.parse({
          params: { id: MOCK_PAYMENT_ID_1 },
          body: { status },
        });
        expect(parsed.body.status).toBe(status);
      }
    });
  });

  describe("4. Query Filtering Validation", () => {
    it("should parse payment filter queries", () => {
      const parsed = getLabourPaymentsQuerySchema.parse({
        query: {
          labourId: MOCK_LABOUR_ID_1,
          paymentMethod: "UPI",
          status: "PAID",
        },
      });

      expect(parsed.query.labourId).toBe(MOCK_LABOUR_ID_1);
      expect(parsed.query.paymentMethod).toBe("UPI");
    });
  });
});
