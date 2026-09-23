import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateComplaintSnagCategoryInput,
  UpdateComplaintSnagCategoryInput,
  GetComplaintSnagCategoriesQuery,
} from "../validators/complaint-snag-category.validator.js";

export class ComplaintSnagCategoryRepository {
  /**
   * Create a new ComplaintSnagCategory
   */
  async create(organizationId: string, data: CreateComplaintSnagCategoryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    return db.complaintSnagCategory.create({
      data: {
        name: data.name,
        slug,
        code: data.code,
        scope: data.scope as any,
        description: data.description,
        color: data.color,
        icon: data.icon,
        defaultSeverity: data.defaultSeverity as any,
        defaultResolutionDays: data.defaultResolutionDays,
        isDefault: data.isDefault,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        additionalInformation: data.additionalInformation as any,
        organizationId,
      },
    });
  }

  /**
   * Find paginated list of complaint and snag categories
   */
  async findAll(organizationId: string, query: GetComplaintSnagCategoriesQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { page = 1, limit = 50, search, scope, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ComplaintSnagCategoryWhereInput = {
      organizationId,
      isDeleted: false,
      ...(scope && {
        OR: [
          { scope: scope as any },
          { scope: "BOTH" },
        ],
      }),
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
      db.complaintSnagCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.complaintSnagCategory.count({ where }),
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
   * Find single category by ID
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.complaintSnagCategory.findFirst({
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
    return db.complaintSnagCategory.findFirst({
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
    return db.complaintSnagCategory.findFirst({
      where: {
        organizationId,
        slug: { equals: slug, mode: "insensitive" },
        isDeleted: false,
      },
    });
  }

  /**
   * Count usage across Complaints and Handover Snags
   */
  async countUsage(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const [complaintCount, snagCount] = await Promise.all([
      db.projectComplaint.count({ where: { categoryId: id, isDeleted: false } }),
      db.projectHandoverSnag.count({ where: { categoryId: id } }),
    ]);
    return { complaintCount, snagCount, total: complaintCount + snagCount };
  }

  /**
   * Update category
   */
  async update(id: string, organizationId: string, data: UpdateComplaintSnagCategoryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const updateData: Prisma.ComplaintSnagCategoryUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.scope !== undefined && { scope: data.scope as any }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.defaultSeverity !== undefined && { defaultSeverity: data.defaultSeverity as any }),
      ...(data.defaultResolutionDays !== undefined && { defaultResolutionDays: data.defaultResolutionDays }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.additionalInformation !== undefined && { additionalInformation: data.additionalInformation as any }),
    };

    return db.complaintSnagCategory.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Soft delete category
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.complaintSnagCategory.update({
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
    const category = await this.findById(id, organizationId, tx);
    if (!category) return null;

    const db = tx || prisma;
    return db.complaintSnagCategory.update({
      where: { id },
      data: { isActive: !category.isActive },
    });
  }
}

export const complaintSnagCategoryRepo = new ComplaintSnagCategoryRepository();
