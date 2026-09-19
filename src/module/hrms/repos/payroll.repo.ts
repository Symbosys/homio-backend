import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  GetPayrollPeriodsQueryInput,
  GetPayrollRecordsQueryInput,
  GetMyPayslipsQueryInput,
  UpdatePayrollRecordInput,
} from "../validators/payroll.validator.js";

export class PayrollRepository {
  /**
   * Create a corporate monthly payroll batch period
   */
  async createPeriod(params: {
    organizationId: string;
    name: string;
    month: number;
    year: number;
    startDate: Date;
    endDate: Date;
    currency?: string;
    createdById?: string | null;
  }) {
    return prisma.payrollPeriod.create({
      data: {
        organizationId: params.organizationId,
        name: params.name,
        month: params.month,
        year: params.year,
        startDate: params.startDate,
        endDate: params.endDate,
        currency: params.currency || "INR",
        createdById: params.createdById || undefined,
        status: "DRAFT",
      },
    });
  }

  /**
   * Find payroll period by month & year for tenant
   */
  async findPeriodByMonthYear(organizationId: string, month: number, year: number) {
    return prisma.payrollPeriod.findFirst({
      where: {
        organizationId,
        month,
        year,
        isDeleted: false,
      },
    });
  }

  /**
   * Find single payroll period by ID
   */
  async findPeriodById(id: string, organizationId: string) {
    return prisma.payrollPeriod.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        _count: {
          select: { records: true },
        },
      },
    });
  }

  /**
   * List all payroll periods for organization
   */
  async findAllPeriods(organizationId: string, filters: GetPayrollPeriodsQueryInput) {
    const { page, limit, status, year, search, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PayrollPeriodWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status && { status }),
      ...(year && { year }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { bankBatchRef: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [periods, total] = await Promise.all([
      prisma.payrollPeriod.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { records: true },
          },
        },
      }),
      prisma.payrollPeriod.count({ where }),
    ]);

    return {
      periods,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update payroll period
   */
  async updatePeriod(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      status?: "DRAFT" | "PROCESSED" | "DISBURSED" | "CANCELLED";
      bankBatchRef?: string | null;
      processedAt?: Date | null;
      disbursedAt?: Date | null;
      updatedById?: string | null;
    }
  ) {
    return prisma.payrollPeriod.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.status && { status: data.status }),
        ...(data.bankBatchRef !== undefined && { bankBatchRef: data.bankBatchRef }),
        ...(data.processedAt !== undefined && { processedAt: data.processedAt }),
        ...(data.disbursedAt !== undefined && { disbursedAt: data.disbursedAt }),
        ...(data.updatedById && { updatedById: data.updatedById }),
      },
    });
  }

  /**
   * Soft delete payroll period
   */
  async deletePeriod(id: string, organizationId: string) {
    return prisma.payrollPeriod.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Upsert calculated payroll record for an employee in a period
   */
  async upsertRecord(data: {
    payrollPeriodId: string;
    employeeId: string;
    salaryStructureId?: string | null;
    workingDays: number;
    presentDays: number;
    paidLeaveDays: number;
    unpaidLeaveDays: number;
    penaltyDeductionDays: number;
    basicSalary: number;
    hra: number;
    conveyanceAllowance: number;
    specialAllowance: number;
    medicalAllowance: number;
    otherAllowances: number;
    incentivesTotal: number;
    travelReimbursement: number;
    grossEarnings: number;
    pfEmployee: number;
    esiEmployee: number;
    professionalTax: number;
    tds: number;
    policyPenaltyDeduction: number;
    otherDeductions: number;
    totalDeductions: number;
    netPay: number;
    currency?: string;
    paymentMode?: "BANK_TRANSFER" | "CHEQUE" | "CASH" | "UPI";
    paymentStatus?: "PENDING" | "PAID" | "FAILED";
  }) {
    return prisma.payrollRecord.upsert({
      where: {
        payrollPeriodId_employeeId: {
          payrollPeriodId: data.payrollPeriodId,
          employeeId: data.employeeId,
        },
      },
      create: {
        payrollPeriodId: data.payrollPeriodId,
        employeeId: data.employeeId,
        salaryStructureId: data.salaryStructureId || undefined,
        workingDays: data.workingDays,
        presentDays: new Prisma.Decimal(data.presentDays),
        paidLeaveDays: new Prisma.Decimal(data.paidLeaveDays),
        unpaidLeaveDays: new Prisma.Decimal(data.unpaidLeaveDays),
        penaltyDeductionDays: new Prisma.Decimal(data.penaltyDeductionDays),
        basicSalary: new Prisma.Decimal(data.basicSalary),
        hra: new Prisma.Decimal(data.hra),
        conveyanceAllowance: new Prisma.Decimal(data.conveyanceAllowance),
        specialAllowance: new Prisma.Decimal(data.specialAllowance),
        medicalAllowance: new Prisma.Decimal(data.medicalAllowance),
        otherAllowances: new Prisma.Decimal(data.otherAllowances),
        incentivesTotal: new Prisma.Decimal(data.incentivesTotal),
        travelReimbursement: new Prisma.Decimal(data.travelReimbursement),
        grossEarnings: new Prisma.Decimal(data.grossEarnings),
        pfEmployee: new Prisma.Decimal(data.pfEmployee),
        esiEmployee: new Prisma.Decimal(data.esiEmployee),
        professionalTax: new Prisma.Decimal(data.professionalTax),
        tds: new Prisma.Decimal(data.tds),
        policyPenaltyDeduction: new Prisma.Decimal(data.policyPenaltyDeduction),
        otherDeductions: new Prisma.Decimal(data.otherDeductions),
        totalDeductions: new Prisma.Decimal(data.totalDeductions),
        netPay: new Prisma.Decimal(data.netPay),
        currency: data.currency || "INR",
        paymentMode: data.paymentMode || "BANK_TRANSFER",
        paymentStatus: data.paymentStatus || "PENDING",
      },
      update: {
        salaryStructureId: data.salaryStructureId || undefined,
        workingDays: data.workingDays,
        presentDays: new Prisma.Decimal(data.presentDays),
        paidLeaveDays: new Prisma.Decimal(data.paidLeaveDays),
        unpaidLeaveDays: new Prisma.Decimal(data.unpaidLeaveDays),
        penaltyDeductionDays: new Prisma.Decimal(data.penaltyDeductionDays),
        basicSalary: new Prisma.Decimal(data.basicSalary),
        hra: new Prisma.Decimal(data.hra),
        conveyanceAllowance: new Prisma.Decimal(data.conveyanceAllowance),
        specialAllowance: new Prisma.Decimal(data.specialAllowance),
        medicalAllowance: new Prisma.Decimal(data.medicalAllowance),
        otherAllowances: new Prisma.Decimal(data.otherAllowances),
        incentivesTotal: new Prisma.Decimal(data.incentivesTotal),
        travelReimbursement: new Prisma.Decimal(data.travelReimbursement),
        grossEarnings: new Prisma.Decimal(data.grossEarnings),
        pfEmployee: new Prisma.Decimal(data.pfEmployee),
        esiEmployee: new Prisma.Decimal(data.esiEmployee),
        professionalTax: new Prisma.Decimal(data.professionalTax),
        tds: new Prisma.Decimal(data.tds),
        policyPenaltyDeduction: new Prisma.Decimal(data.policyPenaltyDeduction),
        otherDeductions: new Prisma.Decimal(data.otherDeductions),
        totalDeductions: new Prisma.Decimal(data.totalDeductions),
        netPay: new Prisma.Decimal(data.netPay),
      },
    });
  }

  /**
   * Recalculate and update summary totals of a Payroll Period
   */
  async recalculatePeriodTotals(periodId: string) {
    const records = await prisma.payrollRecord.findMany({
      where: { payrollPeriodId: periodId },
      select: {
        grossEarnings: true,
        totalDeductions: true,
        netPay: true,
      },
    });

    const totalEmployees = records.length;
    let totalGross = new Prisma.Decimal(0);
    let totalDeductions = new Prisma.Decimal(0);
    let totalNet = new Prisma.Decimal(0);

    for (const r of records) {
      totalGross = totalGross.plus(r.grossEarnings);
      totalDeductions = totalDeductions.plus(r.totalDeductions);
      totalNet = totalNet.plus(r.netPay);
    }

    return prisma.payrollPeriod.update({
      where: { id: periodId },
      data: {
        totalEmployees,
        totalGross,
        totalDeductions,
        totalNet,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
  }

  /**
   * Find single payslip record by ID scoped to tenant
   */
  async findRecordById(id: string, organizationId: string) {
    return prisma.payrollRecord.findFirst({
      where: {
        id,
        payrollPeriod: { organizationId },
      },
      include: {
        payrollPeriod: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
            workEmail: true,
            workPhone: true,
            panNumber: true,
            aadhaarNumber: true,
            bankAccountNumber: true,
            bankIfscCode: true,
            bankName: true,
            departmentAssignments: {
              include: { department: true, team: true },
            },
          },
        },
        salaryStructure: true,
      },
    });
  }

  /**
   * List all payslip records for organization (Admin / HR)
   */
  async findAllRecords(organizationId: string, filters: GetPayrollRecordsQueryInput) {
    const {
      page,
      limit,
      payrollPeriodId,
      employeeId,
      paymentStatus,
      search,
      sortBy,
      sortOrder,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.PayrollRecordWhereInput = {
      payrollPeriod: {
        organizationId,
        ...(payrollPeriodId && { id: payrollPeriodId }),
      },
      ...(employeeId && { employeeId }),
      ...(paymentStatus && { paymentStatus }),
      ...(search && {
        employee: {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { employeeCode: { contains: search, mode: "insensitive" } },
          ],
        },
      }),
    };

    const [records, total] = await Promise.all([
      prisma.payrollRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          payrollPeriod: {
            select: { id: true, name: true, month: true, year: true, status: true },
          },
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              avatarUrl: true,
              departmentAssignments: {
                include: { department: true },
              },
            },
          },
        },
      }),
      prisma.payrollRecord.count({ where }),
    ]);

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List personal payslips for an employee
   */
  async findMyPayslips(
    employeeId: string,
    organizationId: string,
    filters: GetMyPayslipsQueryInput
  ) {
    const { page, limit, year } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PayrollRecordWhereInput = {
      employeeId,
      payrollPeriod: {
        organizationId,
        ...(year && { year }),
      },
    };

    const [records, total] = await Promise.all([
      prisma.payrollRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { payrollPeriod: { startDate: "desc" } },
        include: {
          payrollPeriod: {
            select: { id: true, name: true, month: true, year: true, status: true, disbursedAt: true },
          },
        },
      }),
      prisma.payrollRecord.count({ where }),
    ]);

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update individual payroll record
   */
  async updateRecord(id: string, data: UpdatePayrollRecordInput) {
    return prisma.payrollRecord.update({
      where: { id },
      data: {
        ...(data.workingDays != null && { workingDays: data.workingDays }),
        ...(data.presentDays != null && { presentDays: new Prisma.Decimal(data.presentDays) }),
        ...(data.paidLeaveDays != null && { paidLeaveDays: new Prisma.Decimal(data.paidLeaveDays) }),
        ...(data.unpaidLeaveDays != null && { unpaidLeaveDays: new Prisma.Decimal(data.unpaidLeaveDays) }),
        ...(data.penaltyDeductionDays != null && {
          penaltyDeductionDays: new Prisma.Decimal(data.penaltyDeductionDays),
        }),
        ...(data.basicSalary != null && { basicSalary: new Prisma.Decimal(data.basicSalary) }),
        ...(data.hra != null && { hra: new Prisma.Decimal(data.hra) }),
        ...(data.conveyanceAllowance != null && {
          conveyanceAllowance: new Prisma.Decimal(data.conveyanceAllowance),
        }),
        ...(data.specialAllowance != null && {
          specialAllowance: new Prisma.Decimal(data.specialAllowance),
        }),
        ...(data.medicalAllowance != null && {
          medicalAllowance: new Prisma.Decimal(data.medicalAllowance),
        }),
        ...(data.otherAllowances != null && {
          otherAllowances: new Prisma.Decimal(data.otherAllowances),
        }),
        ...(data.incentivesTotal != null && {
          incentivesTotal: new Prisma.Decimal(data.incentivesTotal),
        }),
        ...(data.travelReimbursement != null && {
          travelReimbursement: new Prisma.Decimal(data.travelReimbursement),
        }),
        ...(data.pfEmployee != null && { pfEmployee: new Prisma.Decimal(data.pfEmployee) }),
        ...(data.esiEmployee != null && { esiEmployee: new Prisma.Decimal(data.esiEmployee) }),
        ...(data.professionalTax != null && {
          professionalTax: new Prisma.Decimal(data.professionalTax),
        }),
        ...(data.tds != null && { tds: new Prisma.Decimal(data.tds) }),
        ...(data.policyPenaltyDeduction != null && {
          policyPenaltyDeduction: new Prisma.Decimal(data.policyPenaltyDeduction),
        }),
        ...(data.otherDeductions != null && {
          otherDeductions: new Prisma.Decimal(data.otherDeductions),
        }),
        ...(data.paymentMode && { paymentMode: data.paymentMode }),
        ...(data.paymentStatus && { paymentStatus: data.paymentStatus }),
        ...(data.paymentReference !== undefined && { paymentReference: data.paymentReference }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });
  }

  /**
   * Disburse all records in a payroll period
   */
  async disburseAllRecordsInPeriod(
    periodId: string,
    params: {
      paymentMode: "BANK_TRANSFER" | "CHEQUE" | "CASH" | "UPI";
      bankBatchRef: string;
      paidDate: Date;
    }
  ) {
    return prisma.payrollRecord.updateMany({
      where: { payrollPeriodId: periodId },
      data: {
        paymentStatus: "PAID",
        paymentMode: params.paymentMode,
        paymentReference: params.bankBatchRef,
        paidDate: params.paidDate,
      },
    });
  }

  /**
   * Attach payslip PDF to payroll record
   */
  async attachPayslipPdf(id: string, payslipPdf: any) {
    return prisma.payrollRecord.update({
      where: { id },
      data: { payslipPdf },
    });
  }
}

export const payrollRepo = new PayrollRepository();
