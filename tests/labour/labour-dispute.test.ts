import { describe, it, expect } from "bun:test";
import {
  createLabourDisputeSchema,
  updateLabourDisputeSchema,
  updateDisputeStatusSchema,
  getLabourDisputesQuerySchema,
} from "../../src/module/labour/validators/labour-dispute.validator.js";
import {
  MOCK_LABOUR_ID_1,
  MOCK_BOOKING_ID_1,
  MOCK_DISPUTE_ID_1,
  MOCK_EVIDENCE_DOC,
} from "./fixtures/labour.fixtures.js";

describe("Labour Module - Legal & Site Dispute Tests", () => {
  describe("1. Dispute Case Creation Validation", () => {
    it("should validate dispute filing payload with evidence documents and initiator", () => {
      const payload = {
        body: {
          labourId: MOCK_LABOUR_ID_1,
          bookingId: MOCK_BOOKING_ID_1,
          disputeType: "QUALITY_BREACH" as const,
          amountInDispute: 15000.0,
          status: "OPEN" as const,
          initiator: "CLIENT" as const,
          reason: "Improper board fixing caused sag in dining room ceiling.",
          resolutionSummary: "Contractor agreed to inspect and replace damaged panels.",
          lawyerName: "Advocate Sandeep Rao",
          hearingDate: "2026-10-20",
          evidenceDocs: [MOCK_EVIDENCE_DOC],
          additionalInformation: {
            snagReportRef: "SNAG-2026-4412",
          },
        },
      };

      const parsed = createLabourDisputeSchema.parse(payload);
      expect(parsed.body.disputeType).toBe("QUALITY_BREACH");
      expect(parsed.body.amountInDispute).toBe(15000.0);
      expect(parsed.body.initiator).toBe("CLIENT");
      expect(parsed.body.evidenceDocs?.[0]?.id).toBe(MOCK_EVIDENCE_DOC.id);
    });

    it("should reject dispute without minimum reason length (5 chars)", () => {
      expect(() =>
        createLabourDisputeSchema.parse({
          body: {
            labourId: MOCK_LABOUR_ID_1,
            reason: "Bad", // Too short
          },
        })
      ).toThrow();
    });
  });

  describe("2. Symmetric Full Editability Validation (Rule 19)", () => {
    it("should allow editing dispute details and lawyer information", () => {
      const updatePayload = {
        params: { id: MOCK_DISPUTE_ID_1 },
        body: {
          amountInDispute: 12000.0,
          lawyerName: "Advocate Sandeep Rao & Associates",
          resolutionSummary: "Settlement terms drafted.",
        },
      };

      const parsed = updateLabourDisputeSchema.parse(updatePayload);
      expect(parsed.body.amountInDispute).toBe(12000.0);
      expect(parsed.body.lawyerName).toContain("Associates");
    });
  });

  describe("3. Dispute Lifecycle Status Transitions", () => {
    it("should accept valid dispute lifecycle progression", () => {
      const statuses = ["OPEN", "UNDER_REVIEW", "NOTICE_SENT", "SETTLED", "CLOSED"] as const;
      for (const status of statuses) {
        const parsed = updateDisputeStatusSchema.parse({
          params: { id: MOCK_DISPUTE_ID_1 },
          body: {
            status,
            resolutionSummary: `Status changed to ${status}`,
          },
        });
        expect(parsed.body.status).toBe(status);
      }
    });
  });

  describe("4. Query Filtering Validation", () => {
    it("should parse dispute filter queries", () => {
      const parsed = getLabourDisputesQuerySchema.parse({
        query: {
          disputeType: "QUALITY_BREACH",
          status: "OPEN",
          initiator: "CLIENT",
        },
      });

      expect(parsed.query.disputeType).toBe("QUALITY_BREACH");
      expect(parsed.query.status).toBe("OPEN");
    });
  });
});
