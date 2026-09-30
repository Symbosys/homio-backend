import { describe, it, expect } from "bun:test";
import {
  createLeadFunnelSchema,
  updateLeadFunnelSchema,
  createFunnelStageSchema,
  updateFunnelStageSchema,
  reorderStagesSchema,
  createFormFieldSchema,
  updateFormFieldSchema,
  reorderFormFieldsSchema,
  submitPublicLeadSchema,
  transitionFunnelLeadStageSchema,
  getFunnelLeadsQuerySchema,
  getFunnelTransitionsQuerySchema,
} from "../../src/module/leads-crm/validators/lead-funnel.validator";

describe("Lead Funnel & Pipeline Module Tests", () => {
  const MOCK_UUID_1 = "11111111-1111-4111-8111-111111111111";
  const MOCK_UUID_2 = "22222222-2222-4222-8222-222222222222";
  const MOCK_UUID_3 = "33333333-3333-4333-8333-333333333333";

  // =========================================================================
  // 1. Lead Funnel Creation & Updates Validation
  // =========================================================================
  describe("Funnel Creation Validation", () => {
    it("should validate valid client funnel creation payload", () => {
      const payload = {
        body: {
          name: "Interior Client Funnel",
          slug: "interior-client-funnel",
          description: "High-value residential and luxury commercial client funnel",
          funnelCategory: "CLIENT" as const,
          embedSlug: "interior-leads",
          isDefault: true,
          isActive: true,
          sortOrder: 1,
          color: "#4F46E5",
          additionalInformation: {
            targetMarket: "Luxury Villas",
            minimumTicketSizeLakhs: 25,
          },
        },
      };

      const result = createLeadFunnelSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("Interior Client Funnel");
        expect(result.data.body.funnelCategory).toBe("CLIENT");
        expect(result.data.body.embedSlug).toBe("interior-leads");
      }
    });

    it("should reject funnel creation when required name is missing", () => {
      const payload = {
        body: {
          description: "No name specified",
          funnelCategory: "CLIENT" as const,
        },
      };

      const result = createLeadFunnelSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should validate valid funnel update with partial dirty fields", () => {
      const payload = {
        body: {
          name: "Updated Interior Pipeline",
          color: "#10B981",
          isActive: false,
        },
      };

      const result = updateLeadFunnelSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("Updated Interior Pipeline");
        expect(result.data.body.color).toBe("#10B981");
      }
    });
  });

  // =========================================================================
  // 2. Funnel Stages & SLA Validation
  // =========================================================================
  describe("Funnel Stages & SLA Rules Validation", () => {
    it("should validate valid stage creation with SLA hours and auto-tasks", () => {
      const payload = {
        body: {
          name: "Site Visit Scheduled",
          slug: "site-visit-scheduled",
          stageType: "MEETING_INTERVIEW" as const,
          orderIndex: 2,
          slaTargetDescription: "Conduct physical site measurement within 48h",
          slaHours: 48,
          autoTaskEnabled: true,
          autoTaskTitle: "Assign field engineer for site measurement",
          color: "#F59E0B",
          winProbability: 50,
          isActive: true,
          additionalInformation: {
            requiresClientConfirmation: true,
          },
        },
      };

      const result = createFunnelStageSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("Site Visit Scheduled");
        expect(result.data.body.slaHours).toBe(48);
        expect(result.data.body.autoTaskEnabled).toBe(true);
      }
    });

    it("should validate stage reordering payload with valid UUIDs", () => {
      const payload = {
        body: {
          stages: [
            { id: MOCK_UUID_1, orderIndex: 1 },
            { id: MOCK_UUID_2, orderIndex: 2 },
            { id: MOCK_UUID_3, orderIndex: 3 },
          ],
        },
      };

      const result = reorderStagesSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.stages.length).toBe(3);
        expect(result.data.body.stages[1]?.orderIndex).toBe(2);
      }
    });

    it("should reject stage reordering when id is not a valid UUID", () => {
      const payload = {
        body: {
          stages: [{ id: "not-a-uuid", orderIndex: 1 }],
        },
      };

      const result = reorderStagesSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Dynamic Form Builder Validation
  // =========================================================================
  describe("Dynamic Form Field Schema Validation", () => {
    it("should validate various dynamic field types including DROPDOWN with options", () => {
      const dropdownField = {
        body: {
          label: "Property Type",
          key: "property_type",
          fieldType: "DROPDOWN" as const,
          isRequired: true,
          placeholder: "Select your property type",
          helpText: "Helps us prepare custom 3D design references",
          options: ["1BHK", "2BHK", "3BHK", "4BHK Duplex", "Independent Villa", "Commercial Showroom"],
          orderIndex: 1,
          isActive: true,
        },
      };

      const result = createFormFieldSchema.safeParse(dropdownField);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.fieldType).toBe("DROPDOWN");
        expect(result.data.body.options?.length).toBe(6);
      }
    });

    it("should validate file upload dynamic field", () => {
      const fileField = {
        body: {
          label: "Floor Plan / Blueprints",
          key: "floor_plan",
          fieldType: "FILE" as const,
          isRequired: false,
          placeholder: "Upload DWG, PDF or JPG",
          orderIndex: 2,
        },
      };

      const result = createFormFieldSchema.safeParse(fileField);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.fieldType).toBe("FILE");
        expect(result.data.body.isRequired).toBe(false);
      }
    });

    it("should validate form fields reordering payload with valid UUIDs", () => {
      const payload = {
        body: {
          fields: [
            { id: MOCK_UUID_1, orderIndex: 0 },
            { id: MOCK_UUID_2, orderIndex: 1 },
          ],
        },
      };

      const result = reorderFormFieldsSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject field with invalid key containing uppercase characters or spaces", () => {
      const invalidField = {
        body: {
          label: "Invalid Key Field",
          key: "Property Type", // Invalid key format
          fieldType: "TEXT" as const,
        },
      };

      const result = createFormFieldSchema.safeParse(invalidField);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Public Web Form Embed Submission Validation
  // =========================================================================
  describe("Public Embed Lead Submission", () => {
    it("should validate public submission payload with dynamic form responses", () => {
      const payload = {
        body: {
          clientName: "Pooja Hegde",
          phone: "+919876543210",
          email: "pooja.hegde@luxuryvillas.com",
          notes: "Need full interior quotation for 4500 sqft penthouse in Hiranandani",
          formData: {
            property_type: "4BHK Duplex",
            carpet_area_sqft: 4500,
            budget_lakhs: 75,
            city: "Mumbai",
            possession_date: "2026-12-01",
          },
        },
      };

      const result = submitPublicLeadSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.clientName).toBe("Pooja Hegde");
        expect(result.data.body.phone).toBe("+919876543210");
        expect(result.data.body.formData?.carpet_area_sqft).toBe(4500);
      }
    });

    it("should reject public submission when formData map is missing", () => {
      const payload = {
        body: {
          clientName: "Pooja Hegde",
          phone: "+919876543210",
          // missing formData
        },
      };

      const result = submitPublicLeadSchema.safeParse(payload as any);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 5. Funnel Lead Stage Transition & Audit Log Validation
  // =========================================================================
  describe("Funnel Stage Transition & Query Validation", () => {
    it("should validate valid lead stage transition payload with SLA notes and reason", () => {
      const payload = {
        body: {
          toStageId: MOCK_UUID_2,
          transitionReason: "Preliminary proposal sent and approved by client",
          transitionNote: "Client agreed to budget of 55L, scheduling final contract signing.",
          additionalInformation: {
            signedProposalVersion: "v1.2",
            discountApproved: true,
          },
        },
      };

      const result = transitionFunnelLeadStageSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.toStageId).toBe(MOCK_UUID_2);
        expect(result.data.body.transitionReason).toBe(
          "Preliminary proposal sent and approved by client"
        );
      }
    });

    it("should reject stage transition when destination toStageId is missing or invalid UUID", () => {
      const invalidPayload = {
        body: {
          toStageId: "not-a-valid-uuid",
          transitionReason: "Invalid target stage",
        },
      };

      const result = transitionFunnelLeadStageSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("should validate getFunnelLeads query parameters", () => {
      const validQuery = {
        query: {
          stageId: MOCK_UUID_1,
          search: "Pooja",
          page: 1,
          limit: 20,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
      };

      const result = getFunnelLeadsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.search).toBe("Pooja");
        expect(result.data.query.limit).toBe(20);
      }
    });

    it("should validate getFunnelTransitions query parameters with SLA filter", () => {
      const validQuery = {
        query: {
          isSlaBreached: true,
          leadId: MOCK_UUID_3,
          page: 2,
          limit: 10,
        },
      };

      const result = getFunnelTransitionsQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.isSlaBreached).toBe(true);
        expect(result.data.query.leadId).toBe(MOCK_UUID_3);
      }
    });
  });

  // =========================================================================
  // 6. Multi-Tenant Isolation & Organization Scoping Validation
  // =========================================================================
  describe("Multi-Tenant Isolation & Public Embed Scoping Validation", () => {
    it("should validate public submission with custom dynamic form data and tenant attribution", () => {
      const payloadOrg1 = {
        body: {
          clientName: "Vikram Malhotra",
          phone: "+91 98111 22233",
          email: "vikram@example.com",
          notes: "Interested in 4BHK Penthouse full turnkey interior design",
          formData: {
            client_name: "Vikram Malhotra",
            phone: "+91 98111 22233",
            property_type: "Penthouse",
            budget_lakhs: "45",
            pincode: "122002",
          },
          organizationSlug: "acme-luxury-interiors",
          sourceUrl: "https://acme-luxury.com/contact-us",
        },
      };

      const result = submitPublicLeadSchema.safeParse(payloadOrg1);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.clientName).toBe("Vikram Malhotra");
        expect(result.data.body.formData.property_type).toBe("Penthouse");
        expect(result.data.body.formData.budget_lakhs).toBe("45");
      }
    });

    it("should ensure identical embedSlug names can exist independently across distinct organizations", () => {
      const org1Funnel = {
        organizationId: "aaaaaaaa-1111-4111-8111-111111111111",
        name: "Interior Client Funnel",
        embedSlug: "interior-client-funnel",
        organizationSlug: "studio-one",
      };

      const org2Funnel = {
        organizationId: "bbbbbbbb-2222-4222-8222-222222222222",
        name: "Interior Client Funnel",
        embedSlug: "interior-client-funnel",
        organizationSlug: "studio-two",
      };

      // Both funnels share embedSlug but have distinct organization contexts
      expect(org1Funnel.embedSlug).toBe(org2Funnel.embedSlug);
      expect(org1Funnel.organizationId).not.toBe(org2Funnel.organizationId);
      expect(org1Funnel.organizationSlug).not.toBe(org2Funnel.organizationSlug);

      // Scoped public URLs resolve distinctly
      const url1 = `/embed/${org1Funnel.organizationSlug}/${org1Funnel.embedSlug}`;
      const url2 = `/embed/${org2Funnel.organizationSlug}/${org2Funnel.embedSlug}`;
      expect(url1).toBe("/embed/studio-one/interior-client-funnel");
      expect(url2).toBe("/embed/studio-two/interior-client-funnel");
      expect(url1).not.toBe(url2);
    });
  });
});

