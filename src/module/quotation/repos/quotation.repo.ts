import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateQuotationInput,
  UpdateQuotationInput,
  GetQuotationsQueryParams,
} from "../validators/quotation.validator.js";

/**
 * Repository layer for Quotation database operations
 */
export class QuotationRepository {
  /**
   * Count total quotations matching prefix for sequence generation
   *
   * @param organizationId - Tenant UUID
   * @param prefix - Prefix to match (e.g. "HOM-QT-")
   */
  async countByPrefix(organizationId: string, prefix: string): Promise<number> {
    return prisma.quotation.count({
      where: {
        organizationId,
        quoteNumber: {
          startsWith: prefix,
        },
      },
    });
  }

  /**
   * Find quotation by quote number in tenant organization
   *
   * @param organizationId - Tenant UUID
   * @param quoteNumber - Quotation proposal number
   */
  async findByQuoteNumber(organizationId: string, quoteNumber: string) {
    return prisma.quotation.findFirst({
      where: {
        organizationId,
        quoteNumber,
        isDeleted: false,
      },
    });
  }


  /**
   * Verify Lead existence and tenant scoping
   *
   * @param organizationId - Tenant UUID
   * @param leadId - Lead UUID
   */
  async findLeadById(organizationId: string, leadId: string) {
    return prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId,
        isDeleted: false,
      },
      include: {
        customer: true,
      },
    });
  }

  /**
   * Create complete normalized Quotation and all child entities atomically
   *
   * @param organizationId - Tenant UUID
   * @param data - Full validated quotation payload with resolved quoteNumber & customerId
   */
  async create(
    organizationId: string,
    data: CreateQuotationInput & { quoteNumber: string; customerId?: string | null }
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Create root Quotation record
      const quotation = await tx.quotation.create({
        data: {
          organizationId,
          leadId: data.leadId,
          customerId: data.customerId || null,
          quoteNumber: data.quoteNumber,
          version: data.version || "v1.0",
          revisionNumber: 1,
          title: data.title,
          quotationType: data.quotationType || "residentialInterior",
          status: data.status,
          salesOwnerId: data.salesOwnerId || null,
          salesOwnerName: data.salesOwnerName || null,
          designerId: data.designerId || null,
          designerName: data.designerName || null,
          grossSubtotal: new Prisma.Decimal(data.grossSubtotal || 0),
          discountType: data.discountType,
          discountPercent: new Prisma.Decimal(data.discountPercent || 0),
          fixedDiscountAmount: new Prisma.Decimal(data.fixedDiscountAmount || 0),
          discountAmount: new Prisma.Decimal(data.discountAmount || 0),
          taxableAmount: new Prisma.Decimal(data.taxableAmount || 0),
          gstPercent: new Prisma.Decimal(data.gstPercent || 18),
          gstAmount: new Prisma.Decimal(data.gstAmount || 0),
          grandTotal: new Prisma.Decimal(data.grandTotal || 0),
          amountPaid: new Prisma.Decimal(data.amountPaid || 0),
          targetMarginPercent: new Prisma.Decimal(data.targetMarginPercent || 25),
          submissionDate: data.submissionDate ? new Date(data.submissionDate) : null,
          discountExpiryDate: data.discountExpiryDate ? new Date(data.discountExpiryDate) : null,
          termsAndConditions: data.termsAndConditions || null,
          internalNotes: data.internalNotes || null,
          tags: data.tags || [],
          visibilitySettings: (data.visibilitySettings as Prisma.InputJsonValue) || undefined,
          additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) || undefined,
        },
      });

      // 2. Create nested Spatial Rooms and Line Items
      if (data.rooms && data.rooms.length > 0) {
        for (const [rIdx, roomInput] of data.rooms.entries()) {
          const room = await tx.quotationRoom.create({
            data: {
              organizationId,
              quotationId: quotation.id,
              roomName: roomInput.roomName,
              areaType: roomInput.areaType,
              carpetAreaSqft: roomInput.carpetAreaSqft || 0,
              sortOrder: roomInput.sortOrder !== undefined ? roomInput.sortOrder : rIdx,
              additionalInformation: (roomInput.additionalInformation as Prisma.InputJsonValue) || undefined,
            },
          });

          if (roomInput.items && roomInput.items.length > 0) {
            for (const [iIdx, itemInput] of roomInput.items.entries()) {
              await tx.quotationItem.create({
                data: {
                  organizationId,
                  quotationId: quotation.id,
                  roomId: room.id,
                  itemMasterId: itemInput.itemMasterId || null,
                  itemCode: itemInput.itemCode,
                  name: itemInput.name,
                  category: itemInput.category,
                  materialSpecs: itemInput.materialSpecs,
                  uom: itemInput.uom || "sqft",
                  length: itemInput.length || null,
                  height: itemInput.height || null,
                  depth: itemInput.depth || null,
                  quantity: new Prisma.Decimal(itemInput.quantity || 1),
                  rate: new Prisma.Decimal(itemInput.rate || 0),
                  marginPercent: new Prisma.Decimal(itemInput.marginPercent || 25),
                  amount: new Prisma.Decimal(itemInput.amount || 0),
                  sortOrder: itemInput.sortOrder !== undefined ? itemInput.sortOrder : iIdx,
                  additionalInformation: (itemInput.additionalInformation as Prisma.InputJsonValue) || undefined,
                },
              });
            }
          }
        }
      }

      // 3. Create nested Payment Schedule Milestones
      if (data.paymentSchedule && data.paymentSchedule.length > 0) {
        for (const [pIdx, milestone] of data.paymentSchedule.entries()) {
          await tx.quotationPaymentSchedule.create({
            data: {
              organizationId,
              quotationId: quotation.id,
              stageName: milestone.stageName,
              percentage: new Prisma.Decimal(milestone.percentage || 0),
              amount: new Prisma.Decimal(milestone.amount || 0),
              triggerEvent: milestone.triggerEvent,
              expectedDate: milestone.expectedDate ? new Date(milestone.expectedDate) : null,
              isCompleted: milestone.isCompleted || false,
              sortOrder: milestone.sortOrder !== undefined ? milestone.sortOrder : pIdx,
              additionalInformation: (milestone.additionalInformation as Prisma.InputJsonValue) || undefined,
            },
          });
        }
      }

      // 4. Create nested PDF Page Assets
      if (data.pdfPages && data.pdfPages.length > 0) {
        for (const [pgIdx, page] of data.pdfPages.entries()) {
          await tx.quotationPdfPage.create({
            data: {
              organizationId,
              quotationId: quotation.id,
              title: page.title,
              position: page.position,
              sortOrder: page.sortOrder !== undefined ? page.sortOrder : pgIdx,
              pageLabel: page.pageLabel || null,
              image: page.image as unknown as Prisma.InputJsonValue,
              additionalInformation: (page.additionalInformation as Prisma.InputJsonValue) || undefined,
            },
          });
        }
      }

      // 5. Create initial Revision History Snapshot
      await tx.quotationRevisionHistory.create({
        data: {
          organizationId,
          quotationId: quotation.id,
          version: data.version || "v1.0",
          revisionNumber: 1,
          grandTotal: new Prisma.Decimal(data.grandTotal || 0),
          discountAmount: new Prisma.Decimal(data.discountAmount || 0),
          notes: "Initial quotation proposal creation",
          createdByName: data.salesOwnerName || "Sales Team",
        },
      });

      // 6. Return fully assembled quotation with relations
      return tx.quotation.findUniqueOrThrow({
        where: { id: quotation.id },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
              status: true,
              propertyName: true,
              propertySizeSqft: true,
              propertyAddress: true,
              propertyCity: true,
            },
          },
          customer: {
            select: {
              id: true,
              customerCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
              email: true,
              companyName: true,
            },
          },
          rooms: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          paymentSchedule: {
            orderBy: { sortOrder: "asc" },
          },
          pdfPages: {
            orderBy: { sortOrder: "asc" },
          },
          revisionHistory: {
            orderBy: { revisionNumber: "desc" },
          },
        },
      });
    });
  }

  /**
   * Find quotations with multi-criteria filters, search, and pagination
   *
   * @param organizationId - Tenant UUID
   * @param params - Validated query parameters
   */
  async findManyWithFilters(
    organizationId: string,
    params: GetQuotationsQueryParams
  ) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      quotationType,
      leadId,
      customerId,
      discountExpired,
      discountExpiryFrom,
      discountExpiryTo,
      dateFrom,
      dateTo,
      minGrandTotal,
      maxGrandTotal,
      salesOwnerId,
      designerId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.QuotationWhereInput = {
      organizationId,
      isDeleted: false,
    };

    if (status) {
      where.status = status;
    }

    if (quotationType) {
      where.quotationType = {
        equals: quotationType,
        mode: "insensitive",
      };
    }

    if (leadId) {
      where.leadId = leadId;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (salesOwnerId) {
      where.salesOwnerId = salesOwnerId;
    }

    if (designerId) {
      where.designerId = designerId;
    }

    // Discount expiry filters
    if (discountExpired !== undefined) {
      const now = new Date();
      if (discountExpired) {
        where.discountExpiryDate = {
          lt: now,
        };
      } else {
        where.discountExpiryDate = {
          gte: now,
        };
      }
    }

    if (discountExpiryFrom || discountExpiryTo) {
      where.discountExpiryDate = {
        ...(where.discountExpiryDate as any),
        ...(discountExpiryFrom ? { gte: new Date(discountExpiryFrom) } : {}),
        ...(discountExpiryTo ? { lte: new Date(discountExpiryTo) } : {}),
      };
    }

    // Creation date filters
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    // Grand total numeric range filter
    if (minGrandTotal !== undefined || maxGrandTotal !== undefined) {
      where.grandTotal = {
        ...(minGrandTotal !== undefined ? { gte: new Prisma.Decimal(minGrandTotal) } : {}),
        ...(maxGrandTotal !== undefined ? { lte: new Prisma.Decimal(maxGrandTotal) } : {}),
      };
    }

    // Multi-field search across quotation, lead, and customer details
    if (search) {
      where.OR = [
        { quoteNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { salesOwnerName: { contains: search, mode: "insensitive" } },
        { designerName: { contains: search, mode: "insensitive" } },
        {
          lead: {
            OR: [
              { leadCode: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { propertyName: { contains: search, mode: "insensitive" } },
              { propertyCity: { contains: search, mode: "insensitive" } },
            ],
          },
        },
        {
          customer: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    // Execute paginated records query and total count in parallel
    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
              status: true,
              propertyName: true,
              propertySizeSqft: true,
              propertyCity: true,
            },
          },
          customer: {
            select: {
              id: true,
              customerCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
              email: true,
              companyName: true,
            },
          },
          _count: {
            select: {
              rooms: true,
              items: true,
              paymentSchedule: true,
              pdfPages: true,
            },
          },
          rooms: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          paymentSchedule: {
            orderBy: { sortOrder: "asc" },
          },
          pdfPages: {
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      prisma.quotation.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: quotations,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Find quotation by ID in tenant organization
   *
   * @param organizationId - Tenant UUID
   * @param id - Quotation UUID
   */
  async findById(organizationId: string, id: string) {
    return prisma.quotation.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
            propertyName: true,
            propertySizeSqft: true,
            propertyAddress: true,
            propertyCity: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            email: true,
            companyName: true,
          },
        },
        rooms: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        paymentSchedule: {
          orderBy: { sortOrder: "asc" },
        },
        pdfPages: {
          orderBy: { sortOrder: "asc" },
        },
        revisionHistory: {
          orderBy: { revisionNumber: "desc" },
        },
      },
    });
  }

  /**
   * Update complete Quotation and all nested structures (rooms, items, milestones, PDF pages) atomically
   *
   * @param organizationId - Tenant UUID
   * @param id - Quotation UUID
   * @param data - Full/partial validated quotation update payload
   */
  async update(organizationId: string, id: string, data: UpdateQuotationInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.quotation.findFirst({
        where: { id, organizationId, isDeleted: false },
      });

      if (!existing) {
        return null;
      }

      const nextRevision = (existing.revisionNumber || 1) + 1;

      // 1. Prepare Root Update Data
      const updateData: Prisma.QuotationUpdateInput = {};

      if (data.leadId !== undefined) updateData.lead = { connect: { id: data.leadId } };
      if (data.customerId !== undefined) {
        if (data.customerId) {
          updateData.customer = { connect: { id: data.customerId } };
        } else {
          updateData.customer = { disconnect: true };
        }
      }
      if (data.quoteNumber !== undefined) updateData.quoteNumber = data.quoteNumber;
      if (data.version !== undefined) updateData.version = data.version;
      updateData.revisionNumber = nextRevision;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.quotationType !== undefined) updateData.quotationType = data.quotationType;
      if (data.status !== undefined) updateData.status = data.status;

      if (data.salesOwnerId !== undefined) updateData.salesOwnerId = data.salesOwnerId;
      if (data.salesOwnerName !== undefined) updateData.salesOwnerName = data.salesOwnerName;
      if (data.designerId !== undefined) updateData.designerId = data.designerId;
      if (data.designerName !== undefined) updateData.designerName = data.designerName;

      if (data.grossSubtotal !== undefined) updateData.grossSubtotal = new Prisma.Decimal(data.grossSubtotal);
      if (data.discountType !== undefined) updateData.discountType = data.discountType;
      if (data.discountPercent !== undefined) updateData.discountPercent = new Prisma.Decimal(data.discountPercent);
      if (data.fixedDiscountAmount !== undefined) updateData.fixedDiscountAmount = new Prisma.Decimal(data.fixedDiscountAmount);
      if (data.discountAmount !== undefined) updateData.discountAmount = new Prisma.Decimal(data.discountAmount);
      if (data.taxableAmount !== undefined) updateData.taxableAmount = new Prisma.Decimal(data.taxableAmount);
      if (data.gstPercent !== undefined) updateData.gstPercent = new Prisma.Decimal(data.gstPercent);
      if (data.gstAmount !== undefined) updateData.gstAmount = new Prisma.Decimal(data.gstAmount);
      if (data.grandTotal !== undefined) updateData.grandTotal = new Prisma.Decimal(data.grandTotal);
      if (data.amountPaid !== undefined) updateData.amountPaid = new Prisma.Decimal(data.amountPaid);
      if (data.targetMarginPercent !== undefined) updateData.targetMarginPercent = new Prisma.Decimal(data.targetMarginPercent);

      if (data.submissionDate !== undefined) {
        updateData.submissionDate = data.submissionDate ? new Date(data.submissionDate) : null;
      }
      if (data.discountExpiryDate !== undefined) {
        updateData.discountExpiryDate = data.discountExpiryDate ? new Date(data.discountExpiryDate) : null;
      }

      if (data.termsAndConditions !== undefined) updateData.termsAndConditions = data.termsAndConditions;
      if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
      if (data.tags !== undefined) updateData.tags = data.tags;

      if (data.visibilitySettings !== undefined) {
        updateData.visibilitySettings = (data.visibilitySettings as Prisma.InputJsonValue) ?? Prisma.JsonNull;
      }
      if (data.additionalInformation !== undefined) {
        updateData.additionalInformation = (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull;
      }

      // Update root quotation record
      await tx.quotation.update({
        where: { id },
        data: updateData,
      });

      // 2. Re-create Rooms and Line Items if provided
      if (data.rooms !== undefined) {
        await tx.quotationItem.deleteMany({
          where: { quotationId: id },
        });
        await tx.quotationRoom.deleteMany({
          where: { quotationId: id },
        });

        if (data.rooms && data.rooms.length > 0) {
          for (const [rIdx, roomInput] of data.rooms.entries()) {
            const room = await tx.quotationRoom.create({
              data: {
                organizationId,
                quotationId: id,
                roomName: roomInput.roomName,
                areaType: roomInput.areaType,
                carpetAreaSqft: roomInput.carpetAreaSqft || 0,
                sortOrder: roomInput.sortOrder !== undefined ? roomInput.sortOrder : rIdx,
                additionalInformation: (roomInput.additionalInformation as Prisma.InputJsonValue) || undefined,
              },
            });

            if (roomInput.items && roomInput.items.length > 0) {
              for (const [iIdx, itemInput] of roomInput.items.entries()) {
                await tx.quotationItem.create({
                  data: {
                    organizationId,
                    quotationId: id,
                    roomId: room.id,
                    itemMasterId: itemInput.itemMasterId || null,
                    itemCode: itemInput.itemCode,
                    name: itemInput.name,
                    category: itemInput.category,
                    materialSpecs: itemInput.materialSpecs,
                    uom: itemInput.uom || "sqft",
                    length: itemInput.length || null,
                    height: itemInput.height || null,
                    depth: itemInput.depth || null,
                    quantity: new Prisma.Decimal(itemInput.quantity || 1),
                    rate: new Prisma.Decimal(itemInput.rate || 0),
                    marginPercent: new Prisma.Decimal(itemInput.marginPercent || 25),
                    amount: new Prisma.Decimal(itemInput.amount || 0),
                    sortOrder: itemInput.sortOrder !== undefined ? itemInput.sortOrder : iIdx,
                    additionalInformation: (itemInput.additionalInformation as Prisma.InputJsonValue) || undefined,
                  },
                });
              }
            }
          }
        }
      }

      // 3. Re-create Payment Schedule Milestones if provided
      if (data.paymentSchedule !== undefined) {
        await tx.quotationPaymentSchedule.deleteMany({
          where: { quotationId: id },
        });

        if (data.paymentSchedule && data.paymentSchedule.length > 0) {
          for (const [pIdx, milestone] of data.paymentSchedule.entries()) {
            await tx.quotationPaymentSchedule.create({
              data: {
                organizationId,
                quotationId: id,
                stageName: milestone.stageName,
                percentage: new Prisma.Decimal(milestone.percentage || 0),
                amount: new Prisma.Decimal(milestone.amount || 0),
                triggerEvent: milestone.triggerEvent,
                expectedDate: milestone.expectedDate ? new Date(milestone.expectedDate) : null,
                isCompleted: milestone.isCompleted || false,
                sortOrder: milestone.sortOrder !== undefined ? milestone.sortOrder : pIdx,
                additionalInformation: (milestone.additionalInformation as Prisma.InputJsonValue) || undefined,
              },
            });
          }
        }
      }

      // 4. Re-create PDF Pages if provided
      if (data.pdfPages !== undefined) {
        await tx.quotationPdfPage.deleteMany({
          where: { quotationId: id },
        });

        if (data.pdfPages && data.pdfPages.length > 0) {
          for (const [pgIdx, page] of data.pdfPages.entries()) {
            await tx.quotationPdfPage.create({
              data: {
                organizationId,
                quotationId: id,
                title: page.title,
                position: page.position,
                sortOrder: page.sortOrder !== undefined ? page.sortOrder : pgIdx,
                pageLabel: page.pageLabel || null,
                image: page.image as unknown as Prisma.InputJsonValue,
                additionalInformation: (page.additionalInformation as Prisma.InputJsonValue) || undefined,
              },
            });
          }
        }
      }

      // 5. Append Revision History Snapshot
      await tx.quotationRevisionHistory.create({
        data: {
          organizationId,
          quotationId: id,
          version: data.version || existing.version || "v1.0",
          revisionNumber: nextRevision,
          grandTotal: data.grandTotal !== undefined ? new Prisma.Decimal(data.grandTotal) : existing.grandTotal,
          discountAmount: data.discountAmount !== undefined ? new Prisma.Decimal(data.discountAmount) : existing.discountAmount,
          notes: data.revisionNotes || `Quotation updated (Rev #${nextRevision})`,
          createdByName: data.salesOwnerName || existing.salesOwnerName || "Sales Team",
        },
      });

      // 6. Return fully hydrated quotation with all relations
      return tx.quotation.findUniqueOrThrow({
        where: { id },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
              status: true,
              propertyName: true,
              propertySizeSqft: true,
              propertyAddress: true,
              propertyCity: true,
            },
          },
          customer: {
            select: {
              id: true,
              customerCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
              email: true,
              companyName: true,
            },
          },
          rooms: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          paymentSchedule: {
            orderBy: { sortOrder: "asc" },
          },
          pdfPages: {
            orderBy: { sortOrder: "asc" },
          },
          revisionHistory: {
            orderBy: { revisionNumber: "desc" },
          },
        },
      });
    });
  }

  /**
   * Update discount expiry date and optionally quotation status
   *
   * @param organizationId - Tenant UUID
   * @param id - Quotation UUID
   * @param discountExpiryDate - New expiry date
   * @param status - Optional status change (e.g. active / expired)
   */
  async updateDiscountExpiry(
    organizationId: string,
    id: string,
    discountExpiryDate: Date | null,
    status?: any
  ) {
    return prisma.quotation.update({
      where: {
        id,
      },
      data: {
        discountExpiryDate,
        ...(status ? { status } : {}),
      },
      include: {
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
            propertyName: true,
            propertySizeSqft: true,
            propertyAddress: true,
            propertyCity: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            email: true,
            companyName: true,
          },
        },
      },
    });
  }
}

export const quotationRepository = new QuotationRepository();

