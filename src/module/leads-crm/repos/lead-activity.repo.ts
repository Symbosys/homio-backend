import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { CreateLeadActivityInput } from "../validators/lead-activity.validator.js";

export class LeadActivityRepository {
  /**
   * Log an activity on a lead
   */
  async create(
    organizationId: string,
    leadId: string,
    data: CreateLeadActivityInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.leadActivity.create({
      data: {
        organizationId,
        leadId,
        type: data.type,
        title: data.title,
        description: data.description || null,
        performedById: data.performedById || null,
        performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        performedBy: {
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
   * List all activities for a lead ordered chronologically
   */
  async findByLeadId(leadId: string, organizationId: string) {
    return prisma.leadActivity.findMany({
      where: {
        leadId,
        organizationId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        performedBy: {
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
   * Delete an activity by ID
   */
  async delete(id: string, organizationId: string) {
    return prisma.leadActivity.delete({
      where: { id },
    });
  }
}

export const leadActivityRepo = new LeadActivityRepository();
