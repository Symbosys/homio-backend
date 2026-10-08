import { payrollRepo } from "../repos/payroll.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, Prisma } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  CreatePayrollPeriodInput,
  GetPayrollPeriodsQueryInput,
  GetPayrollRecordsQueryInput,
  GetMyPayslipsQueryInput,
  UpdatePayrollPeriodInput,
  UpdatePayrollRecordInput,
  DisbursePayrollPeriodInput,
} from "../validators/payroll.validator.js";

export class PayrollService {
  /**
   * Helper: Resolve employee profile for current logged-in user
   */
  private async resolveEmployeeForUser(userId: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });
    if (!employee) {
      throw new ErrorResponse(
        "Employee profile not found for your user account",
        statusCode.Forbidden,
      );
    }
    return employee;
  }

  /**
   * Helper: Upload payslip PDF document
   */
  private async uploadPdfPayslip(
    file: Express.Multer.File,
    organizationId: string,
  ): Promise<ImageType> {
    const result = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        folder: `homio/organizations/${organizationId}/hrms/payroll/payslips`,
        resourceType: "auto",
      },
    );

    return {
      id: result.publicId,
      url: result.secureUrl || result.url,
      bytes: result.bytes || file.size,
      format: result.format || "pdf",
      provider: result.provider || "cloudinary",
    };
  }

  /**
   * Create a monthly payroll period batch
   */
  async createPayrollPeriod(
    organizationId: string,
    userId: string,
    input: CreatePayrollPeriodInput,
  ) {
    // Check if period already exists for month/year
    const existing = await payrollRepo.findPeriodByMonthYear(
      organizationId,
      input.month,
      input.year,
    );
    if (existing) {
      throw new ErrorResponse(
        `Payroll period for ${input.name} (${input.month}/${input.year}) already exists`,
        statusCode.Conflict,
      );
    }

    const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${input.endDate}T23:59:59.999Z`);

    return payrollRepo.createPeriod({
      organizationId,
      name: input.name,
      month: input.month,
      year: input.year,
      startDate,
      endDate,
      currency: input.currency || "INR",
      createdById: userId,
    });
  }

  /**
   * Get all payroll period runs for organization
   */
  async getPayrollPeriods(
    organizationId: string,
    filters: GetPayrollPeriodsQueryInput,
  ) {
    return payrollRepo.findAllPeriods(organizationId, filters);
  }

  /**
   * Get single payroll period by ID
   */
  async getPayrollPeriodById(id: string, organizationId: string) {
    const period = await payrollRepo.findPeriodById(id, organizationId);
    if (!period) {
      throw new ErrorResponse("Payroll period not found", statusCode.Not_Found);
    }
    return period;
  }

  /**
   * Process & Calculate payroll for all employees for a payroll period
   * Pulls salary structures, actual attendance, approved leaves & travel expenses
   */
  async processPayrollPeriod(periodId: string, organizationId: string) {
    const period = await payrollRepo.findPeriodById(periodId, organizationId);
    if (!period) {
      throw new ErrorResponse("Payroll period not found", statusCode.Not_Found);
    }
    if (period.status === "DISBURSED") {
      throw new ErrorResponse(
        "Cannot re-process an already disbursed payroll period",
        statusCode.Bad_Request,
      );
    }

    // 1. Fetch all active employees in the organization with their active salary structure
    const employees = await prisma.employee.findMany({
      where: {
        organizationId,
        isDeleted: false,
        employmentStatus: "ACTIVE",
      },
      include: {
        salaries: {
          where: { isCurrent: true, isDeleted: false },
          take: 1,
        },
      },
    });

    if (employees.length === 0) {
      throw new ErrorResponse(
        "No active employees found in organization to process",
        statusCode.Bad_Request,
      );
    }

    const startDate = period.startDate;
    const endDate = period.endDate;

    // Calculate total days in the period (standard 30 or date difference)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const daysInPeriod = Math.min(
      31,
      Math.max(28, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1),
    );
    const standardWorkingDays = daysInPeriod;

    // 2. Compute payroll record for each employee
    for (const employee of employees) {
      const salary = employee.salaries[0];
      const basicMonthly = salary ? Number(salary.basicSalary) : 0;
      const hraMonthly = salary ? Number(salary.hra) : 0;
      const conveyanceMonthly = salary ? Number(salary.conveyanceAllowance) : 0;
      const specialMonthly = salary ? Number(salary.specialAllowance) : 0;
      const medicalMonthly = salary ? Number(salary.medicalAllowance) : 0;
      const otherAllowancesMonthly = salary
        ? Number(salary.otherAllowances)
        : 0;

      const pfEmployeeMonthly = salary ? Number(salary.pfEmployee) : 0;
      const esiEmployeeMonthly = salary ? Number(salary.esiEmployee) : 0;
      const ptMonthly = salary ? Number(salary.professionalTax) : 0;
      const tdsMonthly = salary ? Number(salary.tdsMonthly) : 0;

      // 3. Fetch attendance in period
      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId: employee.id,
          organizationId,
          attendanceDate: { gte: startDate, lte: endDate },
        },
      });

      // 4. Fetch approved leaves in period
      const approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          organizationId,
          status: "APPROVED",
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        include: { leaveType: true },
      });

      // Day-by-day attendance calculation matching getRecordAttendanceCalculation
      const attendanceMap = new Map<string, (typeof attendances)[0]>();
      for (const att of attendances) {
        const dateStr = att.attendanceDate.toISOString().slice(0, 10);
        attendanceMap.set(dateStr, att);
      }

      let presentDays = 0;
      let halfDays = 0;
      let absentDays = 0;
      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;
      let holidayDays = 0;
      let weekOffDays = 0;
      let totalPaidMultiplier = 0;

      const current = new Date(startDate);
      const end = new Date(endDate);

      while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10);
        const isWeekend = current.getDay() === 0 || current.getDay() === 6;

        const att = attendanceMap.get(dateStr);
        const leave = approvedLeaves.find((l) => {
          const lStart = new Date(l.startDate);
          const lEnd = new Date(l.endDate);
          return current >= lStart && current <= lEnd;
        });

        let multiplier = 0.0;

        if (att) {
          if (att.status === "PRESENT") {
            presentDays += 1;
            multiplier = 1.0;
          } else if (att.status === "HALF_DAY") {
            halfDays += 1;
            multiplier = 0.5;
            presentDays += 0.5;
          } else if (att.status === "ABSENT") {
            absentDays += 1;
            multiplier = 0.0;
          } else if (att.status === "HOLIDAY") {
            holidayDays += 1;
            multiplier = 1.0;
            presentDays += 1.0;
          } else if (att.status === "WEEK_OFF") {
            weekOffDays += 1;
            multiplier = 1.0;
            presentDays += 1.0;
          } else if (att.status === "ON_LEAVE") {
            if (leave && leave.leaveType.isPaid) {
              paidLeaveDays += 1;
              multiplier = 1.0;
            } else {
              unpaidLeaveDays += 1;
              multiplier = 0.0;
            }
          }
        } else if (leave) {
          if (leave.leaveType.isPaid) {
            paidLeaveDays += 1;
            multiplier = 1.0;
          } else {
            unpaidLeaveDays += 1;
            multiplier = 0.0;
          }
        } else if (isWeekend) {
          weekOffDays += 1;
          multiplier = 1.0;
          presentDays += 1.0;
        } else {
          // Unrecorded workday -> ABSENT (100% pay deducted)
          absentDays += 1;
          multiplier = 0.0;
        }

        totalPaidMultiplier += multiplier;
        current.setDate(current.getDate() + 1);
      }

      const totalEffectiveDays = totalPaidMultiplier;
      const attendanceRatio =
        standardWorkingDays > 0 ? totalEffectiveDays / standardWorkingDays : 1;

      // Pro-rated earnings based on attendance
      const basic = Math.round(basicMonthly * attendanceRatio);
      const hra = Math.round(hraMonthly * attendanceRatio);
      const conveyance = Math.round(conveyanceMonthly * attendanceRatio);
      const special = Math.round(specialMonthly * attendanceRatio);
      const medical = Math.round(medicalMonthly * attendanceRatio);
      const otherAllowances = Math.round(
        otherAllowancesMonthly * attendanceRatio,
      );
      const incentivesTotal = 0; // Default or manual override
      const travelReimbursement = 0; // Mileage / approved travel expenses

      const grossEarnings =
        basic +
        hra +
        conveyance +
        special +
        medical +
        otherAllowances +
        incentivesTotal +
        travelReimbursement;

      // Deductions
      const pf = pfEmployeeMonthly;
      const esi = esiEmployeeMonthly;
      const pt = ptMonthly;
      const tds = tdsMonthly;
      const penaltyDeduction = 0;
      const otherDeductions = 0;

      const totalDeductions =
        pf + esi + pt + tds + penaltyDeduction + otherDeductions;
      const netPay = Math.max(0, grossEarnings - totalDeductions);

      await payrollRepo.upsertRecord({
        payrollPeriodId: periodId,
        employeeId: employee.id,
        salaryStructureId: salary ? salary.id : null,
        workingDays: standardWorkingDays,
        presentDays,
        paidLeaveDays,
        unpaidLeaveDays,
        penaltyDeductionDays: 0,
        basicSalary: basic,
        hra,
        conveyanceAllowance: conveyance,
        specialAllowance: special,
        medicalAllowance: medical,
        otherAllowances,
        incentivesTotal,
        travelReimbursement,
        grossEarnings,
        pfEmployee: pf,
        esiEmployee: esi,
        professionalTax: pt,
        tds,
        policyPenaltyDeduction: penaltyDeduction,
        otherDeductions,
        totalDeductions,
        netPay,
        currency: period.currency || "INR",
        paymentMode: "BANK_TRANSFER",
        paymentStatus: "PENDING",
      });
    }

    // 5. Update period summary totals
    return payrollRepo.recalculatePeriodTotals(periodId);
  }

  /**
   * Disburse payroll period (Batch payment execution)
   */
  async disbursePayrollPeriod(
    periodId: string,
    organizationId: string,
    input: DisbursePayrollPeriodInput,
  ) {
    const period = await payrollRepo.findPeriodById(periodId, organizationId);
    if (!period) {
      throw new ErrorResponse("Payroll period not found", statusCode.Not_Found);
    }
    if (period.status === "DRAFT") {
      throw new ErrorResponse(
        "Please process the payroll period before disbursing",
        statusCode.Bad_Request,
      );
    }

    const now = new Date();

    // Mark all individual records in this period as PAID with bank batch ref
    await payrollRepo.disburseAllRecordsInPeriod(periodId, {
      paymentMode: input.paymentMode,
      bankBatchRef: input.bankBatchRef,
      paidDate: now,
    });

    // Update period status to DISBURSED
    return payrollRepo.updatePeriod(periodId, organizationId, {
      status: "DISBURSED",
      bankBatchRef: input.bankBatchRef,
      disbursedAt: now,
    });
  }

  /**
   * Update individual payroll record (e.g. add bonus, incentive, penalty)
   */
  async updatePayrollRecord(
    recordId: string,
    organizationId: string,
    input: UpdatePayrollRecordInput,
  ) {
    const record = await payrollRepo.findRecordById(recordId, organizationId);
    if (!record) {
      throw new ErrorResponse("Payroll record not found", statusCode.Not_Found);
    }

    const updated = await payrollRepo.updateRecord(recordId, input);

    // Recalculate net pay if earnings or deductions changed
    const basic =
      input.basicSalary != null
        ? input.basicSalary
        : Number(updated.basicSalary);
    const hra = input.hra != null ? input.hra : Number(updated.hra);
    const conveyance =
      input.conveyanceAllowance != null
        ? input.conveyanceAllowance
        : Number(updated.conveyanceAllowance);
    const special =
      input.specialAllowance != null
        ? input.specialAllowance
        : Number(updated.specialAllowance);
    const medical =
      input.medicalAllowance != null
        ? input.medicalAllowance
        : Number(updated.medicalAllowance);
    const otherAllowances =
      input.otherAllowances != null
        ? input.otherAllowances
        : Number(updated.otherAllowances);
    const incentives =
      input.incentivesTotal != null
        ? input.incentivesTotal
        : Number(updated.incentivesTotal);
    const travel =
      input.travelReimbursement != null
        ? input.travelReimbursement
        : Number(updated.travelReimbursement);

    const grossEarnings =
      basic +
      hra +
      conveyance +
      special +
      medical +
      otherAllowances +
      incentives +
      travel;

    const pf =
      input.pfEmployee != null ? input.pfEmployee : Number(updated.pfEmployee);
    const esi =
      input.esiEmployee != null
        ? input.esiEmployee
        : Number(updated.esiEmployee);
    const pt =
      input.professionalTax != null
        ? input.professionalTax
        : Number(updated.professionalTax);
    const tds = input.tds != null ? input.tds : Number(updated.tds);
    const penalty =
      input.policyPenaltyDeduction != null
        ? input.policyPenaltyDeduction
        : Number(updated.policyPenaltyDeduction);
    const otherDeductions =
      input.otherDeductions != null
        ? input.otherDeductions
        : Number(updated.otherDeductions);

    const totalDeductions = pf + esi + pt + tds + penalty + otherDeductions;
    const netPay = Math.max(0, grossEarnings - totalDeductions);

    await prisma.payrollRecord.update({
      where: { id: recordId },
      data: {
        grossEarnings: new Prisma.Decimal(grossEarnings),
        totalDeductions: new Prisma.Decimal(totalDeductions),
        netPay: new Prisma.Decimal(netPay),
      },
    });

    // Recalculate period totals
    await payrollRepo.recalculatePeriodTotals(record.payrollPeriodId);

    return payrollRepo.findRecordById(recordId, organizationId);
  }

  /**
   * Upload and attach signed/generated PDF payslip
   */
  async uploadPayslipPdf(
    recordId: string,
    organizationId: string,
    file: Express.Multer.File,
  ) {
    const record = await payrollRepo.findRecordById(recordId, organizationId);
    if (!record) {
      throw new ErrorResponse("Payroll record not found", statusCode.Not_Found);
    }

    const uploadedPdf = await this.uploadPdfPayslip(file, organizationId);
    await payrollRepo.attachPayslipPdf(recordId, uploadedPdf);

    return {
      payslipPdf: uploadedPdf,
      message: "Payslip PDF uploaded and attached successfully",
    };
  }

  /**
   * List all payslip records for organization
   */
  async getAllPayrollRecords(
    organizationId: string,
    filters: GetPayrollRecordsQueryInput,
  ) {
    return payrollRepo.findAllRecords(organizationId, filters);
  }

  /**
   * List personal payslips for logged-in employee
   */
  async getMyPayslips(
    organizationId: string,
    userId: string,
    filters: GetMyPayslipsQueryInput,
  ) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    return payrollRepo.findMyPayslips(employee.id, organizationId, filters);
  }

  /**
   * Get single payslip record by ID
   */
  async getPayrollRecordById(id: string, organizationId: string) {
    const record = await payrollRepo.findRecordById(id, organizationId);
    if (!record) {
      throw new ErrorResponse("Payroll record not found", statusCode.Not_Found);
    }
    return record;
  }

  /**
   * Get detailed day-by-day attendance-based salary calculation breakdown for a payroll record
   */
  async getRecordAttendanceCalculation(
    recordId: string,
    organizationId: string,
  ) {
    const record = await payrollRepo.findRecordById(recordId, organizationId);
    if (!record) {
      throw new ErrorResponse("Payroll record not found", statusCode.Not_Found);
    }

    const { payrollPeriod, employee, salaryStructure } = record;
    const startDate = payrollPeriod.startDate;
    const endDate = payrollPeriod.endDate;

    // Calculate total days in the period
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const daysInPeriod = Math.min(
      31,
      Math.max(28, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1),
    );
    const standardWorkingDays = daysInPeriod;

    // Fetch all attendances in period
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: employee.id,
        organizationId,
        attendanceDate: { gte: startDate, lte: endDate },
      },
      orderBy: { attendanceDate: "asc" },
    });

    const attendanceMap = new Map<string, (typeof attendances)[0]>();
    for (const att of attendances) {
      const dateStr = att.attendanceDate.toISOString().slice(0, 10);
      attendanceMap.set(dateStr, att);
    }

    // Fetch approved leaves in period
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        organizationId,
        status: "APPROVED",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { leaveType: true },
    });

    // Base Monthly Salary
    const basicMonthly = salaryStructure
      ? Number(salaryStructure.basicSalary)
      : Number(record.basicSalary);
    const hraMonthly = salaryStructure
      ? Number(salaryStructure.hra)
      : Number(record.hra);
    const conveyanceMonthly = salaryStructure
      ? Number(salaryStructure.conveyanceAllowance)
      : Number(record.conveyanceAllowance);
    const specialMonthly = salaryStructure
      ? Number(salaryStructure.specialAllowance)
      : Number(record.specialAllowance);
    const medicalMonthly = salaryStructure
      ? Number(salaryStructure.medicalAllowance)
      : Number(record.medicalAllowance);
    const otherAllowancesMonthly = salaryStructure
      ? Number(salaryStructure.otherAllowances)
      : Number(record.otherAllowances);

    const baseMonthlyGross =
      basicMonthly +
      hraMonthly +
      conveyanceMonthly +
      specialMonthly +
      medicalMonthly +
      otherAllowancesMonthly;
    const dailyWageRate =
      standardWorkingDays > 0
        ? Math.round((baseMonthlyGross / standardWorkingDays) * 100) / 100
        : 0;
    const basicDailyRate =
      standardWorkingDays > 0
        ? Math.round((basicMonthly / standardWorkingDays) * 100) / 100
        : 0;

    // Build day-by-day logs
    const dailyLogs = [];
    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let paidLeaveCount = 0;
    let unpaidLeaveCount = 0;
    let holidayCount = 0;
    let weekOffCount = 0;
    let totalPaidMultiplier = 0;

    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      const dayName = current.toLocaleDateString("en-US", { weekday: "short" });
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;

      const att = attendanceMap.get(dateStr);

      // Check if on approved leave
      const leave = approvedLeaves.find((l) => {
        const lStart = new Date(l.startDate);
        const lEnd = new Date(l.endDate);
        return current >= lStart && current <= lEnd;
      });

      let status:
        | "PRESENT"
        | "HALF_DAY"
        | "ABSENT"
        | "ON_LEAVE"
        | "HOLIDAY"
        | "WEEK_OFF"
        | "UNRECORDED" = "UNRECORDED";
      let isPaid = true;
      let multiplier = 1.0;
      let remarks = att?.remarks || "";

      if (att) {
        status = att.status;
        if (att.status === "PRESENT") {
          presentCount += 1;
          multiplier = 1.0;
        } else if (att.status === "HALF_DAY") {
          halfDayCount += 1;
          multiplier = 0.5;
          remarks = remarks || "Half day: 50% pay deducted";
        } else if (att.status === "ABSENT") {
          absentCount += 1;
          multiplier = 0.0;
          isPaid = false;
          remarks = remarks || "Absent: 100% pay deducted";
        } else if (att.status === "HOLIDAY") {
          holidayCount += 1;
          multiplier = 1.0;
          remarks = remarks || "Paid public holiday";
        } else if (att.status === "WEEK_OFF") {
          weekOffCount += 1;
          multiplier = 1.0;
          remarks = remarks || "Weekly off (compensated)";
        } else if (att.status === "ON_LEAVE") {
          if (leave?.leaveType?.isPaid) {
            paidLeaveCount += 1;
            multiplier = 1.0;
            remarks =
              remarks || `Approved paid leave (${leave.leaveType.name})`;
          } else {
            unpaidLeaveCount += 1;
            multiplier = 0.0;
            isPaid = false;
            remarks = remarks || "Unpaid leave / LOP";
          }
        }
      } else if (leave) {
        status = "ON_LEAVE";
        if (leave.leaveType.isPaid) {
          paidLeaveCount += 1;
          multiplier = 1.0;
          remarks = `Approved paid leave (${leave.leaveType.name})`;
        } else {
          unpaidLeaveCount += 1;
          multiplier = 0.0;
          isPaid = false;
          remarks = "Unpaid leave / LOP";
        }
      } else if (isWeekend) {
        status = "WEEK_OFF";
        weekOffCount += 1;
        multiplier = 1.0;
        remarks = "Weekly off (weekend)";
      } else {
        // Unrecorded workday -> ABSENT (100% pay deducted)
        status = "ABSENT";
        absentCount += 1;
        multiplier = 0.0;
        isPaid = false;
        remarks = "Unrecorded absence: 100% pay deducted";
      }

      totalPaidMultiplier += multiplier;
      const dayEarned = Math.round(dailyWageRate * multiplier * 100) / 100;
      const dayDeduction =
        Math.round(dailyWageRate * (1.0 - multiplier) * 100) / 100;

      dailyLogs.push({
        date: dateStr,
        dayName,
        status,
        punchInTime: att?.punchInTime || null,
        punchOutTime: att?.punchOutTime || null,
        isPaid,
        multiplier,
        dayEarned,
        dayDeduction,
        remarks,
      });

      current.setDate(current.getDate() + 1);
    }

    const effectivePayableDays = totalPaidMultiplier;
    const effectiveDeductedDays = standardWorkingDays - effectivePayableDays;
    const attendanceRatio =
      standardWorkingDays > 0 ? effectivePayableDays / standardWorkingDays : 1;

    const calculatedGrossPay = Math.round(baseMonthlyGross * attendanceRatio);
    const attendanceDeductionAmount = Math.max(
      0,
      baseMonthlyGross - calculatedGrossPay,
    );

    return {
      recordId: record.id,
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        designation: employee.designation,
        avatarUrl: employee.avatarUrl,
        department:
          employee.departmentAssignments?.[0]?.department?.name || "General",
      },
      payrollPeriod: {
        id: payrollPeriod.id,
        name: payrollPeriod.name,
        month: payrollPeriod.month,
        year: payrollPeriod.year,
        startDate: payrollPeriod.startDate,
        endDate: payrollPeriod.endDate,
        status: payrollPeriod.status,
      },
      salaryStructure: {
        monthlyGross: baseMonthlyGross,
        basicSalary: basicMonthly,
        hra: hraMonthly,
        allowances:
          conveyanceMonthly +
          specialMonthly +
          medicalMonthly +
          otherAllowancesMonthly,
        dailyWageRate,
        basicDailyRate,
      },
      attendanceStats: {
        totalDaysInCycle: standardWorkingDays,
        presentDays: presentCount,
        halfDays: halfDayCount,
        absentDays: absentCount,
        paidLeaveDays: paidLeaveCount,
        unpaidLeaveDays: unpaidLeaveCount,
        holidayDays: holidayCount,
        weekOffDays: weekOffCount,
        effectivePayableDays,
        effectiveDeductedDays,
        attendanceRatio: Math.round(attendanceRatio * 10000) / 100,
      },
      calculationBreakdown: {
        baseMonthlyGross,
        dailyWageRate,
        effectivePayableDays,
        effectiveDeductedDays,
        calculatedGrossPay,
        attendanceDeductionAmount,
        otherEarnings:
          Number(record.incentivesTotal) + Number(record.travelReimbursement),
        statutoryDeductions: Number(record.totalDeductions),
        finalNetPay: Number(record.netPay),
      },
      dailyLogs,
    };
  }

  /**
   * Delete payroll period
   */
  async deletePayrollPeriod(id: string, organizationId: string) {
    const period = await payrollRepo.findPeriodById(id, organizationId);
    if (!period) {
      throw new ErrorResponse("Payroll period not found", statusCode.Not_Found);
    }
    if (period.status === "DISBURSED") {
      throw new ErrorResponse(
        "Cannot delete an already disbursed payroll period",
        statusCode.Bad_Request,
      );
    }

    await payrollRepo.deletePeriod(id, organizationId);
    return { success: true, message: "Payroll period deleted successfully" };
  }
}

export const payrollService = new PayrollService();
