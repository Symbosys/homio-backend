import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateServiceCategoryInput,
  UpdateServiceCategoryInput,
  GetServiceCategoriesQuery,
} from "../validators/service-category.validator.js";

export class ServiceCategoryRepository {
  /**
   * Create a new ServiceCategory
   */
  async create(organizationId: string, data: CreateServiceCategoryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    return db.serviceCategory.create({
      data: {
        name: data.name,
        slug,
        code: data.code,
        description: data.description,
        icon: data.icon,
        color: data.color,
        defaultSlaHours: data.defaultSlaHours,
        isDefault: data.isDefault,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        additionalInformation: data.additionalInformation as any,
        organizationId,
      },
    });
  }

  /**
   * Find paginated list of service categories
   */
  async findAll(organizationId: string, query: GetServiceCategoriesQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { page = 1, limit = 50, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceCategoryWhereInput = {
      organizationId,
      isDeleted: false,
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
      db.serviceCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.serviceCategory.count({ where }),
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
    return db.serviceCategory.findFirst({
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
    return db.serviceCategory.findFirst({
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
    return db.serviceCategory.findFirst({
      where: {
        organizationId,
        slug: { equals: slug, mode: "insensitive" },
        isDeleted: false,
      },
    });
  }

  /**
   * Count usage across Leads, Projects, and After-Sales
   */
  async countUsage(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const [projectCount, requestCount] = await Promise.all([
      db.project.count({ where: { organizationId, serviceCategoryId: id, isDeleted: false } }),
      db.afterSalesServiceRequest.count({ where: { project: { organizationId }, categoryId: id, isDeleted: false } }),
    ]);
    return { leadCount: 0, projectCount, requestCount, total: projectCount + requestCount };
  }

  /**
   * Update service category
   */
  async update(id: string, organizationId: string, data: UpdateServiceCategoryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const updateData: Prisma.ServiceCategoryUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.defaultSlaHours !== undefined && { defaultSlaHours: data.defaultSlaHours }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.additionalInformation !== undefined && { additionalInformation: data.additionalInformation as any }),
    };

    return db.serviceCategory.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Soft delete service category
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.serviceCategory.update({
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
    return db.serviceCategory.update({
      where: { id },
      data: { isActive: !category.isActive },
    });
  }
}

export const serviceCategoryRepo = new ServiceCategoryRepository();
