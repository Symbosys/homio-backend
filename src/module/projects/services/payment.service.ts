import { prisma } from "../../../lib/prisma.js";
import { PaymentRepository, paymentRepository } from "../repos/payment.repo.js";
import type {
  CreatePaymentInput,
  UpdatePaymentInput,
  GetPaymentsQuery,
  GetPaymentSummaryQuery,
} from "../repos/payment.repo.js";

export class PaymentService {
  constructor(private repo: PaymentRepository = paymentRepository) {}

  /**
   * Helper to generate unique sequential paymentNumber per tenant
   */
  private async generatePaymentNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repo.countInYear(organizationId, year);
    const sequence = String(count + 1).padStart(4, "0");
    return `PAY-${year}-${sequence}`;
  }

  /**
   * Record a new project payment transaction
   */
  async createPayment(organizationId: string, input: CreatePaymentInput) {
    // 1. Verify project exists and belongs to tenant (Rule 1 & 3)
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        organizationId,
        isDeleted: false,
      },
      select: {
        id: true,
        customerId: true,
      },
    });

    if (!project) {
      throw new Error("Project not found or access denied");
    }

    // 2. If milestoneId is provided, verify it belongs to this project
    if (input.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: {
          id: input.milestoneId,
          projectId: input.projectId,
          isDeleted: false,
        },
      });
      if (!milestone) {
        throw new Error("Milestone not found in this project");
      }
    }

    // 3. Fallback customerId to project's customer if not explicitly passed
    const customerId = input.customerId || project.customerId || null;

    // 4. Generate unique paymentNumber if not provided
    const paymentNumber = input.paymentNumber || (await this.generatePaymentNumber(organizationId));

    return this.repo.create(organizationId, {
      ...input,
      customerId,
      paymentNumber,
    });
  }

  /**
   * Fetch paginated list of project payments with filters
   */
  async getPayments(organizationId: string, query: GetPaymentsQuery) {
    return this.repo.findAll(organizationId, query);
  }

  /**
   * Fetch single payment by ID
   */
  async getPaymentById(organizationId: string, id: string) {
    const payment = await this.repo.findById(organizationId, id);
    if (!payment) {
      throw new Error("Payment record not found");
    }
    return payment;
  }

  /**
   * Update payment record
   */
  async updatePayment(organizationId: string, id: string, input: UpdatePaymentInput) {
    // 1. Verify existing payment
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) {
      throw new Error("Payment record not found");
    }

    // 2. If milestoneId updated, verify
    if (input.milestoneId && input.milestoneId !== existing.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: {
          id: input.milestoneId,
          projectId: input.projectId || existing.projectId,
          isDeleted: false,
        },
      });
      if (!milestone) {
        throw new Error("Milestone not found in this project");
      }
    }

    return this.repo.update(organizationId, id, input);
  }

  /**
   * Delete payment transaction (Soft delete)
   */
  async deletePayment(organizationId: string, id: string) {
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) {
      throw new Error("Payment record not found");
    }

    await this.repo.delete(organizationId, id);
    return { success: true, message: "Payment transaction deleted successfully" };
  }

  /**
   * Fetch payment financial summary metrics
   */
  async getPaymentSummary(organizationId: string, query: GetPaymentSummaryQuery) {
    return this.repo.getSummary(organizationId, query);
  }
}

export const paymentService = new PaymentService();
