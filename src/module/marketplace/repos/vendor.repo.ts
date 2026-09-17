import { prisma } from "../../../lib/prisma.js";

export class VendorRepository {
  async create(data: {
    organizationId: string;
    name: string;
    code?: string | null;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    gstin?: string | null;
    defaultCommissionRate?: number | null;
    isActive?: boolean;
  }) {
    return prisma.vendor.create({
      data,
    });
  }

  async findById(id: string, organizationId: string) {
    return prisma.vendor.findFirst({
      where: { id, organizationId, isDeleted: false },
      include: {
        _count: {
          select: {
            homeDecorProducts: { where: { isDeleted: false } },
            materialProducts: { where: { isDeleted: false } },
          },
        },
      },
    });
  }

  async findByName(name: string, organizationId: string) {
    return prisma.vendor.findFirst({
      where: { name, organizationId, isDeleted: false },
    });
  }

  async findMany(params: {
    organizationId: string;
    search?: string;
    isActive?: boolean;
    skip: number;
    take: number;
  }) {
    const { organizationId, search, isActive, skip, take } = params;

    const where: any = {
      organizationId,
      isDeleted: false,
    };

    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              homeDecorProducts: { where: { isDeleted: false } },
              materialProducts: { where: { isDeleted: false } },
            },
          },
        },
      }),
      prisma.vendor.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, organizationId: string, data: any) {
    return prisma.vendor.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string, organizationId: string) {
    return prisma.vendor.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const vendorRepo = new VendorRepository();
