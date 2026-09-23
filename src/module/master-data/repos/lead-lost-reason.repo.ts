import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateLeadLostReasonInput,
  UpdateLeadLostReasonInput,
  GetLeadLostReasonsQuery,
} from "../validators/lead-lost-reason.validator.js";

export class LeadLostReasonRepository {
  /**
   * Create a new LeadLostReason
   */
  async create(organizationId: string, data: CreateLeadLostReasonInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    return db.leadLostReason.create({
      data: {
        name: data.name,
        slug,
        code: data.code,
        group: data.group as any,
        description: data.description,
        color: data.color,
        icon: data.icon,
        requiresRemarks: data.requiresRemarks,
        requiresCompetitor: data.requiresCompetitor,
        isDefault: data.isDefault,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        additionalInformation: data.additionalInformation as any,
        organizationId,
      },
    });
  }

  /**
   * Find paginated list of lead lost reasons
   */
  async findAll(organizationId: string, query: GetLeadLostReasonsQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { page = 1, limit = 50, search, group, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LeadLostReasonWhereInput = {
      organizationId,
      isDeleted: false,
      ...(group && { group: group as any }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      db.leadLostReason.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.leadLostReason.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find single reason by ID
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadLostReason.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find by name within organization
   */
  async findByName(name: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadLostReason.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
        isDeleted: false,
      },
    });
  }

  /**
   * Find by slug within organization
   */
  async findBySlug(slug: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadLostReason.findFirst({
      where: {
        organizationId,
        slug: { equals: slug, mode: "insensitive" },
        isDeleted: false,
      },
    });
  }

  /**
   * Count how many leads reference this lost reason
   */
  async countLeadUsage(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.lead.count({
      where: {
        organizationId,
        lostReasonId: id,
        isDeleted: false,
      },
    });
  }

  /**
   * Update lead lost reason
   */
  async update(id: string, organizationId: string, data: UpdateLeadLostReasonInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const updateData: Prisma.LeadLostReasonUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.group !== undefined && { group: data.group as any }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.requiresRemarks !== undefined && { requiresRemarks: data.requiresRemarks }),
      ...(data.requiresCompetitor !== undefined && { requiresCompetitor: data.requiresCompetitor }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.additionalInformation !== undefined && { additionalInformation: data.additionalInformation as any }),
    };

    return db.leadLostReason.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Soft delete lead lost reason
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadLostReason.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Toggle active state
   */
  async toggleActive(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const reason = await this.findById(id, organizationId, tx);
    if (!reason) return null;

    const db = tx || prisma;
    return db.leadLostReason.update({
      where: { id },
      data: { isActive: !reason.isActive },
    });
  }
}

export const leadLostReasonRepo = new LeadLostReasonRepository();
