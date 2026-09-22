import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateServiceCategoryInput,
  UpdateServiceCategoryInput,
  GetServiceCategoriesQueryInput,
} from "../validators/category.validator.js";

export class CategoryRepository {
  /**
   * Create a new service category scoped to tenant organization
   */
  async create(organizationId: string, data: CreateServiceCategoryInput) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    return prisma.serviceCategory.create({
      data: {
        organizationId,
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
        additionalInformation: data.additionalInformation,
      },
    });
  }

  /**
   * Find single category by ID
   */
  async findById(organizationId: string, id: string) {
    return prisma.serviceCategory.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find category by unique name within tenant
   */
  async findByName(organizationId: string, name: string) {
    return prisma.serviceCategory.findFirst({
      where: {
        organizationId,
        name,
        isDeleted: false,
      },
    });
  }

  /**
   * Find category by unique slug within tenant
   */
  async findBySlug(organizationId: string, slug: string) {
    return prisma.serviceCategory.findFirst({
      where: {
        organizationId,
        slug,
        isDeleted: false,
      },
    });
  }

  /**
   * List paginated categories with search & active filters
   */
  async list(organizationId: string, query: GetServiceCategoriesQueryInput) {
    const { search, isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceCategoryWhereInput = {
      organizationId,
      isDeleted: false,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.serviceCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.serviceCategory.count({ where }),
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
   * Update category details (dirty fields)
   */
  async update(organizationId: string, id: string, data: UpdateServiceCategoryInput) {
    return prisma.serviceCategory.update({
      where: { id },
      data: {
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
        ...(data.additionalInformation !== undefined && { additionalInformation: data.additionalInformation }),
      },
    });
  }

  /**
   * Soft delete category
   */
  async softDelete(organizationId: string, id: string) {
    return prisma.serviceCategory.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Seed standard default categories for an organization
   */
  async seedDefaults(organizationId: string) {
    const defaults = [
      { name: "Carpentry & Joinery", code: "CAT-WOOD", icon: "hammer", color: "#8B5CF6", defaultSlaHours: 48, sortOrder: 1 },
      { name: "Plumbing & Sanitary", code: "CAT-PLUMB", icon: "droplet", color: "#3B82F6", defaultSlaHours: 24, sortOrder: 2 },
      { name: "Electrical & Lighting", code: "CAT-ELEC", icon: "zap", color: "#F59E0B", defaultSlaHours: 24, sortOrder: 3 },
      { name: "Modular Kitchen & Wardrobes", code: "CAT-MOD", icon: "box", color: "#10B981", defaultSlaHours: 48, sortOrder: 4 },
      { name: "Civil & Masonry", code: "CAT-CIVIL", icon: "layout", color: "#6B7280", defaultSlaHours: 72, sortOrder: 5 },
      { name: "Deep Cleaning & Polishing", code: "CAT-CLEAN", icon: "sparkles", color: "#EC4899", defaultSlaHours: 24, sortOrder: 6 },
    ];

    const results = [];
    for (const cat of defaults) {
      const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const existing = await this.findBySlug(organizationId, slug);
      if (!existing) {
        const created = await this.create(organizationId, {
          ...cat,
          slug,
          isDefault: true,
          isActive: true,
        });
        results.push(created);
      }
    }
    return results;
  }
}

export const categoryRepository = new CategoryRepository();
