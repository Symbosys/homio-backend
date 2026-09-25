import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateLeadFollowUpInput,
  UpdateLeadFollowUpInput,
  GetFollowUpsQueryInput,
} from "../validators/lead-followup.validator.js";

/**
 * Data Access Layer for Lead Follow-Ups & Interaction Schedules
 */
export class LeadFollowUpRepository {
  /**
   * Schedule a new follow up on a lead within the tenant organization
   */
  async create(organizationId: string, data: CreateLeadFollowUpInput) {
    return prisma.leadFollowUp.create({
      data: {
        organizationId,
        leadId: data.leadId,
        type: data.type || "CALLBACK",
        status: "PENDING",
        scheduledAt: new Date(data.scheduledAt),
        remindAt: data.remindAt ? new Date(data.remindAt) : null,
        agenda: data.agenda,
        assignedToId: data.assignedToId || null,
      },
      include: {
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });
  }

  /**
   * Find follow up by ID strictly scoped to organization
   */
  async findById(id: string, organizationId: string) {
    return prisma.leadFollowUp.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });
  }

  /**
   * Find all follow-ups with start/end date range, employee, status, type, and search filters
   */
  async findAll(organizationId: string, query: GetFollowUpsQueryInput) {
    const {
      page,
      limit,
      leadId,
      status,
      type,
      assignedToId,
      search,
      sortBy,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    const rawStart = query.startDate || query.fromDate || query.fromScheduledAt;
    const rawEnd = query.endDate || query.toDate || query.toScheduledAt;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (rawStart) {
      startDate = new Date(rawStart);
    }

    if (rawEnd) {
      if (rawEnd.length === 10) {
        // YYYY-MM-DD format -> include full day up to 23:59:59.999
        endDate = new Date(`${rawEnd}T23:59:59.999Z`);
      } else {
        endDate = new Date(rawEnd);
      }
    }

    const where: Prisma.LeadFollowUpWhereInput = {
      organizationId,
      ...(leadId ? { leadId } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(startDate || endDate
        ? {
            scheduledAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { agenda: { contains: search, mode: "insensitive" } },
              { outcomeNotes: { contains: search, mode: "insensitive" } },
              { lead: { title: { contains: search, mode: "insensitive" } } },
              { lead: { leadCode: { contains: search, mode: "insensitive" } } },
              { lead: { customer: { firstName: { contains: search, mode: "insensitive" } } } },
              { lead: { customer: { lastName: { contains: search, mode: "insensitive" } } } },
              { lead: { customer: { phone: { contains: search } } } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.leadFollowUp.count({ where }),
      prisma.leadFollowUp.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
              status: true,
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                  email: true,
                },
              },
            },
          },
          assignedTo: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update follow up (reschedule, complete, cancel, change assignee or status)
   */
  async update(id: string, organizationId: string, data: UpdateLeadFollowUpInput) {
    const { scheduledAt, remindAt, completedAt, ...directFields } = data;

    return prisma.leadFollowUp.update({
      where: { id },
      data: {
        ...directFields,
        ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined } : {}),
        ...(remindAt !== undefined ? { remindAt: remindAt ? new Date(remindAt) : null } : {}),
        ...(completedAt !== undefined ? { completedAt: completedAt ? new Date(completedAt) : null } : {}),
        ...(data.status === "COMPLETED" && !completedAt ? { completedAt: new Date() } : {}),
      },
      include: {
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });
  }

  /**
   * Delete follow up record
   */
  async delete(id: string, organizationId: string) {
    return prisma.leadFollowUp.delete({
      where: { id },
    });
  }
}

export const leadFollowUpRepo = new LeadFollowUpRepository();
