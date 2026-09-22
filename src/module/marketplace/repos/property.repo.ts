import { prisma } from "../../../lib/prisma.js";
import type {
  ProductStatus,
  PropertyType,
  ListingIntent,
  PropertyVerificationStatus,
} from "../../../types/types.js";

export class PropertyRepository {
  async create(data: {
    organizationId: string;
    categoryId?: string | null;
    title: string;
    slug: string;
    propertyType?: PropertyType;
    intent?: ListingIntent;
    verificationStatus?: PropertyVerificationStatus;
    bhk: string;
    bedrooms: number;
    bathrooms: number;
    balconies?: number;
    carpetAreaSqft: number;
    superBuiltUpSqft?: number | null;
    floorNumber?: number | null;
    totalFloors?: number | null;
    furnishingStatus?: string;
    coveredParkingSlots?: number;
    availableFrom?: Date | null;
    addressLine?: string | null;
    locality: string;
    city: string;
    state: string;
    pinCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    price: number;
    maintenanceMonthly?: number;
    isNegotiable?: boolean;
    contactUnlockFee?: number;
    contactUnlockDurationDays?: number;
    ownerName: string;
    ownerPhone: string;
    ownerEmail?: string | null;
    amenities?: string[];
    description?: string | null;
    coverImageUrl?: any;
    images?: any;
    status?: ProductStatus;
    isFeatured?: boolean;
  }) {
    return prisma.propertyListing.create({
      data: data as any,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findById(id: string, organizationId?: string) {
    const where: any = { id, isDeleted: false };
    if (organizationId) where.organizationId = organizationId;

    return prisma.propertyListing.findFirst({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findBySlug(slug: string, organizationId: string) {
    return prisma.propertyListing.findFirst({
      where: { slug, organizationId, isDeleted: false },
    });
  }

  async findMany(params: {
    organizationId?: string;
    categoryId?: string;
    city?: string;
    locality?: string;
    propertyType?: PropertyType;
    intent?: ListingIntent;
    bhk?: string;
    minPrice?: number;
    maxPrice?: number;
    verificationStatus?: PropertyVerificationStatus;
    status?: ProductStatus;
    search?: string;
    skip: number;
    take: number;
  }) {
    const {
      organizationId,
      categoryId,
      city,
      locality,
      propertyType,
      intent,
      bhk,
      minPrice,
      maxPrice,
      verificationStatus,
      status,
      search,
      skip,
      take,
    } = params;

    const where: any = { isDeleted: false };
    if (organizationId) where.organizationId = organizationId;
    if (categoryId) where.categoryId = categoryId;
    if (city) where.city = { contains: city, mode: "insensitive" };
    if (locality) where.locality = { contains: locality, mode: "insensitive" };
    if (propertyType) where.propertyType = propertyType;
    if (intent) where.intent = intent;
    if (bhk) where.bhk = { contains: bhk, mode: "insensitive" };
    if (verificationStatus) where.verificationStatus = verificationStatus;
    if (status) where.status = status;

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { locality: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.propertyListing.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.propertyListing.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, organizationId: string, data: any) {
    return prisma.propertyListing.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async updateVerification(
    id: string,
    verificationStatus: PropertyVerificationStatus,
  ) {
    return prisma.propertyListing.update({
      where: { id },
      data: { verificationStatus },
    });
  }

  async incrementContactUnlocks(id: string) {
    return prisma.propertyListing.update({
      where: { id },
      data: { totalContactUnlocks: { increment: 1 } },
    });
  }

  async softDelete(id: string, organizationId: string) {
    return prisma.propertyListing.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const propertyRepo = new PropertyRepository();
