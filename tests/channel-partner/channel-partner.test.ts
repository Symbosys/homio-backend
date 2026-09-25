import { describe, it, expect } from "bun:test";
import {
  createChannelPartnerSchema,
  updateChannelPartnerSchema,
  getChannelPartnersQuerySchema,
  cpIdParamSchema,
} from "../../src/module/channel-partner/validators/channel-partner.validator.js";
import {
  MOCK_PARTNER_ID_1,
  MOCK_ORGANIZATION_ID_1,
} from "./fixtures/channel-partner.fixtures.js";

describe("Channel Partner Master Module Tests", () => {
  // =========================================================================
  // 1. Partner Code Pattern Verification
  // =========================================================================
  describe("Partner Code Pattern Verification", () => {
    it("should conform to sequential Partner Code pattern CP-NNNN", () => {
      const codeRegex = /^CP-\d{4,}$/;
      expect(codeRegex.test("CP-1001")).toBe(true);
      expect(codeRegex.test("CP-1042")).toBe(true);
      expect(codeRegex.test("CP-9999")).toBe(true);
      expect(codeRegex.test("CP-10001")).toBe(true);

      expect(codeRegex.test("INVALID-CODE")).toBe(false);
      expect(codeRegex.test("CP-12")).toBe(false);
      expect(codeRegex.test("CUST-1001")).toBe(false);
    });
  });

  // =========================================================================
  // 2. Create Channel Partner Validation
  // =========================================================================
  describe("Create Channel Partner Validation", () => {
    it("should validate a complete valid partner creation payload with bank and KYC details", () => {
      const payload = {
        body: {
          name: "Amit Patel",
          companyName: "Patel Realty & Interior Associates",
          partnerType: "REAL_ESTATE_AGENT",
          phone: "+919876543210",
          alternatePhone: "+919876543211",
          email: "amit.patel@example.com",
          address: "Shop 12, Crystal Plaza, Andheri West",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400053",
          defaultCommissionType: "PERCENTAGE" as const,
          defaultCommissionValue: 5.0,
          bankDetails: {
            accountHolderName: "Amit Patel",
            bankName: "HDFC Bank",
            accountNumber: "50100234567890",
            ifscCode: "HDFC0001234",
            branch: "Andheri West",
            upiId: "amit@hdfcbank",
          },
          panNumber: "ABCDE1234F",
          gstNumber: "27ABCDE1234F1Z5",
          aadhaarNumber: "123456789012",
          kycStatus: "PENDING" as const,
          status: "ACTIVE" as const,
          notes: "Key broker partner for luxury villas and 3BHK residences",
          additionalInformation: {
            tier: "Gold",
            preferredContact: "WhatsApp",
          },
        },
      };

      const result = createChannelPartnerSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("Amit Patel");
        expect(result.data.body.phone).toBe("+919876543210");
        expect(result.data.body.defaultCommissionType).toBe("PERCENTAGE");
        expect(result.data.body.defaultCommissionValue).toBe(5.0);
        expect(result.data.body.bankDetails?.bankName).toBe("HDFC Bank");
        expect(result.data.body.status).toBe("ACTIVE");
      }
    });

    it("should reject creation when mandatory fields (name or phone) are missing", () => {
      const invalidPayload = {
        body: {
          name: "",
          phone: "",
        },
      };

      const result = createChannelPartnerSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("should reject creation when email format is invalid", () => {
      const invalidPayload = {
        body: {
          name: "Suresh Kumar",
          phone: "+919876543210",
          email: "invalid-email-string",
        },
      };

      const result = createChannelPartnerSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("should default defaultCommissionType to PERCENTAGE and status to ACTIVE", () => {
      const minimalPayload = {
        body: {
          name: "Pooja Verma",
          phone: "+919812345678",
        },
      };

      const result = createChannelPartnerSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.defaultCommissionType).toBe("PERCENTAGE");
        expect(result.data.body.status).toBe("ACTIVE");
        expect(result.data.body.kycStatus).toBe("PENDING");
      }
    });
  });

  // =========================================================================
  // 3. Update Channel Partner & Integrated Status Validation
  // =========================================================================
  describe("Update Channel Partner Validation", () => {
    it("should allow partial dirty updates to partner information", () => {
      const updatePayload = {
        params: { id: MOCK_PARTNER_ID_1 },
        body: {
          companyName: "Patel Luxury Living LLP",
          defaultCommissionValue: 6.5,
        },
      };

      const result = updateChannelPartnerSchema.safeParse(updatePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.companyName).toBe("Patel Luxury Living LLP");
        expect(result.data.body.defaultCommissionValue).toBe(6.5);
      }
    });

    it("should directly update operational status (ACTIVE/INACTIVE/BLACKLISTED) on PATCH /:id", () => {
      const statusUpdatePayload = {
        params: { id: MOCK_PARTNER_ID_1 },
        body: {
          status: "BLACKLISTED" as const,
          notes: "Blacklisted due to duplicate lead submission",
        },
      };

      const result = updateChannelPartnerSchema.safeParse(statusUpdatePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.status).toBe("BLACKLISTED");
        expect(result.data.body.notes).toBe("Blacklisted due to duplicate lead submission");
      }
    });

    it("should directly update KYC verification status on PATCH /:id", () => {
      const kycUpdatePayload = {
        params: { id: MOCK_PARTNER_ID_1 },
        body: {
          kycStatus: "VERIFIED" as const,
          panNumber: "ABCDE9999F",
          kycDetails: {
            documentType: "PAN_CARD",
            remarks: "Original PAN verified by compliance officer",
          },
        },
      };

      const result = updateChannelPartnerSchema.safeParse(kycUpdatePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.kycStatus).toBe("VERIFIED");
        expect(result.data.body.panNumber).toBe("ABCDE9999F");
      }
    });

    it("should reject update when partner ID is not a valid UUID", () => {
      const invalidIdPayload = {
        params: { id: "not-a-valid-uuid" },
        body: {
          name: "Updated Name",
        },
      };

      const result = updateChannelPartnerSchema.safeParse(invalidIdPayload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Partner Query Filters & Pagination Validation
  // =========================================================================
  describe("Get Channel Partners Query Validation", () => {
    it("should provide default pagination values (page: 1, limit: 10, sortBy: createdAt)", () => {
      const query = {
        query: {},
      };

      const result = getChannelPartnersQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.limit).toBe(10);
        expect(result.data.query.sortBy).toBe("createdAt");
        expect(result.data.query.sortOrder).toBe("desc");
      }
    });

    it("should validate search, status, and KYC query parameters", () => {
      const query = {
        query: {
          page: "2",
          limit: "25",
          search: "Patel",
          status: "ACTIVE",
          kycStatus: "VERIFIED",
          partnerType: "REAL_ESTATE_AGENT",
          sortBy: "name",
          sortOrder: "asc",
        },
      };

      const result = getChannelPartnersQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(2);
        expect(result.data.query.limit).toBe(25);
        expect(result.data.query.search).toBe("Patel");
        expect(result.data.query.status).toBe("ACTIVE");
        expect(result.data.query.kycStatus).toBe("VERIFIED");
        expect(result.data.query.sortBy).toBe("name");
        expect(result.data.query.sortOrder).toBe("asc");
      }
    });

    it("should reject limit exceeding 100", () => {
      const query = {
        query: {
          limit: "200",
        },
      };

      const result = getChannelPartnersQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 5. Channel Partner ID Param Validation
  // =========================================================================
  describe("Partner ID Param Schema", () => {
    it("should accept valid UUID param", () => {
      const result = cpIdParamSchema.safeParse({ params: { id: MOCK_PARTNER_ID_1 } });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID param", () => {
      const result = cpIdParamSchema.safeParse({ params: { id: "12345" } });
      expect(result.success).toBe(false);
    });
  });
});
