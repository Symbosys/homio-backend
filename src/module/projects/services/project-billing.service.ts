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
 * Adheres to Multi-Tenant SaaS, Embedded File Uploads, Structured ImageType Cloud Storage, and Automatic Media Cleanup (Rule 4)
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
   * Upload file buffer to cloud storage via centralized StorageService with automatic compression
   */
  async uploadToCloud(
    file: Express.Multer.File,
    folder: string,
    resourceType: "image" | "raw" | "auto" = "auto"
  ): Promise<ImageType> {
    const isDoc = file.mimetype.includes("pdf") || file.mimetype.includes("msword") || file.mimetype.includes("officedocument");
    const targetResourceType = isDoc ? "auto" : resourceType;

    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      { folder, resourceType: targetResourceType }
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
   * Create a Project Bill with relational validation & embedded file upload processing
   */
  async createBill(
    organizationId: string,
    data: CreateProjectBillInput,
    files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[]
  ) {
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

    // 5. Process embedded file uploads if present
    if (files && typeof files === "object") {
      const fileMap = Array.isArray(files) ? {} : files;
      const billDocFile = fileMap["billDocument"]?.[0];
      if (billDocFile) {
        data.billDocumentUrl = await this.uploadToCloud(
          billDocFile,
          `organizations/${organizationId}/project-bills`,
          "auto"
        );
      }

      const attachmentFiles = fileMap["attachments"];
      if (attachmentFiles && attachmentFiles.length > 0) {
        const uploadedAttachments = await Promise.all(
          attachmentFiles.map((f) =>
            this.uploadToCloud(f, `organizations/${organizationId}/project-bills/attachments`, "auto")
          )
        );
        data.attachments = [...(data.attachments || []), ...uploadedAttachments];
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
   * Update Project Bill with embedded file replacement, automatic media pruning (Rule 4), & balance re-evaluation
   */
  async updateBill(
    id: string,
    organizationId: string,
    data: UpdateProjectBillInput,
    files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[]
  ) {
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

    // Process embedded uploaded files if any
    if (files && typeof files === "object") {
      const fileMap = Array.isArray(files) ? {} : files;
      const billDocFile = fileMap["billDocument"]?.[0];
      if (billDocFile) {
        const uploadedDoc = await this.uploadToCloud(
          billDocFile,
          `organizations/${organizationId}/project-bills`,
          "auto"
        );
        // Prune old bill document before assigning new one
        if (existing.billDocumentUrl) {
          await this.pruneCloudAsset(existing.billDocumentUrl);
        }
        data.billDocumentUrl = uploadedDoc;
      }

      const attachmentFiles = fileMap["attachments"];
      if (attachmentFiles && attachmentFiles.length > 0) {
        const uploadedAttachments = await Promise.all(
          attachmentFiles.map((f) =>
            this.uploadToCloud(f, `organizations/${organizationId}/project-bills/attachments`, "auto")
          )
        );
        data.attachments = [...(data.attachments || (existing.attachments as any[]) || []), ...uploadedAttachments];
      }
    }

    // Prune removed bill document if explicitly set to null/empty
    if (data.billDocumentUrl === null && existing.billDocumentUrl) {
      await this.pruneCloudAsset(existing.billDocumentUrl);
    } else if (
      data.billDocumentUrl &&
      existing.billDocumentUrl &&
      (data.billDocumentUrl as any).id !== (existing.billDocumentUrl as any).id
    ) {
      await this.pruneCloudAsset(existing.billDocumentUrl);
    }

    // Prune removed attachments (Rule 4)
    if (data.attachments !== undefined) {
      await this.pruneCloudAssetArray(existing.attachments, data.attachments);
    }

    return projectBillRepo.update(id, organizationId, data);
  }

  /**
   * Update Bill status lifecycle transition
   */
  async updateBillStatus(
    id: string,
    organizationId: string,
    status: ProjectBillStatus,
    notes?: string
  ) {
    await this.getBillById(id, organizationId);
    return projectBillRepo.updateStatus(id, organizationId, status, notes);
  }

  /**
   * Soft delete a Project Bill and prune all associated cloud assets (Rule 4)
   */
  async deleteBill(id: string, organizationId: string) {
    const existing = await this.getBillById(id, organizationId);

    // Guard: Prevent deleting bills that have recorded payments against them
    if (Number(existing.paidAmount) > 0) {
      throw new ErrorResponse(
        `Cannot delete bill ${existing.billNumber} because payments totaling ₹${Number(existing.paidAmount).toLocaleString()} have already been disbursed against it. Void the payments first.`,
        statusCode.Bad_Request
      );
    }

    // Prune associated cloud media per Rule 4
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
   * Create a Payment Record & atomic balance recalculation with optional embedded receipt upload
   */
  async createPaymentRecord(
    organizationId: string,
    data: CreateProjectPaymentRecordInput,
    files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[]
  ) {
    const { projectId, billId, amount, recordedById } = data;

    // 1. Verify Project
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    // 2. Verify Bill if linked
    let linkedBill: any = null;
    if (billId) {
      linkedBill = await prisma.projectBill.findFirst({
        where: { id: billId, organizationId, isDeleted: false },
      });
      if (!linkedBill) {
        throw new ErrorResponse("Linked bill not found in this organization", statusCode.Not_Found);
      }

      if (Number(linkedBill.dueAmount) <= 0) {
        throw new ErrorResponse(
          `Bill ${linkedBill.billNumber} is already fully paid (Dues: ₹0).`,
          statusCode.Bad_Request
        );
      }

      if (amount > Number(linkedBill.dueAmount)) {
        throw new ErrorResponse(
          `Payment amount (₹${amount.toLocaleString()}) exceeds the remaining due amount (₹${Number(linkedBill.dueAmount).toLocaleString()}) for bill ${linkedBill.billNumber}.`,
          statusCode.Bad_Request
        );
      }
    }

    // 3. Verify RecordedBy Employee
    if (recordedById) {
      const employee = await prisma.employee.findFirst({
        where: { id: recordedById, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Recording employee not found in this organization", statusCode.Bad_Request);
      }
    }

    // 4. Process embedded file uploads if present
    if (files && typeof files === "object") {
      const fileMap = Array.isArray(files) ? {} : files;
      const receiptFile = fileMap["receipt"]?.[0];
      if (receiptFile) {
        data.receiptUrl = await this.uploadToCloud(
          receiptFile,
          `organizations/${organizationId}/payment-receipts`,
          "auto"
        );
      }

      const attachmentFiles = fileMap["attachments"];
      if (attachmentFiles && attachmentFiles.length > 0) {
        const uploadedAttachments = await Promise.all(
          attachmentFiles.map((f) =>
            this.uploadToCloud(f, `organizations/${organizationId}/payment-receipts/attachments`, "auto")
          )
        );
        data.attachments = [...(data.attachments || []), ...uploadedAttachments];
      }
    }

    // Execute in Prisma Transaction for Atomic Rebalancing
    return prisma.$transaction(async (tx) => {
      const paymentRecord = await projectPaymentRecordRepo.create(organizationId, data, tx);

      if (billId && linkedBill && data.status === ProjectPaymentRecordStatus.SUCCESS) {
        const newPaid = Number(linkedBill.paidAmount) + Number(amount);
        const grandTotal = Number(linkedBill.grandTotal);
        const newDue = Math.max(0, grandTotal - newPaid);

        let newStatus: ProjectBillStatus = linkedBill.status;
        if (newDue === 0) {
          newStatus = ProjectBillStatus.PAID;
        } else if (newPaid > 0) {
          newStatus = ProjectBillStatus.PARTIALLY_PAID;
        }

        await tx.projectBill.update({
          where: { id: billId },
          data: {
            paidAmount: new Prisma.Decimal(newPaid),
            dueAmount: new Prisma.Decimal(newDue),
            status: newStatus,
          },
        });
      }

      // Auto-create Project Timeline Transaction Event
      await tx.projectTimeline
        .create({
          data: {
            projectId,
            title: `Payment Disbursed: ₹${Number(amount).toLocaleString()} (${data.paymentMethod})`,
            description: `Payment ${paymentRecord.paymentNumber} recorded for ${data.title}.${linkedBill ? ` Linked Bill: ${linkedBill.billNumber}.` : ""}`,
            eventType: "COMMERCIAL_INVOICE",
            category: "EXPENSE",
            status: "COMPLETED",
            performedById: recordedById || null,
            isCustom: false,
            isSystemGenerated: true,
          },
        })
        .catch(() => {});

      return paymentRecord;
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
    const payment = await projectPaymentRecordRepo.findById(id, organizationId);
    if (!payment) {
      throw new ErrorResponse("Payment record not found", statusCode.Not_Found);
    }
    return payment;
  }

  /**
   * Update Payment Record with embedded receipt replacement and automatic media pruning (Rule 4)
   */
  async updatePaymentRecord(
    id: string,
    organizationId: string,
    data: UpdateProjectPaymentRecordInput,
    files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[]
  ) {
    const existing = await this.getPaymentRecordById(id, organizationId);

    // Process embedded uploaded files if any
    if (files && typeof files === "object") {
      const fileMap = Array.isArray(files) ? {} : files;
      const receiptFile = fileMap["receipt"]?.[0];
      if (receiptFile) {
        const uploadedReceipt = await this.uploadToCloud(
          receiptFile,
          `organizations/${organizationId}/payment-receipts`,
          "auto"
        );
        // Prune old receipt voucher
        if (existing.receiptUrl) {
          await this.pruneCloudAsset(existing.receiptUrl);
        }
        data.receiptUrl = uploadedReceipt;
      }

      const attachmentFiles = fileMap["attachments"];
      if (attachmentFiles && attachmentFiles.length > 0) {
        const uploadedAttachments = await Promise.all(
          attachmentFiles.map((f) =>
            this.uploadToCloud(f, `organizations/${organizationId}/payment-receipts/attachments`, "auto")
          )
        );
        data.attachments = [...(data.attachments || (existing.attachments as any[]) || []), ...uploadedAttachments];
      }
    }

    // Prune removed receipt if set to null
    if (data.receiptUrl === null && existing.receiptUrl) {
      await this.pruneCloudAsset(existing.receiptUrl);
    } else if (
      data.receiptUrl &&
      existing.receiptUrl &&
      (data.receiptUrl as any).id !== (existing.receiptUrl as any).id
    ) {
      await this.pruneCloudAsset(existing.receiptUrl);
    }

    // Prune removed attachments (Rule 4)
    if (data.attachments !== undefined) {
      await this.pruneCloudAssetArray(existing.attachments, data.attachments);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await projectPaymentRecordRepo.update(id, organizationId, data, tx);

      // Rebalance linked bill if amount or status changed
      if (
        existing.billId &&
        (data.amount !== undefined || data.status !== undefined) &&
        (data.amount !== Number(existing.amount) || data.status !== existing.status)
      ) {
        const allPayments = await tx.projectPaymentRecord.findMany({
          where: {
            billId: existing.billId,
            organizationId,
            isDeleted: false,
            status: ProjectPaymentRecordStatus.SUCCESS,
          },
        });

        const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const bill = await tx.projectBill.findFirst({
          where: { id: existing.billId },
        });

        if (bill) {
          const grandTotal = Number(bill.grandTotal);
          const newDue = Math.max(0, grandTotal - totalPaid);
          let newStatus: ProjectBillStatus = bill.status;
          if (newDue === 0) {
            newStatus = ProjectBillStatus.PAID;
          } else if (totalPaid > 0) {
            newStatus = ProjectBillStatus.PARTIALLY_PAID;
          } else {
            newStatus = ProjectBillStatus.APPROVED;
          }

          await tx.projectBill.update({
            where: { id: existing.billId },
            data: {
              paidAmount: new Prisma.Decimal(totalPaid),
              dueAmount: new Prisma.Decimal(newDue),
              status: newStatus,
            },
          });
        }
      }

      return updated;
    });
  }

  /**
   * Delete Payment Record, restore bill dues, and prune receipt voucher from cloud storage (Rule 4)
   */
  async deletePaymentRecord(id: string, organizationId: string) {
    const existing = await this.getPaymentRecordById(id, organizationId);

    // Prune receipt vouchers per Rule 4
    if (existing.receiptUrl) {
      await this.pruneCloudAsset(existing.receiptUrl);
    }
    if (existing.attachments) {
      await this.pruneCloudAssetArray(existing.attachments, []);
    }

    return prisma.$transaction(async (tx) => {
      const deleted = await projectPaymentRecordRepo.softDelete(id, organizationId, tx);

      // If linked to a bill, restore dues
      if (existing.billId && existing.status === ProjectPaymentRecordStatus.SUCCESS) {
        const remainingPayments = await tx.projectPaymentRecord.findMany({
          where: {
            billId: existing.billId,
            organizationId,
            isDeleted: false,
            id: { not: id },
            status: ProjectPaymentRecordStatus.SUCCESS,
          },
        });

        const totalPaid = remainingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const bill = await tx.projectBill.findFirst({
          where: { id: existing.billId },
        });

        if (bill) {
          const grandTotal = Number(bill.grandTotal);
          const newDue = Math.max(0, grandTotal - totalPaid);
          let newStatus: ProjectBillStatus = bill.status;
          if (newDue === 0) {
            newStatus = ProjectBillStatus.PAID;
          } else if (totalPaid > 0) {
            newStatus = ProjectBillStatus.PARTIALLY_PAID;
          } else {
            newStatus = ProjectBillStatus.APPROVED;
          }

          await tx.projectBill.update({
            where: { id: existing.billId },
            data: {
              paidAmount: new Prisma.Decimal(totalPaid),
              dueAmount: new Prisma.Decimal(newDue),
              status: newStatus,
            },
          });
        }
      }

      return deleted;
    });
  }

  // =========================================================================
  // 3. COMMERCIAL SUMMARY & MARGIN ENGINE
  // =========================================================================

  /**
   * Compute comprehensive project financial summary, margins, and commissions
   */
  async getCommercialSummary(
    projectId: string,
    organizationId: string,
    query?: GetProjectCommercialSummaryQuery
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
      include: { commercial: true },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    return projectBillRepo.getProjectCommercialSummary(projectId, organizationId, query);
  }
}

export const projectBillingService = new ProjectBillingService();
