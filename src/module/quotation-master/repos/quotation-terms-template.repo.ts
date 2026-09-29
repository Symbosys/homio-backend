import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetTermsTemplatesQueryInput } from "../validators/quotation-terms-template.validator.js";

/**
 * Repository: Quotation Terms & Conditions Template Data Access
 * Manages warranty clauses, legal signoff notes, payment notes, and default templates
 */
export class QuotationTermsTemplateRepo {
  /**
   * Create a new Terms Template
   */
  async create(
    organizationId: string,
    data: Omit<Prisma.QuotationTermsTemplateUncheckedCreateInput, "organizationId">,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.quotationTermsTemplate.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  /**
   * Find Terms Template by ID within tenant organization
   */
  async findById(id: string, organizationId: string) {
    return prisma.quotationTermsTemplate.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find the default active Terms Template for the tenant
   */
  async findDefault(organizationId: string) {
    return prisma.quotationTermsTemplate.findFirst({
      where: {
        organizationId,
        isDefault: true,
        isActive: true,
        isDeleted: false,
      },
    });
  }

  /**
   * List all non-paginated Terms Templates
   */
  async findAll(organizationId: string, query: GetTermsTemplatesQueryInput) {
    const { search, isActive } = query;

    const where: Prisma.QuotationTermsTemplateWhereInput = {
      organizationId,
      isDeleted: false,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { code: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { termsAndConditions: { contains: term, mode: "insensitive" } },
        { warrantyClauses: { contains: term, mode: "insensitive" } },
      ];
    }

    return prisma.quotationTermsTemplate.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });
  }

  /**
   * Unset isDefault flag on other terms templates within the tenant
   */
  async clearExistingDefault(organizationId: string, excludeId?: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationTermsTemplate.updateMany({
      where: {
        organizationId,
        isDefault: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: {
        isDefault: false,
      },
    });
  }

  /**
   * Update Terms Template record
   */
  async update(
    id: string,
    organizationId: string,
    data: Prisma.QuotationTermsTemplateUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.quotationTermsTemplate.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete Terms Template
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationTermsTemplate.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        isDefault: false,
      },
    });
  }

  /**
   * Toggle active state of a Terms Template
   */
  async toggleActive(id: string, currentStatus: boolean, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationTermsTemplate.update({
      where: { id },
      data: {
        isActive: !currentStatus,
      },
    });
  }
}

export const quotationTermsTemplateRepo = new QuotationTermsTemplateRepo();
