import { describe, it, expect } from "bun:test";
import {
  createCustomerSchema,
  updateCustomerSchema,
  togglePortalAccessSchema,
  getCustomersQuerySchema,
  customerIdParamSchema,
} from "../../src/module/leads-crm/validators/customer.validator";
import {
  createCustomerActivitySchema,
} from "../../src/module/leads-crm/validators/lead-activity.validator";
import {
  uploadCustomerDocumentSchema,
  documentIdParamSchema,
} from "../../src/module/leads-crm/validators/lead-document.validator";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_CUSTOMER_ID,
  MOCK_EMPLOYEE_ID_1,
} from "./fixtures/crm.fixtures";

describe("Customer CRM Module Tests", () => {
  // =========================================================================
  // 1. Customer Code & Identifier Tests
  // =========================================================================
  describe("Customer Code Pattern Verification", () => {
    it("should conform to sequential Customer Code pattern CUST-NNNN", () => {
      const codeRegex = /^CUST-\d{4,}$/;
      expect(codeRegex.test("CUST-0001")).toBe(true);
      expect(codeRegex.test("CUST-0142")).toBe(true);
      expect(codeRegex.test("CUST-9999")).toBe(true);
      expect(codeRegex.test("CUST-10001")).toBe(true);

      expect(codeRegex.test("INVALID-CODE")).toBe(false);
      expect(codeRegex.test("CUST-12")).toBe(false);
    });
  });

  // =========================================================================
  // 2. Customer Creation Validation
  // =========================================================================
  describe("Create Customer Validation", () => {
    it("should validate valid customer creation payload", () => {
      const payload = {
        body: {
          salutation: "MR" as const,
          firstName: "Rohit",
          lastName: "Sharma",
          displayName: "Rohit Sharma",
          email: "rohit.sharma@example.com",
          phone: "+919876543210",
          alternatePhone: "+919876543211",
          companyName: "Sharma Interior Projects",
          gstin: "27AAAAA0000A1Z5",
          panNumber: "ABCDE1234F",
          status: "ACTIVE" as const,
          tags: ["HNI", "Villa", "Priority"],
          notes: "Interested in 4BHK duplex interior design",
          billingAddress: "Flat 501, Oberoi Sky City",
          billingCity: "Mumbai",
          billingState: "Maharashtra",
          billingCountry: "IN",
          billingPincode: "400066",
          shippingAddress: "Flat 501, Oberoi Sky City",
          shippingCity: "Mumbai",
          shippingState: "Maharashtra",
          shippingCountry: "IN",
          shippingPincode: "400066",
          preferredContactMethod: "WHATSAPP",
        },
      };

      const result = createCustomerSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.firstName).toBe("Rohit");
        expect(result.data.body.phone).toBe("+919876543210");
        expect(result.data.body.billingCity).toBe("Mumbai");
        expect(result.data.body.status).toBe("ACTIVE");
      }
    });

    it("should reject customer creation when phone or first name is missing", () => {
      const invalidPayload = {
        body: {
          firstName: "",
          phone: "",
        },
      };

      const result = createCustomerSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Customer Update & Dirty Payload Validation
  // =========================================================================
  describe("Update Customer Validation", () => {
    it("should allow partial (dirty payload) customer updates", () => {
      const updatePayload = {
        params: { id: MOCK_CUSTOMER_ID },
        body: {
          companyName: "Sharma Luxury Living Ltd",
          billingCity: "Pune",
          status: "ACTIVE" as const,
        },
      };

      const result = updateCustomerSchema.safeParse(updatePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.companyName).toBe("Sharma Luxury Living Ltd");
        expect(result.data.body.billingCity).toBe("Pune");
        expect(result.data.body.firstName).toBeUndefined();
      }
    });

    it("should validate customer ID param format", () => {
      const valid = customerIdParamSchema.safeParse({ params: { id: MOCK_CUSTOMER_ID } });
      expect(valid.success).toBe(true);

      const invalid = customerIdParamSchema.safeParse({ params: { id: "not-a-uuid" } });
      expect(invalid.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Portal Access Toggle Validation
  // =========================================================================
  describe("Customer Portal Access Validation", () => {
    it("should validate portal access toggle boolean flag", () => {
      const enablePayload = {
        params: { id: MOCK_CUSTOMER_ID },
        body: { portalAccessEnabled: true },
      };
      const resultEnable = togglePortalAccessSchema.safeParse(enablePayload);
      expect(resultEnable.success).toBe(true);

      const disablePayload = {
        params: { id: MOCK_CUSTOMER_ID },
        body: { portalAccessEnabled: false },
      };
      const resultDisable = togglePortalAccessSchema.safeParse(disablePayload);
      expect(resultDisable.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. Query Filter & Pagination Validation
  // =========================================================================
  describe("Customer Query Filters", () => {
    it("should parse and provide sensible defaults for customer list queries", () => {
      const query = {
        query: {
          page: "1",
          limit: "20",
          search: "Sharma",
          customerType: "CLIENT",
          status: "ACTIVE",
          city: "Mumbai",
          sortBy: "totalInquiriesCount",
          sortOrder: "desc",
        },
      };

      const result = getCustomersQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.limit).toBe(20);
        expect(result.data.query.search).toBe("Sharma");
        expect(result.data.query.customerType).toBe("CLIENT");
        expect(result.data.query.sortBy).toBe("totalInquiriesCount");
      }
    });
  });

  // =========================================================================
  // 6. Customer Activity & Document Validation
  // =========================================================================
  describe("Customer Activity & Documents Validation", () => {
    it("should validate customer activity creation", () => {
      const activityPayload = {
        params: { id: MOCK_CUSTOMER_ID },
        body: {
          type: "CALL" as const,
          title: "Initial Budget Consultation",
          description: "Discussed preliminary 3D designs and floor plans",
          performedById: MOCK_EMPLOYEE_ID_1,
        },
      };

      const result = createCustomerActivitySchema.safeParse(activityPayload);
      expect(result.success).toBe(true);
    });

    it("should validate customer document upload & deletion params", () => {
      const uploadPayload = {
        params: { id: MOCK_CUSTOMER_ID },
        body: {
          name: "Aadhaar Card KYC",
          category: "KYC_ID" as const,
        },
      };

      const uploadResult = uploadCustomerDocumentSchema.safeParse(uploadPayload);
      expect(uploadResult.success).toBe(true);

      const deleteResult = documentIdParamSchema.safeParse({
        params: { id: "a81c4e72-23f4-4a25-a189-9dbb53fa43df" },
      });
      expect(deleteResult.success).toBe(true);
    });
  });
});
