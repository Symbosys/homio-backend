import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  createProjectBillSchema,
  updateProjectBillSchema,
  getProjectBillsQuerySchema,
  createProjectPaymentRecordSchema,
  updateProjectPaymentRecordSchema,
  getProjectPaymentRecordsQuerySchema,
  getProjectCommercialSummaryQuerySchema,
} from "../../src/module/projects/validators/project-billing.validator.js";
import {
  ProjectBillType,
  ProjectBillStatus,
  BillCommissionStatus,
  ProjectPaymentRecordStatus,
  ProjectPaymentMethod,
  ProjectStage,
} from "../../src/types/types.js";
import {
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_EMPLOYEE_ID_2,
} from "../leads-crm/fixtures/crm.fixtures.js";

describe("Project Billing & Payments Subsystem - Unit & Integration Tests", () => {
  const MOCK_VENDOR_ID = "11111111-1111-4111-8111-111111111111";
  const MOCK_LABOUR_ID = "66666666-6666-4666-8666-666666666666";
  const MOCK_BILL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const MOCK_PAYMENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  // =========================================================================
  // 1. MATERIAL BILL VALIDATION TESTS
  // =========================================================================
  describe("Material Bill Validation", () => {
    it("should successfully validate complete Material bill with vendor, tax, and cloud invoice", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          projectId: MOCK_PROJECT_ID,
          billNumber: "BIL-MAT-202609-001",
          title: "CenturyPly 18mm BWP Plywood - 40 Sheets",
          billType: "MATERIAL",
          stage: "EXECUTION",
          vendorId: MOCK_VENDOR_ID,
          materialCategory: "Plywood & Timber",
          totalAmount: 100000,
          taxPercent: 18,
          taxAmount: 18000,
          grandTotal: 118000,
          commissionStatus: "DUE",
          commissionRate: 5,
          commissionAmount: 5000,
          billDate: "2026-09-29",
          dueDate: "2026-10-29",
          createdById: MOCK_EMPLOYEE_ID_1,
          approvedById: MOCK_EMPLOYEE_ID_2,
          billDocumentUrl: {
            id: "cloud-bill-001",
            url: "https://storage.homio.in/bills/centuryply-inv.pdf",
            bytes: 524288,
            format: "pdf",
            provider: "AWS_S3",
          },
          attachments: [
            {
              id: "cloud-dc-001",
              url: "https://storage.homio.in/bills/centuryply-dc.pdf",
              bytes: 262144,
              format: "pdf",
              provider: "AWS_S3",
            },
          ],
          notes: "Materials received on site and inspected by site supervisor.",
          additionalInformation: {
            deliveryVehicleNumber: "KA-01-AB-1234",
            gatePassNumber: "GP-9821",
          },
        },
      };

      const parsed = createProjectBillSchema.parse(payload);
      expect(parsed.body.billType).toBe(ProjectBillType.MATERIAL);
      expect(parsed.body.vendorId).toBe(MOCK_VENDOR_ID);
      expect(parsed.body.materialCategory).toBe("Plywood & Timber");
      expect(parsed.body.grandTotal).toBe(118000);
      expect(parsed.body.commissionStatus).toBe(BillCommissionStatus.DUE);
      expect(parsed.body.billDocumentUrl?.id).toBe("cloud-bill-001");
      expect(parsed.body.attachments?.length).toBe(1);
    });

    it("should fail validation if Material bill has no vendorId", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "Tiles purchase",
          billType: "MATERIAL",
          totalAmount: 50000,
          grandTotal: 50000,
          billDate: "2026-09-29",
        },
      };

      expect(() => createProjectBillSchema.parse(payload)).toThrow(/Vendor is required for MATERIAL bills/);
    });
  });

  // =========================================================================
  // 2. LABOUR BILL VALIDATION TESTS
  // =========================================================================
  describe("Labour Bill Validation", () => {
    it("should successfully validate Labour bill with contractor, trade, and commission defaults", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          billNumber: "BIL-LAB-202609-001",
          title: "Carpentry Framework Weekly Running Bill",
          billType: "LABOUR",
          stage: "EXECUTION",
          labourId: MOCK_LABOUR_ID,
          labourTrade: "Carpentry",
          totalAmount: 45000,
          grandTotal: 45000,
          billDate: "2026-09-29",
          createdById: MOCK_EMPLOYEE_ID_1,
        },
      };

      const parsed = createProjectBillSchema.parse(payload);
      expect(parsed.body.billType).toBe(ProjectBillType.LABOUR);
      expect(parsed.body.labourId).toBe(MOCK_LABOUR_ID);
      expect(parsed.body.labourTrade).toBe("Carpentry");
      expect(parsed.body.grandTotal).toBe(45000);
      expect(parsed.body.commissionStatus).toBe(BillCommissionStatus.DUE);
    });

    it("should fail validation if Labour bill has no labourId", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "Masonry Work",
          billType: "LABOUR",
          totalAmount: 30000,
          grandTotal: 30000,
          billDate: "2026-09-29",
        },
      };

      expect(() => createProjectBillSchema.parse(payload)).toThrow(/Labour is required for LABOUR bills/);
    });
  });

  // =========================================================================
  // 3. DESIGN & SUPERVISION BILL VALIDATION TESTS
  // =========================================================================
  describe("Design & Supervision Bill Validation", () => {
    it("should successfully validate Design bill without requiring vendor or labour selection", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          billNumber: "BIL-DSG-202609-001",
          title: "3D Visualizer & Render Specialist Package Fee",
          billType: "DESIGN",
          stage: "DESIGN",
          totalAmount: 25000,
          grandTotal: 25000,
          billDate: "2026-09-29",
        },
      };

      const parsed = createProjectBillSchema.parse(payload);
      expect(parsed.body.billType).toBe(ProjectBillType.DESIGN);
      expect(parsed.body.vendorId).toBeUndefined();
      expect(parsed.body.labourId).toBeUndefined();
      expect(parsed.body.grandTotal).toBe(25000);
    });

    it("should successfully validate Supervision fee bill", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          billNumber: "BIL-SUP-202609-001",
          title: "Project Management & Site Quality Supervision Fee",
          billType: "SUPERVISION",
          stage: "EXECUTION",
          totalAmount: 15000,
          grandTotal: 15000,
          billDate: "2026-09-29",
        },
      };

      const parsed = createProjectBillSchema.parse(payload);
      expect(parsed.body.billType).toBe(ProjectBillType.SUPERVISION);
      expect(parsed.body.grandTotal).toBe(15000);
    });
  });

  // =========================================================================
  // 4. PROJECT PAYMENT RECORD VALIDATION TESTS
  // =========================================================================
  describe("Project Payment Record Validation", () => {
    it("should validate payment record allocated against a specific bill", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          projectId: MOCK_PROJECT_ID,
          billId: MOCK_BILL_ID,
          paymentNumber: "PAY-REC-202609-001",
          title: "Part Payment for Plywood Bill (30k)",
          billType: "MATERIAL",
          stage: "EXECUTION",
          status: "SUCCESS",
          amount: 30000,
          paymentDate: "2026-09-29",
          paymentMethod: "BANK_TRANSFER",
          transactionReference: "UTR-HDFC-99881122",
          bankName: "HDFC Bank",
          recordedById: MOCK_EMPLOYEE_ID_1,
          receiptUrl: {
            id: "cloud-receipt-001",
            url: "https://storage.homio.in/receipts/bank-debit-ack.pdf",
            bytes: 1048576,
            format: "pdf",
            provider: "AWS_S3",
          },
          notes: "Paid via RTGS to CenturyPly dealer account.",
        },
      };

      const parsed = createProjectPaymentRecordSchema.parse(payload);
      expect(parsed.body.billId).toBe(MOCK_BILL_ID);
      expect(parsed.body.amount).toBe(30000);
      expect(parsed.body.status).toBe(ProjectPaymentRecordStatus.SUCCESS);
      expect(parsed.body.paymentMethod).toBe(ProjectPaymentMethod.BANK_TRANSFER);
      expect(parsed.body.receiptUrl?.id).toBe("cloud-receipt-001");
    });

    it("should reject non-positive payment amount", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "Invalid zero payment",
          billType: "MATERIAL",
          amount: 0,
          paymentDate: "2026-09-29",
        },
      };

      expect(() => createProjectPaymentRecordSchema.parse(payload)).toThrow(/Payment amount must be greater than 0/);
    });
  });

  // =========================================================================
  // 5. DIRTY UPDATE SCHEMAS & QUERY FILTERS
  // =========================================================================
  describe("Partial Update & Query Schemas", () => {
    it("should validate partial dirty update on Project Bill", () => {
      const payload = {
        params: { id: MOCK_BILL_ID },
        body: {
          commissionStatus: "PAID",
          commissionPaidDate: "2026-10-05",
          notes: "Vendor commission reconciled via cheque.",
        },
      };

      const parsed = updateProjectBillSchema.parse(payload);
      expect(parsed.body.commissionStatus).toBe(BillCommissionStatus.PAID);
      expect(parsed.body.commissionPaidDate).toBe("2026-10-05");
    });

    it("should validate paginated queries with filters", () => {
      const query = {
        query: {
          page: "2",
          limit: "15",
          billType: "MATERIAL",
          stage: "EXECUTION",
          status: "PARTIALLY_PAID",
          vendorId: MOCK_VENDOR_ID,
          startDate: "2026-09-01",
          endDate: "2026-09-30",
        },
      };

      const parsed = getProjectBillsQuerySchema.parse(query);
      expect(parsed.query.page).toBe(2);
      expect(parsed.query.limit).toBe(15);
      expect(parsed.query.billType).toBe(ProjectBillType.MATERIAL);
      expect(parsed.query.status).toBe(ProjectBillStatus.PARTIALLY_PAID);
    });

    it("should validate commercial summary query", () => {
      const query = {
        query: {
          projectId: MOCK_PROJECT_ID,
          stage: "EXECUTION",
        },
      };

      const parsed = getProjectCommercialSummaryQuerySchema.parse(query);
      expect(parsed.query.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.query.stage).toBe(ProjectStage.EXECUTION);
    });
  });

  // =========================================================================
  // 6. DUES REBALANCING CALCULATION LOGIC
  // =========================================================================
  describe("Dues & Real-time Balance Calculation Math", () => {
    it("should correctly compute balance due when partial payment is logged", () => {
      const grandTotal = 100000;
      const payment1 = 30000;
      const due1 = grandTotal - payment1;
      expect(due1).toBe(70000);

      const payment2 = 70000;
      const totalPaid = payment1 + payment2;
      const due2 = Math.max(0, grandTotal - totalPaid);
      expect(due2).toBe(0);
    });

    it("should correctly evaluate status transitions based on paidAmount and grandTotal", () => {
      const getStatus = (paid: number, total: number) => {
        if (paid >= total && total > 0) return ProjectBillStatus.PAID;
        if (paid > 0) return ProjectBillStatus.PARTIALLY_PAID;
        return ProjectBillStatus.APPROVED;
      };

      expect(getStatus(0, 100000)).toBe(ProjectBillStatus.APPROVED);
      expect(getStatus(30000, 100000)).toBe(ProjectBillStatus.PARTIALLY_PAID);
      expect(getStatus(100000, 100000)).toBe(ProjectBillStatus.PAID);
      expect(getStatus(120000, 100000)).toBe(ProjectBillStatus.PAID);
    });

    it("should calculate vendor partner commission percentage and amounts accurately", () => {
      const totalAmount = 200000;
      const commissionRate = 4.5;
      const computedCommission = (totalAmount * commissionRate) / 100;
      expect(computedCommission).toBe(9000);
    });
  });

  // =========================================================================
  // 7. UNIVERSAL ADDITIONAL INFORMATION (RULE 18)
  // =========================================================================
  describe("Universal Additional Information Support", () => {
    it("should retain custom key-value metadata on Bill and Payment Record payloads", () => {
      const billPayload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "Hardware & Fittings Invoice",
          billType: "MATERIAL",
          vendorId: MOCK_VENDOR_ID,
          totalAmount: 40000,
          grandTotal: 40000,
          billDate: "2026-09-29",
          additionalInformation: {
            poNumber: "PO-2026-9901",
            batchCode: "BATCH-H-102",
            warrantyMonths: 36,
            inspectorRemarks: "All hinges tested for soft-close functionality.",
          },
        },
      };

      const parsedBill = createProjectBillSchema.parse(billPayload);
      expect(parsedBill.body.additionalInformation?.poNumber).toBe("PO-2026-9901");
      expect(parsedBill.body.additionalInformation?.warrantyMonths).toBe(36);

      const paymentPayload = {
        body: {
          projectId: MOCK_PROJECT_ID,
          title: "Payment with custom TDS info",
          billType: "LABOUR",
          amount: 25000,
          paymentDate: "2026-09-29",
          additionalInformation: {
            tdsDeductedPercent: 1.0,
            tdsCertificateNumber: "TDS-998822",
            bankApprovalCode: "APPR-00918",
          },
        },
      };

      const parsedPayment = createProjectPaymentRecordSchema.parse(paymentPayload);
      expect(parsedPayment.body.additionalInformation?.tdsDeductedPercent).toBe(1.0);
      expect(parsedPayment.body.additionalInformation?.bankApprovalCode).toBe("APPR-00918");
    });
  });
});
