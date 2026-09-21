import { describe, it, expect } from "bun:test";
import {
  createExpenseSchema,
  updateExpenseSchema,
  updateExpensePaymentStatusSchema,
  updateExpenseReimbursementSchema,
  getExpensesQuerySchema,
  getExpenseSummaryQuerySchema,
} from "../../src/module/projects/validators/expense.validator.js";
import {
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
} from "../leads-crm/fixtures/crm.fixtures.js";

describe("Expenses & Financial Tracking Module Tests", () => {
  const MOCK_EXPENSE_ID = "77777777-8888-4999-aaaa-bbbbbbbbbbbb";
  const MOCK_MILESTONE_ID = "44444444-5555-4666-8777-888888888888";
  const MOCK_VENDOR_ID = "88888888-9999-4aaa-bbbb-cccccccccccc";
  const MOCK_CATEGORY_ID = "66666666-7777-4888-9999-000000000000";

  // =========================================================================
  // 1. Create Expense Validation (Project Scope & Org Scope)
  // =========================================================================
  describe("Create Expense Validation", () => {
    it("should validate full project expense creation with vendor and taxes", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          title: "Italian Statuario Marble Slabs Procured",
          description: "450 sqft procured from vendor for master bathroom & living foyer flooring",
          expenseScope: "PROJECT" as const,
          projectId: MOCK_PROJECT_ID,
          milestoneId: MOCK_MILESTONE_ID,
          categoryId: MOCK_CATEGORY_ID,
          vendorId: MOCK_VENDOR_ID,
          amount: 150000,
          taxAmount: 27000,
          currency: "INR",
          expenseDate: "2026-10-15",
          paymentMethod: "BANK_TRANSFER" as const,
          paymentStatus: "PAID" as const,
          paidAt: "2026-10-15T12:00:00Z",
          invoiceNumber: "INV-MARBLE-2026-088",
          transactionReference: "UTR-HDFC-99281726",
          createdById: MOCK_EMPLOYEE_ID_1,
          isBillableToClient: true,
          isReimbursable: false,
          receiptUrl: {
            id: "receipt-01",
            url: "https://storage.homio.in/expenses/inv-marble-088.pdf",
            bytes: 512000,
            format: "pdf",
            provider: "AWS_S3" as const,
          },
          tags: ["marble", "flooring", "client-billable"],
        },
      };

      const parsed = createExpenseSchema.parse(payload);
      expect(parsed.body.title).toBe("Italian Statuario Marble Slabs Procured");
      expect(parsed.body.amount).toBe(150000);
      expect(parsed.body.taxAmount).toBe(27000);
      expect(parsed.body.expenseScope).toBe("PROJECT");
      expect(parsed.body.isBillableToClient).toBe(true);
      expect(parsed.body.receiptUrl?.id).toBe("receipt-01");
    });

    it("should validate organization overhead expense without project link", () => {
      const payload = {
        body: {
          title: "Studio Office Rent - October 2026",
          description: "Monthly lease payment for Bandra design studio",
          expenseScope: "ORGANIZATION" as const,
          categoryId: MOCK_CATEGORY_ID,
          amount: 85000,
          taxAmount: 0,
          expenseDate: "2026-10-01",
          paymentMethod: "BANK_TRANSFER" as const,
          paymentStatus: "PAID" as const,
          transactionReference: "UTR-ICICI-88192019",
          createdById: MOCK_EMPLOYEE_ID_1,
        },
      };

      const parsed = createExpenseSchema.parse(payload);
      expect(parsed.body.title).toBe("Studio Office Rent - October 2026");
      expect(parsed.body.expenseScope).toBe("ORGANIZATION");
      expect(parsed.body.amount).toBe(85000);
      expect(parsed.body.projectId).toBeUndefined();
    });

    it("should fail validation when amount is negative", () => {
      const invalidPayload = {
        body: {
          title: "Invalid Negative Expense",
          amount: -500,
          expenseDate: "2026-10-15",
        },
      };

      expect(() => createExpenseSchema.parse(invalidPayload)).toThrow();
    });

    it("should fail validation when expenseDate is invalid format", () => {
      const invalidPayload = {
        body: {
          title: "Invalid Date Expense",
          amount: 5000,
          expenseDate: "15/10/2026",
        },
      };

      expect(() => createExpenseSchema.parse(invalidPayload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Expense Validation
  // =========================================================================
  describe("Update Expense Validation", () => {
    it("should validate partial update on expense amount and tags", () => {
      const payload = {
        params: { id: MOCK_EXPENSE_ID },
        body: {
          amount: 165000,
          taxAmount: 29700,
          notes: "Revised invoice after freight discount",
          tags: ["marble", "discounted"],
        },
      };

      const parsed = updateExpenseSchema.parse(payload);
      expect(parsed.params.id).toBe(MOCK_EXPENSE_ID);
      expect(parsed.body.amount).toBe(165000);
      expect(parsed.body.taxAmount).toBe(29700);
    });

    it("should validate updating payment status and UTR number", () => {
      const payload = {
        params: { id: MOCK_EXPENSE_ID },
        body: {
          paymentStatus: "PAID" as const,
          transactionReference: "UTR-AXIS-99201928",
          paymentMethod: "UPI" as const,
          paidAt: "2026-10-16T10:00:00Z",
        },
      };

      const parsed = updateExpensePaymentStatusSchema.parse(payload);
      expect(parsed.params.id).toBe(MOCK_EXPENSE_ID);
      expect(parsed.body.paymentStatus).toBe("PAID");
      expect(parsed.body.transactionReference).toBe("UTR-AXIS-99201928");
    });

    it("should validate marking out-of-pocket expense as reimbursed", () => {
      const payload = {
        params: { id: MOCK_EXPENSE_ID },
        body: {
          isReimbursed: true,
        },
      };

      const parsed = updateExpenseReimbursementSchema.parse(payload);
      expect(parsed.params.id).toBe(MOCK_EXPENSE_ID);
      expect(parsed.body.isReimbursed).toBe(true);
    });
  });

  // =========================================================================
  // 3. Query Filters & Financial Summaries Validation
  // =========================================================================
  describe("Get Expenses Query Validation", () => {
    it("should parse expense list filters with date and amount ranges", () => {
      const parsed = getExpensesQuerySchema.parse({
        query: {
          page: "1",
          limit: "25",
          expenseScope: "PROJECT",
          paymentStatus: "PAID",
          isBillableToClient: "true",
          startDate: "2026-10-01",
          endDate: "2026-10-31",
          minAmount: "10000",
          maxAmount: "200000",
        },
      });

      expect(parsed.query.page).toBe(1);
      expect(parsed.query.limit).toBe(25);
      expect(parsed.query.expenseScope).toBe("PROJECT");
      expect(parsed.query.isBillableToClient).toBe(true);
      expect(parsed.query.minAmount).toBe(10000);
      expect(parsed.query.maxAmount).toBe(200000);
    });

    it("should parse expense financial summary query", () => {
      const parsed = getExpenseSummaryQuerySchema.parse({
        query: {
          projectId: MOCK_PROJECT_ID,
          expenseScope: "PROJECT",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        },
      });

      expect(parsed.query.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.query.expenseScope).toBe("PROJECT");
      expect(parsed.query.startDate).toBe("2026-01-01");
    });
  });
});
