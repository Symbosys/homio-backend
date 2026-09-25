import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";

export class LeadDocumentRepository {
  /**
   * Create document record associated with a lead
   */
  async create(data: {
    organizationId: string;
    leadId: string;
    name: string;
    category: string;
    fileUrl: Prisma.InputJsonValue;
    uploadedById?: string | null;
  }) {
    return prisma.leadDocument.create({
      data: {
        organizationId: data.organizationId,
        leadId: data.leadId,
        name: data.name,
        category: data.category,
        fileUrl: data.fileUrl,
        uploadedById: data.uploadedById || null,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find document by ID
   */
  async findById(id: string, organizationId: string) {
    return prisma.leadDocument.findFirst({
      where: {
        id,
        organizationId,
      },
    });
  }

  /**
   * Find all documents for a specific lead
   */
  async findByLeadId(leadId: string, organizationId: string) {
    return prisma.leadDocument.findMany({
      where: {
        leadId,
        organizationId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Update document by ID
   */
  async update(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      category?: string;
      fileUrl?: Prisma.InputJsonValue;
    }
  ) {
    return prisma.leadDocument.update({
      where: { id },
      data,
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Delete document by ID
   */
  async delete(id: string, organizationId: string) {
    return prisma.leadDocument.delete({
      where: { id },
    });
  }
}

export const leadDocumentRepo = new LeadDocumentRepository();
