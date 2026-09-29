import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import {
  statusCode,
  Prisma,
  ProjectBillType,
  ProjectBillStatus,
  ProjectPaymentRecordStatus,
} from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import { projectBillRepo } from "../repos/project-bill.repo.js";
import { projectPaymentRecordRepo } from "../repos/project-payment-record.repo.js";
import type {
  CreateProjectBillInput,
  UpdateProjectBillInput,
  GetProjectBillsQuery,
} from "../validators/project-billing.validator.js";
import type {
  CreateProjectPaymentRecordInput,
  UpdateProjectPaymentRecordInput,
  GetProjectPaymentRecordsQuery,
  GetProjectCommercialSummaryQuery,
} from "../validators/project-billing.validator.js";

/**
 * Service Layer for Project Bills, Invoices & Payment Records
 * Adheres to Multi-Tenant SaaS, Structured ImageType Cloud Storage, and Automatic Media Cleanup (Rule 4)
 */
export class ProjectBillingService {
  /**
   * Prune a single cloud asset if replaced or deleted (Rule 4)
   */
  private async pruneCloudAsset(asset: unknown) {
    if (asset && typeof asset === "object" && "id" in (asset as any)) {
      const publicId = (asset as { id?: string }).id;
      if (publicId && typeof publicId === "string") {
        try {
          await storageService.delete(publicId);
        } catch (error) {
          console.error(`[ProjectBillingService] Failed to prune cloud asset ${publicId}:`, error);
        }
      }
    }
  }

  /**
   * Prune array of replaced or deleted cloud assets (Rule 4)
   */
  private async pruneCloudAssetArray(oldAssets: unknown, newAssets?: unknown) {
    if (!Array.isArray(oldAssets)) return;

    const newIds = new Set(
      Array.isArray(newAssets)
        ? newAssets
            .filter((a) => a && typeof a === "object" && "id" in a)
            .map((a: any) => a.id)
        : []
    );

    for (const oldAsset of oldAssets) {
      if (oldAsset && typeof oldAsset === "object" && "id" in oldAsset) {
        const id = (oldAsset as any).id;
        if (id && !newIds.has(id)) {
          await this.pruneCloudAsset(oldAsset);
        }
      }
    }
  }

  /**
   * Upload file buffer to cloud storage via centralized StorageService
   */
  async uploadToCloud(
    file: Express.Multer.File,
    folder: string,
    resourceType: "image" | "raw" | "auto" = "auto"
  ): Promise<ImageType> {
    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      { folder, resourceType }
    );

    return {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };
  }

  // =========================================================================
  // 1. PROJECT BILL OPERATIONS
  // =========================================================================

  /**
   * Create a Project Bill with relational validation
   */
  async createBill(organizationId: string, data: CreateProjectBillInput) {
    const { projectId, billType, vendorId, labourId, createdById, approvedById } = data;

    // 1. Verify Project belongs to Organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    // 2. Validate Vendor for MATERIAL bills
    if (billType === ProjectBillType.MATERIAL) {
      if (!vendorId) {
        throw new ErrorResponse("Vendor selection is required for Material bills", statusCode.Bad_Request);
      }
      const vendor = await prisma.vendor.findFirst({
        where: { id: vendorId, organizationId, isDeleted: false },
      });
      if (!vendor) {
        throw new ErrorResponse("Vendor not found in this organization", statusCode.Bad_Request);
      }
    }

    // 3. Validate Labour for LABOUR bills
    if (billType === ProjectBillType.LABOUR) {
      if (!labourId) {
        throw new ErrorResponse("Labour selection is required for Labour bills", statusCode.Bad_Request);
      }
      const labour = await prisma.labour.findFirst({
        where: { id: labourId, organizationId, isDeleted: false },
      });
      if (!labour) {
        throw new ErrorResponse("Labour not found in this organization", statusCode.Bad_Request);
      }
    }

    // 4. Validate Personnel Attribution
    if (createdById) {
      const employee = await prisma.employee.findFirst({
        where: { id: createdById, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Creator employee not found in this organization", statusCode.Bad_Request);
      }
    }

    if (approvedById) {
      const employee = await prisma.employee.findFirst({
        where: { id: approvedById, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Approver employee not found in this organization", statusCode.Bad_Request);
      }
    }

    const bill = await projectBillRepo.create(organizationId, data);

    // Auto-create Project Timeline Event
    await prisma.projectTimeline
      .create({
        data: {
          projectId,
          title: `Bill Recorded: ₹${Number(bill.grandTotal).toLocaleString()} (${bill.billType} - ${bill.title})`,
          description: `Bill ${bill.billNumber} logged under stage ${bill.stage}. Payable Due: ₹${Number(bill.dueAmount).toLocaleString()}.`,
          eventType: "COMMERCIAL_INVOICE",
          category: "EXPENSE",
          status: "PLANNED",
          performedById: bill.createdById || null,
          isCustom: false,
          isSystemGenerated: true,
        },
      })
      .catch(() => {});

    return bill;
  }

  /**
   * Get paginated Project Bills
   */
  async getBills(organizationId: string, query: GetProjectBillsQuery) {
    if (query.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: query.projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
      }
    }

    return projectBillRepo.findAll(organizationId, query);
  }

  /**
   * Get single Project Bill by ID
   */
  async getBillById(id: string, organizationId: string) {
    const bill = await projectBillRepo.findById(id, organizationId);
    if (!bill) {
      throw new ErrorResponse("Project bill not found", statusCode.Not_Found);
    }
    return bill;
  }

  /**
   * Update Project Bill with automatic media pruning & balance re-evaluation
   */
  async updateBill(id: string, organizationId: string, data: UpdateProjectBillInput) {
    const existing = await this.getBillById(id, organizationId);

    // Validate relationships if changed
    if (data.projectId && data.projectId !== existing.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Target project not found in this organization", statusCode.Not_Found);
      }
    }

    if (data.vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { id: data.vendorId, organizationId, isDeleted: false },
      });
      if (!vendor) {
        throw new ErrorResponse("Vendor not found in this organization", statusCode.Bad_Request);
      }
    }

    if (data.labourId) {
      const labour = await prisma.labour.findFirst({
        where: { id: data.labourId, organizationId, isDeleted: false },
      });
      if (!labour) {
        throw new ErrorResponse("Labour not found in this organization", statusCode.Bad_Request);
      }
    }

    // Media pruning on replacement (Rule 4)
    if (data.billDocumentUrl !== undefined && existing.billDocumentUrl) {
      const oldDoc = existing.billDocumentUrl as any;
      const newDoc = data.billDocumentUrl as any;
      if (oldDoc?.id && oldDoc.id !== newDoc?.id) {
        await this.pruneCloudAsset(oldDoc);
      }
    }

    if (data.attachments !== undefined && existing.attachments) {
      await this.pruneCloudAssetArray(existing.attachments, data.attachments);
    }

    // Recompute amounts if totals changed
    const updatedTotalAmount = data.totalAmount ?? Number(existing.totalAmount);
    const updatedTaxAmount = data.taxAmount ?? Number(existing.taxAmount);
    const calculatedGrandTotal = data.grandTotal ?? updatedTotalAmount + updatedTaxAmount;

    const paidAmount = Number(existing.paidAmount);
    const newDueAmount = Math.max(0, calculatedGrandTotal - paidAmount);

    let status = data.status || existing.status;
    if (status !== ProjectBillStatus.DRAFT && status !== ProjectBillStatus.CANCELLED) {
      if (paidAmount >= calculatedGrandTotal && calculatedGrandTotal > 0) {
        status = ProjectBillStatus.PAID;
      } else if (paidAmount > 0) {
        status = ProjectBillStatus.PARTIALLY_PAID;
      }
    }

    const updatePayload: UpdateProjectBillInput = {
      ...data,
      grandTotal: calculatedGrandTotal,
    };

    const updated = await projectBillRepo.update(id, organizationId, updatePayload);

    // Apply rebalanced dues
    return projectBillRepo.rebalanceBill(
      id,
      organizationId,
      paidAmount,
      newDueAmount,
      status
    );
  }

  /**
   * Update Bill Status Transition
   */
  async updateBillStatus(
    id: string,
    organizationId: string,
    status: ProjectBillStatus,
    notes?: string
  ) {
    const existing = await this.getBillById(id, organizationId);

    const updatePayload: UpdateProjectBillInput = {
      status,
      ...(notes && { notes: existing.notes ? `${existing.notes}\n${notes}` : notes }),
    };

    return projectBillRepo.update(id, organizationId, updatePayload);
  }

  /**
   * Delete Project Bill & prune cloud assets
   */
  async deleteBill(id: string, organizationId: string) {
    const existing = await this.getBillById(id, organizationId);

    // Check if payments exist
    const linkedPaymentsCount = await prisma.projectPaymentRecord.count({
      where: {
        billId: id,
        organizationId,
        isDeleted: false,
      },
    });

    if (linkedPaymentsCount > 0) {
      throw new ErrorResponse(
        "Cannot delete bill with associated payment records. Please delete or reallocate payments first.",
        statusCode.Conflict
      );
    }

    // Prune media assets (Rule 4)
    if (existing.billDocumentUrl) {
      await this.pruneCloudAsset(existing.billDocumentUrl);
    }
    if (existing.attachments) {
      await this.pruneCloudAssetArray(existing.attachments, []);
    }

    return projectBillRepo.softDelete(id, organizationId);
  }

  // =========================================================================
  // 2. PROJECT PAYMENT RECORD OPERATIONS
  // =========================================================================

  /**
   * Create a Payment Record & atomically rebalance the linked Bill
   */
  async createPaymentRecord(organizationId: string, data: CreateProjectPaymentRecordInput) {
    const { projectId, billId, recordedById, amount, status } = data;

    // 1. Verify Project belongs to Organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    // 2. Validate Bill if provided
    let linkedBill: any = null;
    if (billId) {
      linkedBill = await prisma.projectBill.findFirst({
        where: { id: billId, organizationId, isDeleted: false },
      });
      if (!linkedBill) {
        throw new ErrorResponse("Linked Project Bill not found in this organization", statusCode.Bad_Request);
      }
      if (linkedBill.projectId !== projectId) {
        throw new ErrorResponse("Linked Bill does not belong to this project", statusCode.Bad_Request);
      }
    }

    // 3. Validate RecordedBy Employee
    if (recordedById) {
      const employee = await prisma.employee.findFirst({
        where: { id: recordedById, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Employee recordedById not found in this organization", statusCode.Bad_Request);
      }
    }

    // 4. Atomic Transaction: create payment & rebalance bill
    const createdPayment = await prisma.$transaction(async (tx) => {
      const payment = await projectPaymentRecordRepo.create(organizationId, data, tx as any);

      if (billId && status === ProjectPaymentRecordStatus.SUCCESS) {
        await this.rebalanceBillInternal(billId, organizationId, tx as any);
      }

      return payment;
    });

    // Auto-create Project Timeline Event
    await prisma.projectTimeline
      .create({
        data: {
          projectId,
          title: `Payment Disbursed: ₹${Number(amount).toLocaleString()} (${createdPayment.paymentMethod})`,
          description: `Payment ${createdPayment.paymentNumber} processed. Ref: ${createdPayment.transactionReference || "N/A"}.`,
          eventType: "COMMERCIAL_INVOICE",
          category: "PAYMENT",
          status: status === ProjectPaymentRecordStatus.SUCCESS ? "COMPLETED" : "PLANNED",
          performedById: createdPayment.recordedById || null,
          isCustom: false,
          isSystemGenerated: true,
        },
      })
      .catch(() => {});

    return createdPayment;
  }

  /**
   * Internal helper to recalculate bill totals inside a transaction
   */
  private async rebalanceBillInternal(
    billId: string,
    organizationId: string,
    tx: Prisma.TransactionClient
  ) {
    const bill = await tx.projectBill.findFirst({
      where: { id: billId, organizationId, isDeleted: false },
    });
    if (!bill) return;

    const totalPaidAggregate = await tx.projectPaymentRecord.aggregate({
      where: {
        billId,
        organizationId,
        isDeleted: false,
        status: ProjectPaymentRecordStatus.SUCCESS,
      },
      _sum: { amount: true },
    });

    const totalPaid = totalPaidAggregate._sum.amount ? Number(totalPaidAggregate._sum.amount) : 0;
    const grandTotal = Number(bill.grandTotal);
    const dueAmount = Math.max(0, grandTotal - totalPaid);

    let nextStatus = bill.status;
    if (bill.status !== ProjectBillStatus.CANCELLED && bill.status !== ProjectBillStatus.DRAFT) {
      if (totalPaid >= grandTotal && grandTotal > 0) {
        nextStatus = ProjectBillStatus.PAID;
      } else if (totalPaid > 0) {
        nextStatus = ProjectBillStatus.PARTIALLY_PAID;
      } else {
        nextStatus = ProjectBillStatus.APPROVED;
      }
    }

    await tx.projectBill.update({
      where: { id: billId, organizationId },
      data: {
        paidAmount: new Prisma.Decimal(totalPaid),
        dueAmount: new Prisma.Decimal(dueAmount),
        status: nextStatus,
      },
    });
  }

  /**
   * Get paginated Payment Records
   */
  async getPaymentRecords(organizationId: string, query: GetProjectPaymentRecordsQuery) {
    if (query.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: query.projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
      }
    }

    return projectPaymentRecordRepo.findAll(organizationId, query);
  }

  /**
   * Get single Payment Record by ID
   */
  async getPaymentRecordById(id: string, organizationId: string) {
    const record = await projectPaymentRecordRepo.findById(id, organizationId);
    if (!record) {
      throw new ErrorResponse("Project payment record not found", statusCode.Not_Found);
    }
    return record;
  }

  /**
   * Update Payment Record with media pruning and bill rebalancing
   */
  async updatePaymentRecord(
    id: string,
    organizationId: string,
    data: UpdateProjectPaymentRecordInput
  ) {
    const existing = await this.getPaymentRecordById(id, organizationId);

    // Media pruning (Rule 4)
    if (data.receiptUrl !== undefined && existing.receiptUrl) {
      const oldDoc = existing.receiptUrl as any;
      const newDoc = data.receiptUrl as any;
      if (oldDoc?.id && oldDoc.id !== newDoc?.id) {
        await this.pruneCloudAsset(oldDoc);
      }
    }

    if (data.attachments !== undefined && existing.attachments) {
      await this.pruneCloudAssetArray(existing.attachments, data.attachments);
    }

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await projectPaymentRecordRepo.update(id, organizationId, data, tx as any);

      // If bill changed or amount/status changed, rebalance both old and new bills
      if (existing.billId) {
        await this.rebalanceBillInternal(existing.billId, organizationId, tx as any);
      }
      if (data.billId && data.billId !== existing.billId) {
        await this.rebalanceBillInternal(data.billId, organizationId, tx as any);
      }

      return updated;
    });

    return updatedPayment;
  }

  /**
   * Delete Payment Record with media pruning and bill rebalancing
   */
  async deletePaymentRecord(id: string, organizationId: string) {
    const existing = await this.getPaymentRecordById(id, organizationId);

    // Prune media
    if (existing.receiptUrl) {
      await this.pruneCloudAsset(existing.receiptUrl);
    }
    if (existing.attachments) {
      await this.pruneCloudAssetArray(existing.attachments, []);
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const res = await projectPaymentRecordRepo.softDelete(id, organizationId, tx as any);

      if (existing.billId) {
        await this.rebalanceBillInternal(existing.billId, organizationId, tx as any);
      }

      return res;
    });

    return deleted;
  }

  // =========================================================================
  // 3. COMMERCIAL SUMMARY ANALYTICS
  // =========================================================================

  /**
   * Aggregated commercial insights for project
   */
  async getCommercialSummary(
    organizationId: string,
    projectId: string,
    query?: GetProjectCommercialSummaryQuery
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
      include: {
        commercial: true,
      },
    });

    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const whereBills: Prisma.ProjectBillWhereInput = {
      organizationId,
      projectId,
      isDeleted: false,
      ...(query?.stage && { stage: query.stage }),
      ...(query?.startDate &&
        query?.endDate && {
          billDate: {
            gte: new Date(query.startDate),
            lte: new Date(query.endDate),
          },
        }),
    };

    const bills = await prisma.projectBill.findMany({
      where: whereBills,
      select: {
        billType: true,
        grandTotal: true,
        paidAmount: true,
        dueAmount: true,
        commissionAmount: true,
        commissionStatus: true,
        status: true,
      },
    });

    // Compute Category Breakdowns
    const categories: Record<
      ProjectBillType,
      {
        totalBilled: number;
        totalPaid: number;
        totalDue: number;
        commissionTotal: number;
        count: number;
      }
    > = {
      MATERIAL: { totalBilled: 0, totalPaid: 0, totalDue: 0, commissionTotal: 0, count: 0 },
      LABOUR: { totalBilled: 0, totalPaid: 0, totalDue: 0, commissionTotal: 0, count: 0 },
      DESIGN: { totalBilled: 0, totalPaid: 0, totalDue: 0, commissionTotal: 0, count: 0 },
      SUPERVISION: { totalBilled: 0, totalPaid: 0, totalDue: 0, commissionTotal: 0, count: 0 },
    };

    let grandTotalBilled = 0;
    let grandTotalPaid = 0;
    let grandTotalDue = 0;
    let totalCommissionDue = 0;
    let totalCommissionPaid = 0;

    for (const bill of bills) {
      const bTotal = Number(bill.grandTotal);
      const bPaid = Number(bill.paidAmount);
      const bDue = Number(bill.dueAmount);
      const bComm = Number(bill.commissionAmount);

      grandTotalBilled += bTotal;
      grandTotalPaid += bPaid;
      grandTotalDue += bDue;

      if (bill.commissionStatus === "PAID") {
        totalCommissionPaid += bComm;
      } else if (bill.commissionStatus === "DUE") {
        totalCommissionDue += bComm;
      }

      if (categories[bill.billType]) {
        categories[bill.billType].totalBilled += bTotal;
        categories[bill.billType].totalPaid += bPaid;
        categories[bill.billType].totalDue += bDue;
        categories[bill.billType].commissionTotal += bComm;
        categories[bill.billType].count += 1;
      }
    }

    const contractAmount = project.commercial?.contractAmount
      ? Number(project.commercial.contractAmount)
      : 0;

    const grossMargin = contractAmount > 0 ? contractAmount - grandTotalBilled : 0;
    const grossMarginPercent = contractAmount > 0 ? (grossMargin / contractAmount) * 100 : 0;

    return {
      projectId,
      contractAmount,
      grandTotalBilled,
      grandTotalPaid,
      grandTotalDue,
      grossMargin,
      grossMarginPercent: Number(grossMarginPercent.toFixed(2)),
      commissionSummary: {
        totalDue: totalCommissionDue,
        totalPaid: totalCommissionPaid,
        totalCommission: totalCommissionDue + totalCommissionPaid,
      },
      categories,
      billsCount: bills.length,
    };
  }
}

export const projectBillingService = new ProjectBillingService();
