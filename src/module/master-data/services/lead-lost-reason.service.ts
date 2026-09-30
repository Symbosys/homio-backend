import { LeadLostReason } from "../../../types/types.js";
import type { GetLeadLostReasonsQuery } from "../validators/lead-lost-reason.validator.js";

export interface SystemLeadLostReasonMeta {
  id: LeadLostReason;
  name: string;
  code: string;
  slug: string;
  group: string;
  description: string;
  color: string;
  icon: string;
  requiresRemarks: boolean;
  requiresCompetitor: boolean;
  isDefault: boolean;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
}

export const SYSTEM_LEAD_LOST_REASONS: SystemLeadLostReasonMeta[] = [
  {
    id: LeadLostReason.BUDGET_MISMATCH,
    name: "Budget Mismatch / Quote Too High",
    code: "BUDGET_MISMATCH",
    slug: "budget-mismatch",
    group: "PRICING",
    description: "Quoted project estimate exceeded customer budget or financial readiness",
    color: "#EF4444",
    icon: "DollarSign",
    requiresRemarks: false,
    requiresCompetitor: false,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 1,
  },
  {
    id: LeadLostReason.LOST_TO_COMPETITOR,
    name: "Lost to Competitor",
    code: "LOST_TO_COMPETITOR",
    slug: "lost-to-competitor",
    group: "COMPETITOR",
    description: "Selected another organized interior design firm, studio, or architect",
    color: "#F59E0B",
    icon: "Users",
    requiresRemarks: false,
    requiresCompetitor: true,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 2,
  },
  {
    id: LeadLostReason.HIRED_LOCAL_CARPENTER,
    name: "Hired Local Carpenter / Direct Labor",
    code: "HIRED_LOCAL_CARPENTER",
    slug: "hired-local-carpenter",
    group: "COMPETITOR",
    description: "Decided to hire direct local contractors, unorganized labor, or manage DIY",
    color: "#D97706",
    icon: "Hammer",
    requiresRemarks: false,
    requiresCompetitor: false,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 3,
  },
  {
    id: LeadLostReason.PROJECT_POSTPONED,
    name: "Project Postponed / On Hold",
    code: "PROJECT_POSTPONED",
    slug: "project-postponed",
    group: "TIMELINE",
    description: "Renovation or fit-out work postponed indefinitely by customer",
    color: "#6B7280",
    icon: "Clock",
    requiresRemarks: false,
    requiresCompetitor: false,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 4,
  },
  {
    id: LeadLostReason.POSSESSION_DELAYED,
    name: "Possession / Handover Delayed",
    code: "POSSESSION_DELAYED",
    slug: "possession-delayed",
    group: "TIMELINE",
    description: "Builder or developer delayed flat or villa possession handover date",
    color: "#8B5CF6",
    icon: "CalendarX",
    requiresRemarks: false,
    requiresCompetitor: false,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 5,
  },
  {
    id: LeadLostReason.OUT_OF_SERVICE_AREA,
    name: "Outside Serviceable Area",
    code: "OUT_OF_SERVICE_AREA",
    slug: "out-of-service-area",
    group: "LOCATION",
    description: "Site location is outside organization operational geographic coverage",
    color: "#EC4899",
    icon: "MapPinOff",
    requiresRemarks: false,
    requiresCompetitor: false,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 6,
  },
  {
    id: LeadLostReason.SCOPE_NOT_SUPPORTED,
    name: "Scope Not Supported / Ticket Too Small",
    code: "SCOPE_NOT_SUPPORTED",
    slug: "scope-not-supported",
    group: "SCOPE_MISMATCH",
    description: "Requested scope or area is below minimum ticket size or outside service offerings",
    color: "#10B981",
    icon: "Layers",
    requiresRemarks: false,
    requiresCompetitor: false,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 7,
  },
  {
    id: LeadLostReason.CLIENT_UNRESPONSIVE,
    name: "Client Unresponsive / Ghosted",
    code: "CLIENT_UNRESPONSIVE",
    slug: "client-unresponsive",
    group: "COMMUNICATION",
    description: "No communication or response across multiple follow-up attempts",
    color: "#64748B",
    icon: "PhoneOff",
    requiresRemarks: false,
    requiresCompetitor: false,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 8,
  },
  {
    id: LeadLostReason.FAKE_OR_INVALID_LEAD,
    name: "Invalid / Spam / Test Lead",
    code: "FAKE_OR_INVALID_LEAD",
    slug: "fake-or-invalid-lead",
    group: "COMMUNICATION",
    description: "Spam, wrong contact number, student inquiry, or competitor test inquiry",
    color: "#DC2626",
    icon: "AlertTriangle",
    requiresRemarks: false,
    requiresCompetitor: false,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 9,
  },
  {
    id: LeadLostReason.OTHER,
    name: "Other / Specific Reason",
    code: "OTHER",
    slug: "other",
    group: "OTHER",
    description: "Specific reason detailed in lost remarks notes",
    color: "#94A3B8",
    icon: "HelpCircle",
    requiresRemarks: true,
    requiresCompetitor: false,
    isDefault: false,
    isActive: true,
    isSystem: true,
    sortOrder: 10,
  },
];

export class LeadLostReasonService {
  /**
   * Get list of standardized system lead lost reasons
   */
  async getReasons(_organizationId: string, query?: GetLeadLostReasonsQuery) {
    let items = [...SYSTEM_LEAD_LOST_REASONS];

    if (query?.group) {
      items = items.filter((item) => item.group === query.group);
    }
    if (query?.isActive !== undefined) {
      items = items.filter((item) => item.isActive === query.isActive);
    }
    if (query?.search) {
      const s = query.search.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(s) ||
          item.code.toLowerCase().includes(s) ||
          item.description.toLowerCase().includes(s)
      );
    }

    return {
      items,
      total: items.length,
      page: 1,
      limit: items.length,
      totalPages: 1,
    };
  }

  /**
   * Get reason by key/code
   */
  async getReasonById(id: string, _organizationId: string) {
    const reason = SYSTEM_LEAD_LOST_REASONS.find(
      (item) => item.id === id || item.code === id || item.slug === id
    );
    return reason || null;
  }
}

export const leadLostReasonService = new LeadLostReasonService();
