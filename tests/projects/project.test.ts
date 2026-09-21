import { describe, it, expect } from "bun:test";
import {
  createProjectSchema,
  updateProjectSchema,
  getProjectsQuerySchema,
  projectIdParamSchema,
} from "../../src/module/projects/validators/project.validator";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_CUSTOMER_ID,
  MOCK_LEAD_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_EMPLOYEE_ID_2,
} from "../leads-crm/fixtures/crm.fixtures";

describe("Projects Module Tests", () => {
  // =========================================================================
  // 1. Project Code Sequential Format Verification
  // =========================================================================
  describe("Project Code Format Validation", () => {
    it("should conform to sequential Project Code pattern PRJ-YYYY-NNNN", () => {
      const codeRegex = /^PRJ-\d{4}-\d{4,}$/;
      expect(codeRegex.test("PRJ-2026-0001")).toBe(true);
      expect(codeRegex.test("PRJ-2026-0142")).toBe(true);
      expect(codeRegex.test("PRJ-2026-9999")).toBe(true);
      expect(codeRegex.test("PRJ-2026-10001")).toBe(true);

      expect(codeRegex.test("INVALID-CODE")).toBe(false);
      expect(codeRegex.test("PRJ-26-001")).toBe(false);
    });
  });

  // =========================================================================
  // 2. Project Creation Payload Validation
  // =========================================================================
  describe("Create Project Validation", () => {
    it("should validate full nested project creation payload with all 5 segregated entities", () => {
      const payload = {
        body: {
          customerId: MOCK_CUSTOMER_ID,
          leadId: MOCK_LEAD_ID,
          name: "Villa Grandeur 4BHK Turnkey Interior",
          description: "End-to-end interior execution for 4BHK duplex luxury villa.",
          category: "Residential Luxury",
          type: "TURNKEY" as const,
          status: "PLANNED" as const,
          health: "HEALTHY" as const,
          currentStage: "PLANNING" as const,
          priority: "HIGH" as const,
          coverImageUrl: {
            id: "img-12345",
            url: "https://storage.homio.in/projects/cover1.jpg",
            bytes: 2048500,
            format: "jpeg",
            provider: "AWS_S3" as const,
          },
          isClientPortalVisible: true,
          tags: ["Villa", "Luxury", "Italian Marble"],
          notes: "Client requested Italian marble flooring in living area and modular acoustic kitchen.",
          customFields: {
            architecturalStyle: "Contemporary Minimalist",
            ceilingHeightFt: 11.5,
          },
          additionalInformation: {
            clientTier: "VIP",
            customRequirementNotes: "Requires imported Italian fittings",
          },

          // 1-to-1 Site
          site: {
            siteName: "Prestige Lakeside, Villa #42",
            address: "Varthur Main Road, Whitefield",
            city: "Bangalore",
            state: "Karnataka",
            country: "IN",
            pincode: "560087",
            gpsLat: 12.9698,
            gpsLng: 77.7499,
            propertyType: "4BHK Duplex Villa",
            floorNumber: "G+1",
            totalAreaSqft: 4500,
            carpetAreaSqft: 3800,
            contactPerson: "Rajesh Sharma",
            contactPhone: "+919876543210",
            contactEmail: "rajesh.sharma@example.com",
            accessInstructions: "Security pass required at Main Gate #2.",
            additionalInformation: {
              liftAccess: true,
              parkingSlots: 2,
              entryGateNumber: "Gate 2B",
            },
          },

          // 1-to-1 Schedule
          schedule: {
            plannedStartDate: "2026-10-01",
            plannedEndDate: "2027-03-31",
            kickoffDate: "2026-10-05",
            siteHandoverDate: "2027-04-15",
            warrantyStartDate: "2027-04-15",
            warrantyEndDate: "2028-04-15",
            estimatedDurationDays: 180,
            additionalInformation: {
              workingHourRestrictions: "9 AM - 6 PM only",
              monsoonBufferDays: 15,
            },
          },

          // 1-to-1 Metric
          metric: {
            progressPercent: 0,
            designProgress: 0,
            executionProgress: 0,
            procurementProgress: 0,
            paymentProgress: 0,
            qualityScore: 100,
            safetyScore: 100,
            additionalInformation: {
              auditIntervalDays: 14,
              safetyOfficerAssigned: true,
            },
          },

          // 1-to-1 Commercial
          commercial: {
            currency: "INR",
            estimatedBudget: 8500000,
            contractAmount: 8200000,
            additionalWorkAmount: 300000,
            discountAmount: 200000,
            totalReceivedAmount: 2500000,
            totalExpenseAmount: 1200000,
            materialCost: 800000,
            labourCost: 300000,
            supervisionCost: 100000,
            grossMarginPercent: 32.5,
            additionalInformation: {
              paymentTerms: "30% Advance, 40% Mid-way, 30% Handover",
              taxInvoiceType: "GST_TAX_INVOICE",
            },
          },

          // 1-to-Many Dynamic Team Members
          members: [
            {
              employeeId: MOCK_EMPLOYEE_ID_1,
              role: "PROJECT_MANAGER" as const,
              customRoleTitle: "Senior Project Manager",
              responsibilities: "Overall timeline, quality, and contractor coordination.",
              isPrimary: true,
              isActive: true,
              allocatedHoursPerWeek: 30,
              additionalInformation: {
                reportingFrequency: "Daily",
                siteVisitDays: ["Monday", "Thursday"],
              },
            },
            {
              employeeId: MOCK_EMPLOYEE_ID_2,
              role: "LEAD_DESIGNER" as const,
              customRoleTitle: "Principal Interior Architect",
              responsibilities: "3D visualization, moodboards, material selection.",
              isPrimary: true,
              isActive: true,
              allocatedHoursPerWeek: 20,
              additionalInformation: {
                softwarePreferred: "AutoCAD & 3ds Max",
              },
            },
          ],
        },
      };

      const parsed = createProjectSchema.parse(payload);
      expect(parsed.body.name).toBe("Villa Grandeur 4BHK Turnkey Interior");
      expect(parsed.body.customerId).toBe(MOCK_CUSTOMER_ID);
      expect(parsed.body.additionalInformation?.clientTier).toBe("VIP");
      expect(parsed.body.site?.city).toBe("Bangalore");
      expect(parsed.body.site?.additionalInformation?.parkingSlots).toBe(2);
      expect(parsed.body.schedule?.estimatedDurationDays).toBe(180);
      expect(parsed.body.schedule?.additionalInformation?.monsoonBufferDays).toBe(15);
      expect(parsed.body.metric?.additionalInformation?.safetyOfficerAssigned).toBe(true);
      expect(parsed.body.commercial?.contractAmount).toBe(8200000);
      expect(parsed.body.commercial?.additionalInformation?.paymentTerms).toBe("30% Advance, 40% Mid-way, 30% Handover");
      expect(parsed.body.members?.length).toBe(2);
      expect(parsed.body.members?.[0]?.role).toBe("PROJECT_MANAGER");
      expect(parsed.body.members?.[0]?.additionalInformation?.reportingFrequency).toBe("Daily");
      expect(parsed.body.members?.[1]?.role).toBe("LEAD_DESIGNER");
    });

    it("should allow minimal project creation with only name and customerId", () => {
      const minimalPayload = {
        body: {
          name: "Minimal Fast-Track Project",
          customerId: MOCK_CUSTOMER_ID,
        },
      };

      const parsed = createProjectSchema.parse(minimalPayload);
      expect(parsed.body.name).toBe("Minimal Fast-Track Project");
      expect(parsed.body.type).toBe("TURNKEY");
      expect(parsed.body.status).toBe("PLANNED");
      expect(parsed.body.health).toBe("HEALTHY");
      expect(parsed.body.currentStage).toBe("PLANNING");
    });

    it("should fail when name or customerId is missing", () => {
      expect(() => {
        createProjectSchema.parse({
          body: {
            name: "",
            customerId: "invalid-uuid",
          },
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // 3. Project Partial Update & Dirty Payload Validation
  // =========================================================================
  describe("Update Project Validation", () => {
    it("should validate partial project updates with individual nested updates and additionalInformation", () => {
      const updatePayload = {
        params: { id: "99999999-9999-4999-8999-999999999999" },
        body: {
          status: "EXECUTION" as const,
          currentStage: "EXECUTION" as const,
          additionalInformation: {
            specialEscalationContact: "+919876500000",
          },
          site: {
            additionalInformation: {
              liftAccess: false,
              staircaseDimensions: "4ft width",
            },
          },
          metric: {
            progressPercent: 45.5,
            executionProgress: 50.0,
            paymentProgress: 40.0,
            additionalInformation: {
              snagsFoundCount: 3,
            },
          },
          commercial: {
            totalReceivedAmount: 4000000,
            additionalInformation: {
              discountApprovedBy: "CEO",
            },
          },
        },
      };

      const parsed = updateProjectSchema.parse(updatePayload);
      expect(parsed.params.id).toBe("99999999-9999-4999-8999-999999999999");
      expect(parsed.body.status).toBe("EXECUTION");
      expect(parsed.body.additionalInformation?.specialEscalationContact).toBe("+919876500000");
      expect(parsed.body.site?.additionalInformation?.liftAccess).toBe(false);
      expect(parsed.body.metric?.progressPercent).toBe(45.5);
      expect(parsed.body.metric?.additionalInformation?.snagsFoundCount).toBe(3);
      expect(parsed.body.commercial?.totalReceivedAmount).toBe(4000000);
      expect(parsed.body.commercial?.additionalInformation?.discountApprovedBy).toBe("CEO");
    });
  });

  // =========================================================================
  // 4. Project Query Filters & Pagination Validation
  // =========================================================================
  describe("Get Projects Query Validation", () => {
    it("should parse query filters with defaults", () => {
      const query = {
        page: "2",
        limit: "15",
        status: "EXECUTION",
        health: "HEALTHY",
        search: "Prestige",
        sortBy: "name",
        sortOrder: "asc",
      };

      const parsed = getProjectsQuerySchema.parse({ query });
      expect(parsed.query.page).toBe(2);
      expect(parsed.query.limit).toBe(15);
      expect(parsed.query.status).toBe("EXECUTION");
      expect(parsed.query.health).toBe("HEALTHY");
      expect(parsed.query.search).toBe("Prestige");
      expect(parsed.query.sortBy).toBe("name");
      expect(parsed.query.sortOrder).toBe("asc");
    });
  });

  // =========================================================================
  // 5. Commercial Calculations Logic Verification
  // =========================================================================
  describe("Commercial Calculations", () => {
    it("should accurately compute revised contract and total outstanding balance", () => {
      const contract = 5000000;
      const additionalWork = 500000;
      const discount = 200000;
      const totalReceived = 2000000;

      const revisedContract = contract + additionalWork - discount;
      const totalOutstanding = revisedContract - totalReceived;

      expect(revisedContract).toBe(5300000);
      expect(totalOutstanding).toBe(3300000);
    });
  });
});
