import { describe, expect, it } from "bun:test";
import {
  updateLeadDetailsSchema,
  createUpdateLeadDetailsTool,
} from "../../src/ai/tools/leads/update-lead-details.tool.js";
import {
  scheduleMeetingSchema,
  createScheduleMeetingTool,
} from "../../src/ai/tools/meeting/schedule-meeting.tool.js";
import { createTenantAiTools } from "../../src/ai/tools/index.js";
import { buildRagSystemPrompt } from "../../src/ai/prompt/rag.prompt.js";

const TEST_ORG_ID = "00000000-1111-2222-3333-444444444444";
const TEST_LEAD_ID = "11111111-2222-3333-4444-555555555555";
const TEST_CUSTOMER_ID = "22222222-3333-4444-5555-666666666666";
const TEST_CONV_ID = "33333333-4444-5555-6666-777777777777";

describe("Autonomous AI CRM Tools & Tool-Calling Test Suite", () => {
  // =========================================================================
  // 1. Zod Schema Validation Tests
  // =========================================================================
  describe("1. Tool Schema Validation", () => {
    it("should validate a complete updateLeadDetailsSchema payload", () => {
      const payload = {
        name: "Rohit Sharma",
        purposeOrGoal: "Complete 3BHK interior furnishing, modular kitchen, and false ceiling",
        projectType: "RESIDENTIAL" as const,
        budgetInLakh: 12.5,
        estimatedBudgetInr: 1250000,
        budgetDisplay: "12-15 Lakhs",
        propertyCity: "Bangalore",
        propertyName: "Prestige Lakeside Habitat",
        propertySizeSqft: 1650,
        possessionStatus: "READY_TO_MOVE",
        notes: "Client prefers contemporary Italian minimalist design",
        additionalInformation: [
          { key: "bhkConfig", value: "3BHK" },
          { key: "familySize", value: "4" },
          { key: "kitchenType", value: "L-Shaped Acrylic" },
        ],
      };

      const result = updateLeadDetailsSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Rohit Sharma");
        expect(result.data.budgetInLakh).toBe(12.5);
        expect(result.data.propertyCity).toBe("Bangalore");
        expect(result.data.additionalInformation?.[0]?.key).toBe("bhkConfig");
        expect(result.data.additionalInformation?.[0]?.value).toBe("3BHK");
      }
    });

    it("should allow partial updates in updateLeadDetailsSchema", () => {
      const partialPayload = {
        purposeOrGoal: "Modular kitchen renovation",
        propertyCity: "Pune",
      };

      const result = updateLeadDetailsSchema.safeParse(partialPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purposeOrGoal).toBe("Modular kitchen renovation");
        expect(result.data.propertyCity).toBe("Pune");
      }
    });

    it("should validate scheduleMeetingSchema with valid timings and modes", () => {
      const payload = {
        title: "Initial Concept Design Consultation",
        meetingType: "ONLINE" as const,
        meetingDate: "2026-10-10",
        startTime: "11:00 AM",
        durationMinutes: 45,
        agenda: "Review 3BHK floor plan and discuss material preferences",
      };

      const result = scheduleMeetingSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Initial Concept Design Consultation");
        expect(result.data.meetingType).toBe("ONLINE");
        expect(result.data.meetingDate).toBe("2026-10-10");
        expect(result.data.durationMinutes).toBe(45);
      }
    });

    it("should validate scheduleMeetingSchema with in-person office meeting", () => {
      const payload = {
        meetingType: "OFFLINE" as const,
        meetingDate: "2026-10-12",
        startTime: "3:30 PM",
        locationName: "Homio Design Studio Indiranagar",
        locationAddress: "100 Feet Road, Indiranagar, Bangalore",
      };

      const result = scheduleMeetingSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meetingType).toBe("OFFLINE");
        expect(result.data.locationName).toBe("Homio Design Studio Indiranagar");
      }
    });
  });

  // =========================================================================
  // 2. Tool Factory & LangChain Registration
  // =========================================================================
  describe("2. Tool Factory & LangChain Tool Creation", () => {
    it("should instantiate tenant tools with proper names and descriptions", () => {
      const tools = createTenantAiTools({
        organizationId: TEST_ORG_ID,
        leadId: TEST_LEAD_ID,
        customerId: TEST_CUSTOMER_ID,
        conversationId: TEST_CONV_ID,
      });

      expect(tools).toHaveLength(2);

      const updateTool = tools.find((t) => t.name === "update_lead_details");
      expect(updateTool).toBeDefined();
      expect(updateTool?.name).toBe("update_lead_details");
      expect(updateTool?.description).toContain("lead profile");

      const meetingTool = tools.find((t) => t.name === "schedule_meeting");
      expect(meetingTool).toBeDefined();
      expect(meetingTool?.name).toBe("schedule_meeting");
      expect(meetingTool?.description).toContain("meeting");
    });
  });

  // =========================================================================
  // 3. System Prompt & Multi-Language Persona Rules
  // =========================================================================
  describe("3. System Prompt Construction & Multi-Language Persona", () => {
    it("should construct prompt containing language matching, lead profiling, and meeting scheduling instructions", () => {
      const prompt = buildRagSystemPrompt({
        organizationName: "Homio Interiors",
        senderName: "Priya Patel",
        toonContext: "customer(name: Priya Patel, phone: +919876543210)",
        conversationSummary: "Client interested in full 2BHK interior work.",
      });

      expect(prompt).toContain("Homio Interiors");
      expect(prompt).toContain("Priya Patel");
      expect(prompt).toContain("LANGUAGE MATCHING");
      expect(prompt).toContain("Hindi");
      expect(prompt).toContain("English");
      expect(prompt).toContain("update_lead_details");
      expect(prompt).toContain("schedule_meeting");
      expect(prompt).toContain("TYPO TOLERANCE");
      expect(prompt).toContain("CRM CONTEXT (TOON)");
      expect(prompt).toContain("CONVERSATION SUMMARY");
    });
  });
});
