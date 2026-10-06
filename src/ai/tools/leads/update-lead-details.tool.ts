import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  LeadProjectType,
  LeadStatus,
  Prisma,
} from "../../../types/types.js";

/**
 * Contextual metadata injected when creating the tool instance for a specific tenant conversation.
 */
export interface LeadToolContext {
  organizationId: string;
  leadId?: string | null;
  customerId?: string | null;
  conversationId?: string | null;
}

/**
 * Zod validation schema for updating lead details extracted from user conversation.
 */
export const updateLeadDetailsSchema = z.object({
  name: z
    .string()
    .optional()
    .describe("Full name or first name of the client/customer if provided."),
  purposeOrGoal: z
    .string()
    .optional()
    .describe(
      "The client's interior requirement, purpose, or goal (e.g. 'Complete 3BHK interior furnishing', 'Modular kitchen and wardrobe', 'Full house renovation').",
    ),
  projectType: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "PLANNING_2D", "RENOVATION", "OTHER"])
    .optional()
    .describe("Classification of the project type."),
  budgetInLakh: z
    .number()
    .optional()
    .describe("Estimated budget in Lakhs (e.g., 5 for 5 Lakhs, 12.5 for 12.5 Lakhs)."),
  estimatedBudgetInr: z
    .number()
    .optional()
    .describe("Total estimated budget in INR (e.g. 500000)."),
  budgetDisplay: z
    .string()
    .optional()
    .describe("Human-readable budget display (e.g. '5-7 Lakhs', '₹15 L', 'Under 10 Lakhs')."),
  propertyName: z
    .string()
    .optional()
    .describe("Name of the apartment, project, society, or villa (e.g., 'Prestige Lakeside Habitat')."),
  propertySizeSqft: z
    .number()
    .optional()
    .describe("Carpet or super built-up area in square feet (e.g. 1200)."),
  propertyCity: z
    .string()
    .optional()
    .describe("City where the property/site is located (e.g., 'Bangalore', 'Mumbai', 'Pune')."),
  propertyState: z
    .string()
    .optional()
    .describe("State where the property is located (e.g., 'Karnataka', 'Maharashtra')."),
  propertyAddress: z
    .string()
    .optional()
    .describe("Full property address, locality, or landmark."),
  propertyPincode: z
    .string()
    .optional()
    .describe("Postal PIN code of the site location."),
  possessionStatus: z
    .string()
    .optional()
    .describe("Possession readiness (e.g. 'READY_TO_MOVE', 'UNDER_CONSTRUCTION', 'RENOVATION')."),
  notes: z
    .string()
    .optional()
    .describe("Any special client preferences, design styles, timeline, or notes."),
  additionalInformation: z
    .array(
      z.object({
        key: z.string().describe("Attribute name (e.g. 'bhkType', 'preferredStyle', 'renovationScope', 'timeline')"),
        value: z.string().describe("Attribute value (e.g. '3BHK', 'Modern Contemporary', 'Kitchen & Living Room', 'Within 2 months')"),
      }),
    )
    .optional()
    .describe(
      "Any additional custom attributes extracted from user conversation not covered by standard columns.",
    ),
});

export type UpdateLeadDetailsInput = z.infer<typeof updateLeadDetailsSchema>;

/**
 * Creates a LangChain Dynamic Structured Tool for autonomously updating lead & customer details.
 *
 * @param context - Scoped tenant execution context
 */
export function createUpdateLeadDetailsTool(context: LeadToolContext) {
  const { organizationId, leadId, customerId, conversationId } = context;

  return tool(
    async (input: UpdateLeadDetailsInput) => {
      console.log(
        `[Tool:update_lead_details] Invoked for Org "${organizationId}", Lead "${leadId}", Customer "${customerId}" with input:`,
        input,
      );

      let targetLeadId = leadId;
      let targetCustomerId = customerId;

      // If leadId was not directly passed in context, resolve from conversation
      if (!targetLeadId && conversationId) {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { leadId: true, lead: { select: { customerId: true } } },
        });
        targetLeadId = conv?.leadId;
        if (!targetCustomerId) targetCustomerId = conv?.lead?.customerId;
      }

      if (!targetLeadId) {
        return {
          success: false,
          message:
            "No active CRM lead found linked to this conversation to update. Please continue conversation.",
        };
      }

      // Fetch existing lead data to perform safe dirty / non-destructive merges
      const existingLead = await prisma.lead.findFirst({
        where: { id: targetLeadId, organizationId, isDeleted: false },
        include: { customer: true },
      });

      if (!existingLead) {
        return {
          success: false,
          message: `Lead "${targetLeadId}" not found for organization.`,
        };
      }

      // 1. Update Customer Record if customer name is provided
      if (input.name && input.name.trim()) {
        const trimmedName = input.name.trim();
        const parts = trimmedName.split(" ");
        const firstName = parts[0] || trimmedName;
        const lastName = parts.slice(1).join(" ") || undefined;

        if (existingLead.customerId) {
          try {
            await prisma.customer.update({
              where: { id: existingLead.customerId },
              data: {
                firstName,
                ...(lastName ? { lastName } : {}),
                displayName: trimmedName,
              },
            });
          } catch (custErr: any) {
            console.warn("[Tool:update_lead_details] Customer update note:", custErr?.message);
          }
        }

        // Also update conversation recipient name
        if (conversationId) {
          try {
            await prisma.conversation.update({
              where: { id: conversationId },
              data: { recipientName: trimmedName },
            });
          } catch (convErr: any) {
            console.warn("[Tool:update_lead_details] Conversation name update note:", convErr?.message);
          }
        }
      }

      // 2. Prepare Lead Update Payload
      const leadDataToUpdate: Prisma.LeadUpdateInput = {};

      if (input.purposeOrGoal) {
        leadDataToUpdate.workDescription = input.purposeOrGoal;
        if (!existingLead.title || existingLead.title === "New Inquiry" || existingLead.title.startsWith("Inquiry")) {
          leadDataToUpdate.title = input.name
            ? `${input.name} - ${input.purposeOrGoal}`
            : input.purposeOrGoal;
        }
      }

      if (input.projectType) {
        leadDataToUpdate.projectType = input.projectType as LeadProjectType;
      }

      if (input.budgetInLakh !== undefined) {
        leadDataToUpdate.budgetInLakh = input.budgetInLakh;
        if (!input.estimatedBudgetInr) {
          leadDataToUpdate.estimatedBudget = new Prisma.Decimal(input.budgetInLakh * 100000);
        }
      }

      if (input.estimatedBudgetInr !== undefined) {
        leadDataToUpdate.estimatedBudget = new Prisma.Decimal(input.estimatedBudgetInr);
        if (input.budgetInLakh === undefined) {
          leadDataToUpdate.budgetInLakh = Number((input.estimatedBudgetInr / 100000).toFixed(2));
        }
      }

      if (input.budgetDisplay) {
        leadDataToUpdate.budgetDisplay = input.budgetDisplay;
      } else if (input.budgetInLakh) {
        leadDataToUpdate.budgetDisplay = `${input.budgetInLakh} Lakhs`;
      }

      if (input.propertyName) {
        leadDataToUpdate.propertyName = input.propertyName;
      }
      if (input.propertySizeSqft !== undefined) {
        leadDataToUpdate.propertySizeSqft = input.propertySizeSqft;
      }
      if (input.propertyCity) {
        leadDataToUpdate.propertyCity = input.propertyCity;
      }
      if (input.propertyState) {
        leadDataToUpdate.propertyState = input.propertyState;
      }
      if (input.propertyAddress) {
        leadDataToUpdate.propertyAddress = input.propertyAddress;
      }
      if (input.propertyPincode) {
        leadDataToUpdate.propertyPincode = input.propertyPincode;
      }
      if (input.possessionStatus) {
        leadDataToUpdate.possessionStatus = input.possessionStatus;
      }
      if (input.notes) {
        leadDataToUpdate.notes = existingLead.notes
          ? `${existingLead.notes}\n[AI Update]: ${input.notes}`
          : input.notes;
      }

      // Automatically advance status to CONTACTED / QUALIFIED if requirements were captured
      if (existingLead.status === LeadStatus.NEW) {
        leadDataToUpdate.status = LeadStatus.CONTACTED;
      }
      if (
        (input.budgetInLakh || input.estimatedBudgetInr) &&
        (input.purposeOrGoal || input.propertyCity)
      ) {
        leadDataToUpdate.status = LeadStatus.QUALIFIED;
      }

      // 3. Merge additionalInformation safely (Rule 18)
      if (input.additionalInformation && input.additionalInformation.length > 0) {
        const existingAdditional =
          typeof existingLead.additionalInformation === "object" &&
          existingLead.additionalInformation !== null &&
          !Array.isArray(existingLead.additionalInformation)
            ? (existingLead.additionalInformation as Record<string, any>)
            : {};

        const newEntries: Record<string, any> = {};
        for (const item of input.additionalInformation) {
          if (item && item.key) {
            newEntries[item.key] = item.value;
          }
        }

        const mergedAdditional = {
          ...existingAdditional,
          ...newEntries,
          lastAiExtractedAt: new Date().toISOString(),
        };

        leadDataToUpdate.additionalInformation = mergedAdditional as Prisma.InputJsonValue;
      }

      // 4. Execute Lead Update
      const updatedLead = await prisma.lead.update({
        where: { id: targetLeadId },
        data: leadDataToUpdate,
      });

      // 5. Create Lead Activity Log
      try {
        await prisma.leadActivity.create({
          data: {
            organizationId,
            leadId: targetLeadId,
            type: "NOTE",
            title: "Lead Details Extracted & Updated by AI",
            description: `AI conversational assistant extracted requirements: ${
              input.purposeOrGoal ? `Goal: "${input.purposeOrGoal}", ` : ""
            }${input.budgetDisplay || input.budgetInLakh ? `Budget: "${input.budgetDisplay || input.budgetInLakh + ' Lakhs'}", ` : ""}${
              input.propertyCity ? `City: "${input.propertyCity}"` : ""
            }`,
            metadata: {
              updatedFields: Object.keys(input),
              source: "AI_WHATSAPP_ASSISTANT",
            } as any,
          },
        });
      } catch (actErr: any) {
        console.warn("[Tool:update_lead_details] Activity log note:", actErr?.message);
      }

      return {
        success: true,
        message: "Client requirements and lead profile updated successfully in the CRM database.",
        leadId: updatedLead.id,
        leadCode: updatedLead.leadCode,
        status: updatedLead.status,
        updatedFields: Object.keys(input),
      };
    },
    {
      name: "update_lead_details",
      description:
        "Updates the customer and lead profile in the database with their requirements, purpose/goal, budget, name, property details, and location. Call this tool as soon as the client mentions or answers their requirements or details.",
      schema: updateLeadDetailsSchema,
    },
  );
}
