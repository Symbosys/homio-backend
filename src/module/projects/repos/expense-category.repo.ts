import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  GetExpenseCategoriesQuery,
} from "../validators/expense-category.validator.js";

export class ExpenseCategoryRepository {
  /**
   * Create a new ExpenseCategory
   */
  async create(organizationId: string, data: CreateExpenseCategoryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.expenseCategory.create({
      data: {
        ...data,
        slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""),
        organizationId,
      },
    });
  }

  /**
   * Find paginated list of expense categories for an organization
   */
  async findAll(organizationId: string, query: GetExpenseCategoriesQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { page = 1, limit = 50, search, scope, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseCategoryWhereInput = {
      organizationId,
      isDeleted: false,
      ...(scope && { scope: scope as any }),
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

    const [data, total] = await Promise.all([
      db.expenseCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: "asc" }],
        include: {
          _count: {
            select: { expenses: true },
          },
        },
      }),
      db.expenseCategory.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single category by ID with tenant verification
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.expenseCategory.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        _count: {
          select: { expenses: true },
        },
      },
    });
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.expenseCategory.findFirst({
      where: {
        slug,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find category by name
   */
  async findByName(name: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.expenseCategory.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Update category
   */
  async update(id: string, organizationId: string, data: UpdateExpenseCategoryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.expenseCategory.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete category
   */
  async delete(id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.expenseCategory.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Seed default system categories for a new organization
   */
  async seedDefaults(organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const defaults = [
      { name: "Raw Materials", slug: "raw-materials", scope: "PROJECT" as const, color: "#3B82F6", icon: "Package", isDefault: true },
      { name: "Site Labour & Wages", slug: "site-labour", scope: "PROJECT" as const, color: "#F59E0B", icon: "Hammer", isDefault: true },
      { name: "Subcontractor Payouts", slug: "subcontractor-payouts", scope: "PROJECT" as const, color: "#8B5CF6", icon: "Users", isDefault: true },
      { name: "Machinery & Rentals", slug: "machinery-rentals", scope: "PROJECT" as const, color: "#EC4899", icon: "Wrench", isDefault: true },
      { name: "Transport & Logistics", slug: "transport-logistics", scope: "PROJECT" as const, color: "#10B981", icon: "Truck", isDefault: true },
      { name: "Office / Studio Rent", slug: "office-rent", scope: "ORGANIZATION" as const, color: "#6366F1", icon: "Building2", isDefault: true },
      { name: "Software & SaaS Licenses", slug: "software-licenses", scope: "ORGANIZATION" as const, color: "#06B6D4", icon: "Cpu", isDefault: true },
      { name: "Marketing & Lead Acquisition", slug: "marketing-ads", scope: "ORGANIZATION" as const, color: "#F97316", icon: "Megaphone", isDefault: true },
      { name: "Staff Travel & Conveyance", slug: "travel-conveyance", scope: "BOTH" as const, color: "#14B8A6", icon: "Navigation", isDefault: true },
      { name: "General Miscellaneous", slug: "miscellaneous", scope: "BOTH" as const, color: "#64748B", icon: "MoreHorizontal", isDefault: true },
    ];

    const results = [];
    for (const item of defaults) {
      const existing = await this.findBySlug(item.slug, organizationId, db);
      if (!existing) {
        results.push(
          await db.expenseCategory.create({
            data: {
              ...item,
              organizationId,
            },
          })
        );
      }
    }
    return results;
  }
}

export const expenseCategoryRepo = new ExpenseCategoryRepository();
