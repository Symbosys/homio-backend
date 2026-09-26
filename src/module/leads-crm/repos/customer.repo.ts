import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  GetCustomersQueryInput,
} from "../validators/customer.validator.js";

export class CustomerRepository {
  /**
   * Create a new customer within a specific organization
   */
  async create(
    organizationId: string,
    data: CreateCustomerInput & {
      customerCode: string;
      userId?: string | null;
      avatarUrl?: Prisma.InputJsonValue;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.customer.create({
      data: {
        organizationId,
        customerCode: data.customerCode,
        userId: data.userId || null,
        salutation: data.salutation || null,
        firstName: data.firstName,
        lastName: data.lastName || null,
        displayName: data.displayName || `${data.firstName} ${data.lastName || ""}`.trim(),
        email: data.email || null,
        phone: data.phone,
        alternatePhone: data.alternatePhone || null,
        companyName: data.companyName || null,
        customerType: data.customerType || "CLIENT",
        gstin: data.gstin || null,
        panNumber: data.panNumber || null,
        aadhaarNumber: data.aadhaarNumber || null,
        status: data.status || "ACTIVE",
        tags: data.tags || [],
        notes: data.notes || null,
        customFields: data.customFields ? (data.customFields as Prisma.InputJsonValue) : Prisma.JsonNull,
        avatarUrl: data.avatarUrl ? data.avatarUrl : Prisma.JsonNull,
        billingAddress: data.billingAddress || null,
        billingCity: data.billingCity || null,
        billingState: data.billingState || null,
        billingCountry: data.billingCountry || "IN",
        billingPincode: data.billingPincode || null,
        shippingAddress: data.shippingAddress || null,
        shippingCity: data.shippingCity || null,
        shippingState: data.shippingState || null,
        shippingCountry: data.shippingCountry || "IN",
        shippingPincode: data.shippingPincode || null,
        preferredContactMethod: data.preferredContactMethod || "PHONE",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        _count: {
          select: {
            leads: true,
            activities: true,
            documents: true,
          },
        },
      },
    });
  }

  /**
   * Find a customer by ID strictly scoped to organization
   */
  async findById(id: string, organizationId: string) {
    return prisma.customer.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        convertedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        leads: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            leadCode: true,
            inquiryNumber: true,
            title: true,
            status: true,
            source: true,
            priority: true,
            estimatedBudget: true,
            currency: true,
            createdAt: true,
            assignedTo: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            performedBy: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            leads: true,
            activities: true,
            documents: true,
            projects: true,
          },
        },
        projects: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          include: {
            serviceCategory: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
                icon: true,
              },
            },
            site: {
              select: {
                id: true,
                siteName: true,
                address: true,
                city: true,
                state: true,
                pincode: true,
                propertyType: true,
                totalAreaSqft: true,
                carpetAreaSqft: true,
                contactPerson: true,
                contactPhone: true,
              },
            },
            schedule: {
              select: {
                id: true,
                plannedStartDate: true,
                plannedEndDate: true,
                actualStartDate: true,
                actualEndDate: true,
                siteHandoverDate: true,
                estimatedDurationDays: true,
              },
            },
            metric: {
              select: {
                id: true,
                progressPercent: true,
                designProgress: true,
                executionProgress: true,
                procurementProgress: true,
                paymentProgress: true,
                qualityScore: true,
              },
            },
            commercial: {
              select: {
                id: true,
                currency: true,
                contractAmount: true,
                designFee: true,
                materialPayment: true,
                labourPayment: true,
                supervisionFee: true,
              },
            },
            members: {
              where: { isActive: true },
              include: {
                employee: {
                  select: {
                    id: true,
                    employeeCode: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    avatarUrl: true,
                    designation: true,
                  },
                },
              },
            },
          },
        },
        documents: {
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
        },
      },
    });
  }

  /**
   * Find customer by phone within an organization (intra-tenant deduplication)
   */
  async findByPhone(phone: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.customer.findFirst({
      where: {
        organizationId,
        phone,
        isDeleted: false,
      },
    });
  }

  /**
   * Find customer by email within an organization
   */
  async findByEmail(email: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.customer.findFirst({
      where: {
        organizationId,
        email,
        isDeleted: false,
      },
    });
  }

  /**
   * Find all customers with pagination, search, and filtering
   */
  async findAll(organizationId: string, query: GetCustomersQueryInput) {
    const { page, limit, search, customerType, status, city, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      isDeleted: false,
      ...(customerType
        ? customerType === "CLIENT"
          ? {
              OR: [
                { customerType: "CLIENT" },
                { projects: { some: { isDeleted: false } } },
              ],
            }
          : { customerType }
        : {}),
      ...(status ? { status } : {}),
      ...(city ? { billingCity: { contains: city, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { customerCode: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { companyName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          _count: {
            select: {
              leads: true,
              projects: true,
              activities: true,
              documents: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update customer record
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateCustomerInput & {
      avatarUrl?: Prisma.InputJsonValue;
      convertedById?: string | null;
      convertedAt?: Date | null;
      portalActivatedAt?: Date | null;
      userId?: string | null;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { avatarUrl, customFields, ...directFields } = data;

    return db.customer.update({
      where: { id },
      data: {
        ...directFields,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(customFields !== undefined
          ? { customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });
  }

  /**
   * Increment inquiry count for an existing customer
   */
  async incrementInquiryCount(id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.customer.update({
      where: { id },
      data: {
        totalInquiriesCount: { increment: 1 },
        lastInquiryDate: new Date(),
      },
    });
  }

  /**
   * Soft delete customer
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.customer.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Generate sequential customer code (e.g. CUST-1001)
   */
  async generateCustomerCode(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    const count = await db.customer.count({
      where: { organizationId },
    });
    return `CUST-${String(count + 1).padStart(4, "0")}`;
  }

  /**
   * Add Customer Activity log
   */
  async createActivity(
    data: {
      organizationId: string;
      customerId: string;
      type: string;
      title: string;
      description?: string | null;
      performedById?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.customerActivity.create({
      data: {
        organizationId: data.organizationId,
        customerId: data.customerId,
        type: data.type,
        title: data.title,
        description: data.description || null,
        performedById: data.performedById || null,
        metadata: data.metadata || Prisma.JsonNull,
      },
      include: {
        performedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Create Customer Document record
   */
  async createDocument(
    data: {
      organizationId: string;
      customerId: string;
      name: string;
      category: string;
      fileUrl: Prisma.InputJsonValue;
      uploadedById?: string | null;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.customerDocument.create({
      data: {
        organizationId: data.organizationId,
        customerId: data.customerId,
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
   * Delete Customer Document record
   */
  async deleteDocument(id: string, organizationId: string) {
    return prisma.customerDocument.delete({
      where: { id },
    });
  }
}

export const customerRepo = new CustomerRepository();
