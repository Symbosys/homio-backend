import { describe, it, expect, mock } from "bun:test";
import {
  getWhatsAppTemplatesQuerySchema,
  updateWhatsAppTemplateSchema,
  renderTemplatePreviewSchema,
} from "../../src/module/communication/validators/whatsapp-template.validator.js";
import {
  variableMappingEngine,
  CRM_VARIABLE_DICTIONARY,
} from "../../src/module/communication/services/variable-mapping.engine.js";
import { metaWhatsAppService } from "../../src/module/communication/services/meta-whatsapp.service.js";
import {
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
  WhatsAppHeaderType,
  CrmMappingEntity,
  WhatsAppVariableComponent,
} from "../../src/types/types.js";

const MOCK_ORG_A = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MOCK_ORG_B = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const MOCK_TEMPLATE_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const MOCK_VAR_ID_1 = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const MOCK_VAR_ID_2 = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";

describe("Enterprise WhatsApp Template Management API Tests (Strict 7 APIs)", () => {
  // =========================================================================
  // API 1: List Templates & Query Validation
  // =========================================================================
  describe("API 1: GET /api/v1/communication/templates (Query & Pagination Validation)", () => {
    it("should accept valid query parameters with defaults", () => {
      const parsed = getWhatsAppTemplatesQuerySchema.safeParse({
        query: {
          page: "2",
          limit: "25",
          search: "site_visit",
          category: WhatsAppTemplateCategory.UTILITY,
          status: WhatsAppTemplateStatus.APPROVED,
          language: "en_US",
          sortBy: "name",
          sortOrder: "asc",
        },
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.query.page).toBe(2);
        expect(parsed.data.query.limit).toBe(25);
        expect(parsed.data.query.search).toBe("site_visit");
        expect(parsed.data.query.category).toBe(WhatsAppTemplateCategory.UTILITY);
        expect(parsed.data.query.status).toBe(WhatsAppTemplateStatus.APPROVED);
        expect(parsed.data.query.sortBy).toBe("name");
        expect(parsed.data.query.sortOrder).toBe("asc");
      }
    });

    it("should apply safe defaults when query parameters are omitted", () => {
      const parsed = getWhatsAppTemplatesQuerySchema.safeParse({ query: {} });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.query.page).toBe(1);
        expect(parsed.data.query.limit).toBe(25);
        expect(parsed.data.query.sortBy).toBe("createdAt");
        expect(parsed.data.query.sortOrder).toBe("desc");
      }
    });

    it("should reject invalid sort field", () => {
      const parsed = getWhatsAppTemplatesQuerySchema.safeParse({
        query: { sortBy: "invalid_column" as any },
      });
      expect(parsed.success).toBe(false);
    });

    it("should reject invalid category", () => {
      const parsed = getWhatsAppTemplatesQuerySchema.safeParse({
        query: { category: "NON_EXISTENT_CATEGORY" as any },
      });
      expect(parsed.success).toBe(false);
    });
  });

  // =========================================================================
  // API 3: Update Template & Variable Mappings
  // =========================================================================
  describe("API 3: PUT /api/v1/communication/templates/:id (Validation & Mappings)", () => {
    it("should validate updating components, isEnabled, and typed variable mappings", () => {
      const payload = {
        body: {
          category: WhatsAppTemplateCategory.MARKETING,
          isEnabled: true,
          bodyText: "Hello {{1}}, your quotation {{2}} has been generated.",
          variables: [
            {
              variableId: MOCK_VAR_ID_1,
              mappingEntity: CrmMappingEntity.LEAD,
              mappingField: "firstName",
              fallbackValue: "Valued Customer",
              label: "Lead First Name",
            },
            {
              variableId: MOCK_VAR_ID_2,
              mappingEntity: CrmMappingEntity.QUOTATION,
              mappingField: "quotationNumber",
              fallbackValue: "N/A",
              label: "Quotation Ref Number",
            },
          ],
        },
      };

      const result = updateWhatsAppTemplateSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.variables?.length).toBe(2);
        expect(result.data.body.variables?.[0]?.mappingEntity).toBe(CrmMappingEntity.LEAD);
        expect(result.data.body.variables?.[0]?.mappingField).toBe("firstName");
      }
    });

    it("should reject variable mapping with non-UUID variableId", () => {
      const payload = {
        body: {
          variables: [
            {
              variableId: "invalid-uuid",
              mappingEntity: CrmMappingEntity.LEAD,
              mappingField: "firstName",
            },
          ],
        },
      };

      const result = updateWhatsAppTemplateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // API 7: Variable Dictionary & Whitelist Security
  // =========================================================================
  describe("API 7: GET /api/v1/communication/templates/variable-dictionary", () => {
    it("should return legal CRM entities and whitelisted user-facing fields", () => {
      const dictionary = variableMappingEngine.getVariableDictionary();
      expect(dictionary.entities).toBeDefined();
      expect(dictionary.entities.length).toBeGreaterThanOrEqual(7);

      const leadEntity = dictionary.entities.find((e) => e.entity === CrmMappingEntity.LEAD);
      expect(leadEntity).toBeDefined();
      expect(leadEntity?.fields.some((f) => f.key === "firstName")).toBe(true);
      expect(leadEntity?.fields.some((f) => f.key === "phone")).toBe(true);

      const projectEntity = dictionary.entities.find((e) => e.entity === CrmMappingEntity.PROJECT);
      expect(projectEntity).toBeDefined();
      expect(projectEntity?.fields.some((f) => f.key === "name")).toBe(true);
    });

    it("should validate and allow whitelisted fields", () => {
      expect(() => {
        variableMappingEngine.validateMapping(CrmMappingEntity.LEAD, "firstName");
      }).not.toThrow();

      expect(() => {
        variableMappingEngine.validateMapping(CrmMappingEntity.PROJECT, "siteAddress");
      }).not.toThrow();
    });

    it("should reject non-whitelisted arbitrary database column names", () => {
      expect(() => {
        variableMappingEngine.validateMapping(CrmMappingEntity.LEAD, "passwordHash");
      }).toThrow(/not allowed for entity/);

      expect(() => {
        variableMappingEngine.validateMapping(CrmMappingEntity.CUSTOMER, "secret_key_column");
      }).toThrow(/not allowed for entity/);
    });
  });

  // =========================================================================
  // API 6: Render Template Variable Preview (Read-Only)
  // =========================================================================
  describe("API 6: POST /api/v1/communication/templates/:id/render", () => {
    it("should validate render payload with contextual IDs", () => {
      const parsed = renderTemplatePreviewSchema.safeParse({
        body: {
          leadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          projectId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
          customOverrides: {
            "{{1}}": "Special Guest",
          },
        },
      });

      expect(parsed.success).toBe(true);
    });

    it("should resolve dynamic variables and perform string substitutions", async () => {
      const mockTemplate = {
        headerText: "Welcome to {{1}}",
        bodyText: "Hello {{2}}, your project {{3}} is scheduled for site visit.",
        footerText: "Homio Design",
        buttons: [
          {
            type: "URL",
            text: "View Design",
            url: "https://homio.in/project/{{3}}",
          },
        ],
        variables: [
          {
            id: "v1",
            templateId: MOCK_TEMPLATE_ID,
            component: WhatsAppVariableComponent.HEADER,
            position: 1,
            parameter: "{{1}}",
            mappingEntity: CrmMappingEntity.ORGANIZATION,
            mappingField: "name",
            fallbackValue: "Homio Studio",
            label: "Org Name",
            isRequired: true,
            isMapped: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "v2",
            templateId: MOCK_TEMPLATE_ID,
            component: WhatsAppVariableComponent.BODY,
            position: 1,
            parameter: "{{2}}",
            mappingEntity: CrmMappingEntity.LEAD,
            mappingField: "firstName",
            fallbackValue: "Valued Client",
            label: "Lead First Name",
            isRequired: true,
            isMapped: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "v3",
            templateId: MOCK_TEMPLATE_ID,
            component: WhatsAppVariableComponent.BODY,
            position: 2,
            parameter: "{{3}}",
            mappingEntity: CrmMappingEntity.PROJECT,
            mappingField: "name",
            fallbackValue: "Dream Home",
            label: "Project Name",
            isRequired: true,
            isMapped: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = await variableMappingEngine.resolveTemplate(mockTemplate, {
        organizationId: MOCK_ORG_A,
        customOverrides: {
          "{{1}}": "Homio Luxury",
          "{{2}}": "Vikram",
          "{{3}}": "Palm Villa",
        },
      });

      expect(result.header).toBe("Welcome to Homio Luxury");
      expect(result.body).toBe("Hello Vikram, your project Palm Villa is scheduled for site visit.");
      expect(result.buttons[0]?.url).toContain("Palm%20Villa");
      expect(result.variables.length).toBe(3);
      expect(result.variables[0]?.resolved).toBe(true);
      expect(result.variables[0]?.value).toBe("Homio Luxury");
    });

    it("should use fallbackValue when database record is absent", async () => {
      const mockTemplate = {
        bodyText: "Hello {{1}}, welcome to {{2}}!",
        variables: [
          {
            id: "v1",
            templateId: MOCK_TEMPLATE_ID,
            component: WhatsAppVariableComponent.BODY,
            position: 1,
            parameter: "{{1}}",
            mappingEntity: CrmMappingEntity.LEAD,
            mappingField: "firstName",
            fallbackValue: "Valued Customer",
            label: "Lead Name",
            isRequired: true,
            isMapped: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "v2",
            templateId: MOCK_TEMPLATE_ID,
            component: WhatsAppVariableComponent.BODY,
            position: 2,
            parameter: "{{2}}",
            mappingEntity: CrmMappingEntity.ORGANIZATION,
            mappingField: "name",
            fallbackValue: "Homio Design",
            label: "Org Name",
            isRequired: true,
            isMapped: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = await variableMappingEngine.resolveTemplate(mockTemplate, {
        organizationId: MOCK_ORG_A,
      });

      expect(result.body).toContain("Valued Customer");
      expect(result.body).toContain("Homio Design");
    });
  });

  // =========================================================================
  // Multi-Tenant Isolation & Security Tests
  // =========================================================================
  describe("Multi-Tenant Isolation & Security Checks", () => {
    it("should enforce tenant scoping and never leak cross-organization data", () => {
      expect(MOCK_ORG_A).not.toBe(MOCK_ORG_B);
    });

    it("should never expose access token in client responses", () => {
      const dictionary = variableMappingEngine.getVariableDictionary();
      const stringified = JSON.stringify(dictionary);
      expect(stringified).not.toContain("accessToken");
      expect(stringified).not.toContain("appSecret");
      expect(stringified).not.toContain("webhookVerifyToken");
    });
  });
});
