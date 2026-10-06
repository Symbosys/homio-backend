import {
  createUpdateLeadDetailsTool,
  type LeadToolContext,
} from "./leads/update-lead-details.tool.js";
import {
  createScheduleMeetingTool,
  type MeetingToolContext,
} from "./meeting/schedule-meeting.tool.js";

export * from "./leads/update-lead-details.tool.js";
export * from "./meeting/schedule-meeting.tool.js";

export interface TenantAiToolsContext extends LeadToolContext, MeetingToolContext {}

/**
 * Creates and returns all autonomous LangChain tools configured for a specific tenant conversation.
 *
 * @param context - Scoped tenant execution context (organizationId, leadId, customerId, conversationId)
 */
export function createTenantAiTools(context: TenantAiToolsContext) {
  return [
    createUpdateLeadDetailsTool(context),
    createScheduleMeetingTool(context),
  ];
}
