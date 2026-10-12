import { describe, it, expect } from "bun:test";
import {
  reportBypassAttemptSchema,
  reportClientPaymentDueSchema,
  reportLabourAbandonmentSchema,
  assignEmpanelledLawyerSchema,
  recordLegalNoticeSchema,
  recordLabourCourtActionSchema,
} from "../../src/module/labour/validators/labour-dispute.validator.js";
import { MARKETPLACE_CONFIG } from "../../src/constants/marketplace.constants.js";

describe("Marketplace Dispute & Governance Escalation Module Tests", () => {
  const mockBookingId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  const mockDisputeId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

  describe("1. Off-Platform Cash Bypass Attempt Reporting Validation", () => {
    it("should validate bypass attempt report against client with evidence attachments", () => {
      const payload = {
        body: {
          bookingId: mockBookingId,
          reportedRole: "CLIENT",
          reason: "Client pressured worker on-site to cancel platform booking and settle via direct cash bypass.",
          evidenceDocs: [
            {
              id: "bypass_audio_proof",
              url: "https://cloud.homio.in/disputes/audio_rec.mp3",
              bytes: 98000,
              format: "mp3",
              provider: "s3",
            },
          ],
        },
      };

      const parsed = reportBypassAttemptSchema.parse(payload);
      expect(parsed.body.bookingId).toBe(mockBookingId);
      expect(parsed.body.reportedRole).toBe("CLIENT");
      expect(parsed.body.reason).toContain("cash bypass");
      expect(parsed.body.evidenceDocs?.length).toBe(1);
    });

    it("should reject bypass attempt report when reason is shorter than 5 characters", () => {
      const payload = {
        body: {
          bookingId: mockBookingId,
          reportedRole: "LABOUR",
          reason: "Cash", // < 5 chars
        },
      };

      expect(() => reportBypassAttemptSchema.parse(payload)).toThrow();
    });
  });

  describe("2. Client Payment Dues & Wage Default Reporting Validation", () => {
    it("should validate client payment default with disputed amount and evidence", () => {
      const payload = {
        body: {
          bookingId: mockBookingId,
          amountInDispute: 4800.0,
          reason: "Client failed to clear agreed labor deal wage after successful work completion inspection.",
          evidenceDocs: [
            {
              id: "whatsapp_payment_reminder",
              url: "https://cloud.homio.in/disputes/chat_reminder.jpg",
              bytes: 75000,
              format: "jpg",
              provider: "s3",
            },
          ],
        },
      };

      const parsed = reportClientPaymentDueSchema.parse(payload);
      expect(parsed.body.bookingId).toBe(mockBookingId);
      expect(parsed.body.amountInDispute).toBe(4800.0);
      expect(parsed.body.reason).toContain("failed to clear");
    });

    it("should reject client dues report with non-positive amount", () => {
      const payload = {
        body: {
          bookingId: mockBookingId,
          amountInDispute: 0,
          reason: "Payment default with zero amount",
        },
      };

      expect(() => reportClientPaymentDueSchema.parse(payload)).toThrow();
    });
  });

  describe("3. Labour Work Abandonment Reporting Validation", () => {
    it("should validate work abandonment filing by client", () => {
      const payload = {
        body: {
          bookingId: mockBookingId,
          reason: "Worker left site halfway through bathroom tiling work and stopped responding to phone calls.",
          evidenceDocs: [
            {
              id: "abandoned_site_photo",
              url: "https://cloud.homio.in/disputes/half_tiled_floor.jpg",
              bytes: 90000,
              format: "jpg",
              provider: "s3",
            },
          ],
        },
      };

      const parsed = reportLabourAbandonmentSchema.parse(payload);
      expect(parsed.body.bookingId).toBe(mockBookingId);
      expect(parsed.body.reason).toContain("halfway");
      expect(parsed.body.evidenceDocs?.length).toBe(1);
    });
  });

  describe("4. Empanelled Lawyer Assignment Validation", () => {
    it("should validate empanelled lawyer assignment payload", () => {
      const payload = {
        params: { id: mockDisputeId },
        body: {
          lawyerName: "Adv. Rajesh Kumar Sharma",
          lawyerPhone: "+91-9876543210",
          lawyerBarCouncilNo: "D/1234/2015",
        },
      };

      const parsed = assignEmpanelledLawyerSchema.parse(payload);
      expect(parsed.params.id).toBe(mockDisputeId);
      expect(parsed.body.lawyerName).toBe("Adv. Rajesh Kumar Sharma");
      expect(parsed.body.lawyerBarCouncilNo).toBe("D/1234/2015");
    });

    it("should reject lawyer assignment without lawyer name or phone", () => {
      const payload = {
        params: { id: mockDisputeId },
        body: {
          lawyerName: "",
          lawyerPhone: "",
        },
      };

      expect(() => assignEmpanelledLawyerSchema.parse(payload)).toThrow();
    });
  });

  describe("5. Legal Demand Notice & Labour Court Action Validation", () => {
    it("should validate legal demand notice recording", () => {
      const payload = {
        params: { id: mockDisputeId },
        body: {
          noticeSummary: "Section 138 / Wage Recovery formal legal notice dispatched via registered speed post.",
          legalNoticeDoc: {
            id: "legal_notice_pdf",
            url: "https://cloud.homio.in/legal/notice_speedpost.pdf",
            bytes: 95000,
            format: "pdf",
            provider: "s3",
          },
        },
      };

      const parsed = recordLegalNoticeSchema.parse(payload);
      expect(parsed.params.id).toBe(mockDisputeId);
      expect(parsed.body.noticeSummary).toContain("Wage Recovery");
      expect(parsed.body.legalNoticeDoc?.format).toBe("pdf");
    });

    it("should validate Labour Court claim registration", () => {
      const payload = {
        params: { id: mockDisputeId },
        body: {
          labourCourtCaseNo: "LC-BLR-2026-0891",
          labourCourtDate: new Date().toISOString(),
          actionSummary: "Payment of Wages Act claim petition filed before the Labour Court Bengaluru Bench.",
        },
      };

      const parsed = recordLabourCourtActionSchema.parse(payload);
      expect(parsed.params.id).toBe(mockDisputeId);
      expect(parsed.body.labourCourtCaseNo).toBe("LC-BLR-2026-0891");
      expect(parsed.body.actionSummary).toContain("Payment of Wages Act");
    });
  });

  describe("6. Governance Thresholds & Disciplinary Constants Verification", () => {
    it("should verify client blacklisting triggers at 2 or more unresolved dues defaults", () => {
      expect(MARKETPLACE_CONFIG.MAX_CLIENT_PAYMENT_DUES_BEFORE_BLACKLIST).toBe(2);

      const duesCount = 2;
      const shouldBlacklist = duesCount >= MARKETPLACE_CONFIG.MAX_CLIENT_PAYMENT_DUES_BEFORE_BLACKLIST;
      expect(shouldBlacklist).toBe(true);
    });

    it("should verify labour blacklisting triggers at 3 or more formal warnings", () => {
      expect(MARKETPLACE_CONFIG.MAX_LABOUR_WARNINGS_BEFORE_BLACKLIST).toBe(3);

      const warningCount = 3;
      const shouldBlacklist = warningCount >= MARKETPLACE_CONFIG.MAX_LABOUR_WARNINGS_BEFORE_BLACKLIST;
      expect(shouldBlacklist).toBe(true);
    });

    it("should verify rating penalties for bypass attempt and payment default", () => {
      expect(MARKETPLACE_CONFIG.BYPASS_ATTEMPT_RATING_PENALTY).toBe(2.0);
      expect(MARKETPLACE_CONFIG.CLIENT_PAYMENT_DEFAULT_RATING_PENALTY).toBe(1.5);
    });
  });
});
