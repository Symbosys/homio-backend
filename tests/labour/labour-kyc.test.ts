import { describe, it, expect } from "bun:test";
import {
  upsertLabourKycSchema,
  verifyLabourKycSchema,
  deleteKycDocParamSchema,
} from "../../src/module/labour/validators/labour-kyc.validator.js";
import {
  MOCK_LABOUR_ID_1,
  MOCK_AADHAAR_DOC,
  MOCK_SELFIE_PHOTO,
} from "./fixtures/labour.fixtures.js";

describe("Labour Module - KYC Management Tests", () => {
  describe("1. KYC Upsert Payload Validation", () => {
    it("should validate full KYC document upsert with cloud media and bank details", () => {
      const payload = {
        params: { id: MOCK_LABOUR_ID_1 },
        body: {
          aadhaarNumber: "XXXX-XXXX-9021",
          aadhaarDoc: MOCK_AADHAAR_DOC,
          selfiePhoto: MOCK_SELFIE_PHOTO,
          policeStationName: "Whitefield Police Station",
          bankName: "State Bank of India",
          bankAccountNo: "30981273912",
          ifscCode: "SBIN0004123",
          accountHolderName: "Ramesh Kumar",
          upiId: "ramesh@upi",
          tradeTestScore: 4.8,
          verificationNotes: "Trade test completed with top score.",
          additionalInformation: {
            policeVerificationCertNo: "PV-2026-9912",
          },
        },
      };

      const parsed = upsertLabourKycSchema.parse(payload);
      expect(parsed.params.id).toBe(MOCK_LABOUR_ID_1);
      expect(parsed.body.bankName).toBe("State Bank of India");
      expect(parsed.body.tradeTestScore).toBe(4.8);
      expect(parsed.body.aadhaarDoc?.id).toBe(MOCK_AADHAAR_DOC.id);
    });

    it("should accept partial updates (e.g. only banking details without documents)", () => {
      const partialPayload = {
        params: { id: MOCK_LABOUR_ID_1 },
        body: {
          bankName: "HDFC Bank",
          bankAccountNo: "501002391823",
          ifscCode: "HDFC0001234",
        },
      };

      const parsed = upsertLabourKycSchema.parse(partialPayload);
      expect(parsed.body.bankName).toBe("HDFC Bank");
      expect(parsed.body.aadhaarDoc).toBeUndefined();
    });
  });

  describe("2. KYC Review & Verification Action", () => {
    it("should validate supervisor approval with trade score and notes", () => {
      const approvalPayload = {
        params: { id: MOCK_LABOUR_ID_1 },
        body: {
          status: "APPROVED" as const,
          tradeTestScore: 4.5,
          verificationNotes: "Verified all physical originals at site office.",
          verifiedBy: "Site Supervisor John",
        },
      };

      const parsed = verifyLabourKycSchema.parse(approvalPayload);
      expect(parsed.body.status).toBe("APPROVED");
      expect(parsed.body.tradeTestScore).toBe(4.5);
    });

    it("should validate rejection with mandatory reason", () => {
      const rejectionPayload = {
        params: { id: MOCK_LABOUR_ID_1 },
        body: {
          status: "REJECTED" as const,
          rejectionReason: "Aadhaar photo blurred and unreadable.",
          verificationNotes: "Requested re-upload with clear image.",
        },
      };

      const parsed = verifyLabourKycSchema.parse(rejectionPayload);
      expect(parsed.body.status).toBe("REJECTED");
      expect(parsed.body.rejectionReason).toContain("blurred");
    });
  });

  describe("3. Document Deletion Param Validation", () => {
    it("should accept valid document types for cloud pruning", () => {
      expect(
        deleteKycDocParamSchema.parse({
          params: { id: MOCK_LABOUR_ID_1, docType: "aadhaarDoc" },
        }).params.docType
      ).toBe("aadhaarDoc");

      expect(
        deleteKycDocParamSchema.parse({
          params: { id: MOCK_LABOUR_ID_1, docType: "selfiePhoto" },
        }).params.docType
      ).toBe("selfiePhoto");
    });

    it("should reject invalid document types", () => {
      expect(() =>
        deleteKycDocParamSchema.parse({
          params: { id: MOCK_LABOUR_ID_1, docType: "invalidDocType" },
        })
      ).toThrow();
    });
  });
});
