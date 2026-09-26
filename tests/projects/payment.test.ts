import { describe, it, expect } from "bun:test";
import {
  createPaymentSchema,
  updatePaymentSchema,
  getPaymentsQuerySchema,
  getPaymentSummaryQuerySchema,
} from "../../src/module/projects/validators/payment.validator.js";
import {
  MOCK_PROJECT_ID,
  MOCK_CUSTOMER_ID,
  MOCK_EMPLOYEE_ID_1,
} from "../leads-crm/fixtures/crm.fixtures.js";

describe("Project Payment & Ledger Module Tests", () => {
  const MOCK_MILESTONE_ID = "44444444-5555-4666-8777-888888888888";

  // =========================================================================
  // 1. Create Payment Validation
  // =========================================================================
  describe("Create Payment Validation", () => {
    it("should validate full project payment creation with milestone and receipt", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          projectId: MOCK_PROJECT_ID,
          milestoneId: MOCK_MILESTONE_ID,
          customerId: MOCK_CUSTOMER_ID,
          paymentNumber: "PAY-2026-0001",
          title: "Advance 20% on 3D Design Approval",
          paymentType: "DESIGN_FEE",
          flowDirection: "INFLOW",
          status: "COMPLETED",
          amount: 150000,
          paymentDate: "2026-10-15",
          paymentMethod: "BANK_TRANSFER",
          transactionReference: "UTR-HDFC-99281726",
          bankName: "HDFC Bank",
          recordedById: MOCK_EMPLOYEE_ID_1,
          receiptUrl: {
            id: "receipt-01",
            url: "https://storage.homio.in/payments/adv-3d-receipt.pdf",
            bytes: 512000,
            format: "pdf",
            provider: "AWS_S3",
          },
          attachments: [
            {
              id: "att-01",
              url: "https://storage.homio.in/payments/bank-ack.pdf",
              bytes: 256000,
              format: "pdf",
              provider: "AWS_S3",
            },
          ],
          notes: "Payment cleared via RTGS from client account.",
          additionalInformation: {
            chequeClearanceDays: 0,
            taxDeductedAtSource: false,
          },
        },
      };

      const parsed = createPaymentSchema.parse(payload);
      expect(parsed.body.title).toBe("Advance 20% on 3D Design Approval");
      expect(parsed.body.amount).toBe(150000);
      expect(parsed.body.paymentType).toBe("DESIGN_FEE");
      expect(parsed.body.flowDirection).toBe("INFLOW");
      expect(parsed.body.status).toBe("COMPLETED");
      expect(parsed.body.paymentMethod).toBe("BANK_TRANSFER");
      expect(parsed.body.receiptUrl?.id).toBe("receipt-01");
      expect(parsed.body.additionalInformation?.chequeClearanceDays).toBe(0);
    });

    it("should validate turnkey milestone inflow payment with defaults", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "Milestone 1 Stage Payment",
          amount: 500000,
          paymentDate: "2026-10-20",
        },
      };

      const parsed = createPaymentSchema.parse(payload);
      expect(parsed.body.title).toBe("Milestone 1 Stage Payment");
      expect(parsed.body.amount).toBe(500000);
      expect(parsed.body.paymentType).toBe("TURNKEY_PACKAGE");
      expect(parsed.body.flowDirection).toBe("INFLOW");
      expect(parsed.body.status).toBe("COMPLETED");
      expect(parsed.body.paymentMethod).toBe("BANK_TRANSFER");
    });

    it("should validate outflow payment for labour contractor payout", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "Carpentry Contractor Weekly Labour Payout",
          paymentType: "LABOUR_PAYMENT",
          flowDirection: "OUTFLOW",
          status: "COMPLETED",
          amount: 45000,
          paymentDate: "2026-10-22",
          paymentMethod: "UPI",
          transactionReference: "UPI-ICICI-881920",
        },
      };

      const parsed = createPaymentSchema.parse(payload);
      expect(parsed.body.paymentType).toBe("LABOUR_PAYMENT");
      expect(parsed.body.flowDirection).toBe("OUTFLOW");
      expect(parsed.body.paymentMethod).toBe("UPI");
      expect(parsed.body.amount).toBe(45000);
    });

    it("should fail validation when amount is 0 or negative", () => {
      const invalidZero = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "Invalid Payment",
          amount: 0,
          paymentDate: "2026-10-15",
        },
      };

      expect(() => createPaymentSchema.parse(invalidZero)).toThrow();

      const invalidNegative = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "Invalid Negative Payment",
          amount: -5000,
          paymentDate: "2026-10-15",
        },
      };

      expect(() => createPaymentSchema.parse(invalidNegative)).toThrow();
    });

    it("should fail validation when title is too short", () => {
      const invalidTitle = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "A",
          amount: 1000,
          paymentDate: "2026-10-15",
        },
      };

      expect(() => createPaymentSchema.parse(invalidTitle)).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Payment Validation
  // =========================================================================
  describe("Update Payment Validation", () => {
    it("should validate partial dirty update on amount, status and transaction reference", () => {
      const payload = {
        params: { id: "11111111-2222-4333-8444-555555555555" },
        body: {
          status: "COMPLETED",
          transactionReference: "UTR-AXIS-991827",
          amount: 200000,
        },
      };

      const parsed = updatePaymentSchema.parse(payload);
      expect(parsed.body.status).toBe("COMPLETED");
      expect(parsed.body.transactionReference).toBe("UTR-AXIS-991827");
      expect(parsed.body.amount).toBe(200000);
      expect(parsed.body.title).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. Query Filter Validation
  // =========================================================================
  describe("Query Filter Validation", () => {
    it("should validate payment filter query parameters", () => {
      const queryPayload = {
        query: {
          page: "2",
          limit: "15",
          projectId: MOCK_PROJECT_ID,
          flowDirection: "INFLOW",
          status: "COMPLETED",
          paymentType: "CONSULTING_PERCENTAGE",
          paymentMethod: "BANK_TRANSFER",
          startDate: "2026-10-01",
          endDate: "2026-10-31",
          sortBy: "amount",
          sortOrder: "desc",
        },
      };

      const parsed = getPaymentsQuerySchema.parse(queryPayload);
      expect(parsed.query.page).toBe(2);
      expect(parsed.query.limit).toBe(15);
      expect(parsed.query.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.query.flowDirection).toBe("INFLOW");
      expect(parsed.query.paymentType).toBe("CONSULTING_PERCENTAGE");
      expect(parsed.query.sortBy).toBe("amount");
    });

    it("should validate financial summary query", () => {
      const summaryPayload = {
        query: {
          projectId: MOCK_PROJECT_ID,
        },
      };

      const parsed = getPaymentSummaryQuerySchema.parse(summaryPayload);
      expect(parsed.query.projectId).toBe(MOCK_PROJECT_ID);
    });
  });
});
