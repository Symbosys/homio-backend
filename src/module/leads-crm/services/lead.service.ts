import { prisma } from "../../../lib/prisma.js";
import { leadRepo } from "../repos/lead.repo.js";
import { customerRepo } from "../repos/customer.repo.js";
import { userRepo } from "../../user/repos/user.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, Prisma } from "../../../types/types.js";
import type {
  CreateLeadInput,
  UpdateLeadInput,
  UpdateLeadStatusInput,
  AssignLeadInput,
  ConvertLeadInput,
  MarkLeadLostInput,
  BulkActionLeadsInput,
  GetLeadsQueryInput,
} from "../validators/lead.validator.js";

export class LeadService {
  /**
   * Create a new Lead with automatic customer deduplication, inquiry tracking, and platform user linking
   */
  async createLead(
    organizationId: string,
    input: CreateLeadInput,
    userId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      let resolvedCustomerId: string;
      let inquiryNumber = 1;

      if (input.customerId) {
        // Direct existing customer reference
        const existingCustomer = await customerRepo.findById(input.customerId, organizationId);
        if (!existingCustomer) {
          throw new ErrorResponse("Customer not found in this organization", statusCode.Not_Found);
        }
        resolvedCustomerId = existingCustomer.id;
        inquiryNumber = existingCustomer.totalInquiriesCount + 1;
        await customerRepo.incrementInquiryCount(existingCustomer.id, tx);
      } else if (input.customer) {
        // Find existing customer by phone within this organization (Intra-tenant deduplication)
        const normalizedPhone = input.customer.phone.trim();
        const normalizedEmail = input.customer.email ? input.customer.email.trim().toLowerCase() : null;

        const existingCustomer = await customerRepo.findByPhone(normalizedPhone, organizationId, tx);

        if (existingCustomer) {
          // Re-use customer profile, record recurring inquiry count
          resolvedCustomerId = existingCustomer.id;
          inquiryNumber = existingCustomer.totalInquiriesCount + 1;
          await customerRepo.incrementInquiryCount(existingCustomer.id, tx);
        } else {
          // Check platform User for cross-tenant uniqueness linkage
          let linkedUserId: string | null = null;
          const platformUser = await userRepo.findByPhone(normalizedPhone);
          if (platformUser) {
            linkedUserId = platformUser.id;
          } else if (normalizedEmail) {
            const platformUserByEmail = await userRepo.findByEmail(normalizedEmail);
            if (platformUserByEmail) {
              linkedUserId = platformUserByEmail.id;
            }
          }

          const customerCode = await customerRepo.generateCustomerCode(organizationId, tx);

          const newCustomer = await customerRepo.create(
            organizationId,
            {
              customerCode,
              userId: linkedUserId,
              salutation: input.customer.salutation || null,
              firstName: input.customer.firstName,
              lastName: input.customer.lastName || null,
              email: normalizedEmail,
              phone: normalizedPhone,
              alternatePhone: input.customer.alternatePhone || null,
              companyName: input.customer.companyName || null,
              billingAddress: input.customer.billingAddress || null,
              billingCity: input.customer.city || null,
              billingState: input.customer.billingState || null,
              billingPincode: input.customer.billingPincode || null,
              shippingAddress: input.customer.billingAddress || null,
              shippingCity: input.customer.city || null,
              shippingState: input.customer.billingState || null,
              shippingPincode: input.customer.billingPincode || null,
            },
            tx
          );

          resolvedCustomerId = newCustomer.id;
          inquiryNumber = 1;
        }
      } else {
        throw new ErrorResponse("Customer details or ID required", statusCode.Bad_Request);
      }

      // Generate sequential lead code (e.g. LEAD-2026-0001)
      const leadCode = await leadRepo.generateLeadCode(organizationId, tx);

      // Destructure customer out of input so it doesn't get passed into Prisma lead fields
      const { customer, ...leadPayload } = input;

      // Create the Lead record
      const lead = await leadRepo.create(
        organizationId,
        {
          ...leadPayload,
          customerId: resolvedCustomerId,
          leadCode,
          inquiryNumber,
        },
        tx
      );

      // Record initial stage transition in history
      await tx.leadStageHistory.create({
        data: {
          organizationId,
          leadId: lead.id,
          toStage: input.status || "NEW",
          changedById: userId || null,
          remarks: `Initial lead captured (Inquiry #${inquiryNumber})`,
        },
      });

      // Log initial activity
      await tx.leadActivity.create({
        data: {
          organizationId,
          leadId: lead.id,
          type: "NOTE",
          title: "Lead Created",
          description: `Lead created from source ${input.source || "WEBSITE"} with priority ${input.priority || "MEDIUM"}. Inquiry #${inquiryNumber}.`,
          metadata: {
            leadCode,
            source: input.source || "WEBSITE",
            inquiryNumber,
          },
        },
      });

      return lead;
    });
  }

  /**
   * Get all leads with filtering, search, and pagination
   */
  async getLeads(organizationId: string, query: GetLeadsQueryInput) {
    return leadRepo.findAll(organizationId, query);
  }

  /**
   * Get lead by ID
   */
  async getLeadById(id: string, organizationId: string) {
    const lead = await leadRepo.findById(id, organizationId);
    if (!lead) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }
    return lead;
  }

  /**
   * Update lead profile details
   */
  async updateLead(id: string, organizationId: string, input: UpdateLeadInput) {
    const existing = await leadRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }

    const { customer, ...leadFields } = input;

    if (customer && existing.customerId) {
      await prisma.customer.update({
        where: { id: existing.customerId },
        data: {
          ...(customer.firstName !== undefined ? { firstName: customer.firstName } : {}),
          ...(customer.lastName !== undefined ? { lastName: customer.lastName } : {}),
          ...(customer.phone !== undefined ? { phone: customer.phone } : {}),
          ...(customer.email !== undefined ? { email: customer.email || null } : {}),
          ...(customer.city !== undefined ? { billingCity: customer.city || null } : {}),
          ...(customer.billingAddress !== undefined ? { billingAddress: customer.billingAddress || null } : {}),
          ...(customer.billingState !== undefined ? { billingState: customer.billingState || null } : {}),
          ...(customer.billingPincode !== undefined ? { billingPincode: customer.billingPincode || null } : {}),
        },
      });
    }

    const updated = await leadRepo.update(id, organizationId, leadFields);
    return updated;
  }

  /**
   * Transition lead pipeline stage with audit trail & history logging
   */
  async updateLeadStatus(
    id: string,
    organizationId: string,
    input: UpdateLeadStatusInput,
    userId?: string
  ) {
    const existing = await leadRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }

    if (existing.status === input.status) {
      return existing;
    }

    const { updatedLead } = await leadRepo.updateStatusWithHistory(
      id,
      organizationId,
      existing.status,
      input.status,
      userId,
      input.remarks,
      input.durationMinutes
    );

    // Log Activity
    await prisma.leadActivity.create({
      data: {
        organizationId,
        leadId: id,
        type: "NOTE",
        title: `Stage changed to ${input.status}`,
        description: input.remarks || `Lead progressed from ${existing.status} to ${input.status}`,
        metadata: {
          fromStage: existing.status,
          toStage: input.status,
        },
      },
    });

    return updatedLead;
  }

  /**
   * Assign lead to sales representative / designer
   */
  async assignLead(
    id: string,
    organizationId: string,
    input: AssignLeadInput,
    assignedById?: string
  ) {
    const existing = await leadRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }

    const updated = await leadRepo.update(id, organizationId, {
      assignedToId: input.assignedToId,
      assignedAt: input.assignedToId ? new Date() : null,
      assignedById: input.assignedToId ? (assignedById || null) : null,
    });

    // Log Activity
    await prisma.leadActivity.create({
      data: {
        organizationId,
        leadId: id,
        type: "NOTE",
        title: input.assignedToId ? "Lead Assigned" : "Lead Unassigned",
        description: input.assignedToId
          ? `Lead assigned to sales representative`
          : `Lead assignment removed`,
        metadata: {
          assignedToId: input.assignedToId,
        },
      },
    });

    return updated;
  }

  /**
   * Convert Lead to Client & active Project
   */
  async convertLead(
    id: string,
    organizationId: string,
    input: ConvertLeadInput,
    userId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.lead.findFirst({
        where: { id, organizationId, isDeleted: false },
        include: { customer: true },
      });

      if (!existing) {
        throw new ErrorResponse("Lead not found", statusCode.Not_Found);
      }

      if (existing.status === "WON") {
        throw new ErrorResponse("Lead is already converted (WON)", statusCode.Bad_Request);
      }

      // Update Lead to WON
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          status: "WON",
          convertedAt: new Date(),
          convertedById: userId || null,
          convertedProjectId: input.convertedProjectId || null,
        },
      });

      // Record stage history
      await tx.leadStageHistory.create({
        data: {
          organizationId,
          leadId: id,
          fromStage: existing.status,
          toStage: "WON",
          changedById: userId || null,
          remarks: input.notes || "Lead converted to Client",
        },
      });

      // Promote Customer to CLIENT & configure Client Portal
      await tx.customer.update({
        where: { id: existing.customerId },
        data: {
          customerType: "CLIENT",
          convertedAt: new Date(),
          initialLeadId: existing.id,
          portalAccessEnabled: input.clientPortalAccess ?? existing.customer.portalAccessEnabled,
          ...(input.clientPortalAccess && !existing.customer.portalActivatedAt
            ? { portalActivatedAt: new Date() }
            : {}),
        },
      });

      // Record Activity on Customer
      await tx.customerActivity.create({
        data: {
          organizationId,
          customerId: existing.customerId,
          type: "CONVERSION",
          title: "Promoted to Client",
          description: `Customer was converted to Client from Lead ${existing.leadCode}. ${input.notes || ""}`.trim(),
          metadata: {
            leadId: existing.id,
            leadCode: existing.leadCode,
            convertedProjectId: input.convertedProjectId || null,
          },
        },
      });

      // Record Activity on Lead
      await tx.leadActivity.create({
        data: {
          organizationId,
          leadId: id,
          type: "NOTE",
          title: "Lead Converted (WON)",
          description: `Lead converted to Client. Portal access ${input.clientPortalAccess ? "enabled" : "not enabled"}.`,
          metadata: {
            convertedProjectId: input.convertedProjectId || null,
          },
        },
      });

      return updatedLead;
    });
  }

  /**
   * Mark Lead as Lost with reason and remarks
   */
  async markLeadLost(
    id: string,
    organizationId: string,
    input: MarkLeadLostInput,
    userId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.lead.findFirst({
        where: { id, organizationId, isDeleted: false },
      });

      if (!existing) {
        throw new ErrorResponse("Lead not found", statusCode.Not_Found);
      }

      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          status: "LOST",
          lostReason: input.lostReason,
          lostRemarks: input.lostRemarks || null,
          lostAt: new Date(),
        },
      });

      await tx.leadStageHistory.create({
        data: {
          organizationId,
          leadId: id,
          fromStage: existing.status,
          toStage: "LOST",
          changedById: userId || null,
          remarks: `Reason: ${input.lostReason}. ${input.lostRemarks || ""}`.trim(),
        },
      });

      await tx.leadActivity.create({
        data: {
          organizationId,
          leadId: id,
          type: "NOTE",
          title: "Lead Marked Lost",
          description: `Reason: ${input.lostReason}. Remarks: ${input.lostRemarks || "None"}`,
          metadata: {
            lostReason: input.lostReason,
            lostRemarks: input.lostRemarks || null,
          },
        },
      });

      return updatedLead;
    });
  }

  /**
   * Execute bulk actions on multiple leads
   */
  async bulkActions(
    organizationId: string,
    input: BulkActionLeadsInput,
    userId?: string
  ) {
    if (input.action === "ASSIGN") {
      await leadRepo.bulkAssign(input.leadIds, organizationId, input.assignedToId || null, userId);
      return { message: `${input.leadIds.length} leads assigned successfully` };
    }

    if (input.action === "UPDATE_STATUS" && input.status) {
      await leadRepo.bulkUpdateStatus(input.leadIds, organizationId, input.status, userId);
      return { message: `${input.leadIds.length} leads updated to ${input.status}` };
    }

    if (input.action === "DELETE") {
      await leadRepo.bulkDelete(input.leadIds, organizationId);
      return { message: `${input.leadIds.length} leads deleted successfully` };
    }

    throw new ErrorResponse("Invalid bulk action requested", statusCode.Bad_Request);
  }

  /**
   * Soft delete single lead
   */
  async deleteLead(id: string, organizationId: string) {
    const existing = await leadRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }

    await leadRepo.softDelete(id, organizationId);
    return { message: "Lead deleted successfully" };
  }
}

export const leadService = new LeadService();
