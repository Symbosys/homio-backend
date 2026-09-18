import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { CreateSalaryStructureInput, UpdateSalaryStructureInput } from "../validators/salary.validator.js";

export class SalaryRepository {
  /**
   * Get the active current salary record for an employee
   */
  async getCurrentSalary(employeeId: string, organizationId: string) {
    return prisma.employeeSalary.findFirst({
      where: {
        employeeId,
        organizationId,
        isCurrent: true,
        isDeleted: false,
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
   * Get the full historical timeline of salary revisions for an employee (ordered newest to oldest)
   */
  async getSalaryHistory(employeeId: string, organizationId: string) {
    return prisma.employeeSalary.findMany({
      where: {
        employeeId,
        organizationId,
        isDeleted: false,
      },
      orderBy: {
        effectiveFrom: "desc",
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
   * Find single salary record by ID
   */
  async findById(id: string, organizationId: string) {
    return prisma.employeeSalary.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
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
   * Atomically create a new salary structure revision:
   * 1. Closes out the previous active salary by setting effectiveTo = effectiveFrom - 1 day, and isCurrent = false.
   * 2. Inserts the new revision with isCurrent = true, effectiveTo = null.
   */
  async createSalaryRevisionWithTransaction(
    organizationId: string,
    employeeId: string,
    data: CreateSalaryStructureInput,
    createdById?: string
  ) {
    const {
      effectiveFrom,
      revisionDate,
      incrementLetterUrl,
      customComponents,
      percentageHike,
      remarks,
      annualCtc,
      monthlyGross,
      monthlyNet,
      basicSalary,
      hra,
      dearnessAllowance,
      conveyanceAllowance,
      specialAllowance,
      medicalAllowance,
      otherAllowances,
      pfEmployee,
      esiEmployee,
      professionalTax,
      tdsMonthly,
      pfEmployer,
      esiEmployer,
      gratuityMonthly,
      insuranceMonthly,
      currency,
      payFrequency,
      revisionReason,
    } = data;

    const newEffectiveStartDate = new Date(effectiveFrom);

    return prisma.$transaction(async (tx) => {
      // 1. Locate the currently active salary structure (if any)
      const existingActiveSalary = await tx.employeeSalary.findFirst({
        where: {
          employeeId,
          organizationId,
          isCurrent: true,
          isDeleted: false,
        },
      });

      if (existingActiveSalary) {
        // Calculate the closing day for the previous period (day before the new effective date)
        const previousEndDate = new Date(newEffectiveStartDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);

        await tx.employeeSalary.update({
          where: { id: existingActiveSalary.id },
          data: {
            effectiveTo: previousEndDate,
            isCurrent: false,
          },
        });
      }

      // 2. Insert the new active salary structure
      const newSalary = await tx.employeeSalary.create({
        data: {
          organizationId,
          employeeId,
          effectiveFrom: newEffectiveStartDate,
          effectiveTo: null, // Open-ended current package
          isCurrent: true,
          revisionReason,
          revisionDate: revisionDate ? new Date(revisionDate) : new Date(),
          percentageHike: percentageHike ? new Prisma.Decimal(percentageHike) : null,
          remarks,
          approvedById: createdById,
          createdById,
          incrementLetterUrl: incrementLetterUrl ? (incrementLetterUrl as Prisma.InputJsonValue) : Prisma.JsonNull,

          currency,
          payFrequency,

          annualCtc: new Prisma.Decimal(annualCtc),
          monthlyGross: new Prisma.Decimal(monthlyGross),
          monthlyNet: monthlyNet !== null && monthlyNet !== undefined ? new Prisma.Decimal(monthlyNet) : null,

          basicSalary: new Prisma.Decimal(basicSalary),
          hra: new Prisma.Decimal(hra),
          dearnessAllowance: new Prisma.Decimal(dearnessAllowance),
          conveyanceAllowance: new Prisma.Decimal(conveyanceAllowance),
          specialAllowance: new Prisma.Decimal(specialAllowance),
          medicalAllowance: new Prisma.Decimal(medicalAllowance),
          otherAllowances: new Prisma.Decimal(otherAllowances),

          pfEmployee: new Prisma.Decimal(pfEmployee),
          esiEmployee: new Prisma.Decimal(esiEmployee),
          professionalTax: new Prisma.Decimal(professionalTax),
          tdsMonthly: new Prisma.Decimal(tdsMonthly),

          pfEmployer: new Prisma.Decimal(pfEmployer),
          esiEmployer: new Prisma.Decimal(esiEmployer),
          gratuityMonthly: new Prisma.Decimal(gratuityMonthly),
          insuranceMonthly: new Prisma.Decimal(insuranceMonthly),

          customComponents: customComponents ? (customComponents as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });

      return newSalary;
    });
  }

  /**
   * Update an existing salary record
   */
  async update(id: string, organizationId: string, data: UpdateSalaryStructureInput) {
    const {
      incrementLetterUrl,
      customComponents,
      percentageHike,
      annualCtc,
      monthlyGross,
      monthlyNet,
      basicSalary,
      hra,
      dearnessAllowance,
      conveyanceAllowance,
      specialAllowance,
      medicalAllowance,
      otherAllowances,
      pfEmployee,
      esiEmployee,
      professionalTax,
      tdsMonthly,
      pfEmployer,
      esiEmployer,
      gratuityMonthly,
      insuranceMonthly,
      effectiveFrom,
      revisionDate,
      ...directFields
    } = data;

    return prisma.employeeSalary.update({
      where: { id },
      data: {
        ...directFields,
        ...(effectiveFrom ? { effectiveFrom: new Date(effectiveFrom) } : {}),
        ...(revisionDate ? { revisionDate: new Date(revisionDate) } : {}),
        ...(percentageHike !== undefined ? { percentageHike: percentageHike ? new Prisma.Decimal(percentageHike) : null } : {}),
        ...(annualCtc !== undefined ? { annualCtc: new Prisma.Decimal(annualCtc) } : {}),
        ...(monthlyGross !== undefined ? { monthlyGross: new Prisma.Decimal(monthlyGross) } : {}),
        ...(monthlyNet !== undefined ? { monthlyNet: monthlyNet ? new Prisma.Decimal(monthlyNet) : null } : {}),
        ...(basicSalary !== undefined ? { basicSalary: new Prisma.Decimal(basicSalary) } : {}),
        ...(hra !== undefined ? { hra: new Prisma.Decimal(hra) } : {}),
        ...(dearnessAllowance !== undefined ? { dearnessAllowance: new Prisma.Decimal(dearnessAllowance) } : {}),
        ...(conveyanceAllowance !== undefined ? { conveyanceAllowance: new Prisma.Decimal(conveyanceAllowance) } : {}),
        ...(specialAllowance !== undefined ? { specialAllowance: new Prisma.Decimal(specialAllowance) } : {}),
        ...(medicalAllowance !== undefined ? { medicalAllowance: new Prisma.Decimal(medicalAllowance) } : {}),
        ...(otherAllowances !== undefined ? { otherAllowances: new Prisma.Decimal(otherAllowances) } : {}),
        ...(pfEmployee !== undefined ? { pfEmployee: new Prisma.Decimal(pfEmployee) } : {}),
        ...(esiEmployee !== undefined ? { esiEmployee: new Prisma.Decimal(esiEmployee) } : {}),
        ...(professionalTax !== undefined ? { professionalTax: new Prisma.Decimal(professionalTax) } : {}),
        ...(tdsMonthly !== undefined ? { tdsMonthly: new Prisma.Decimal(tdsMonthly) } : {}),
        ...(pfEmployer !== undefined ? { pfEmployer: new Prisma.Decimal(pfEmployer) } : {}),
        ...(esiEmployer !== undefined ? { esiEmployer: new Prisma.Decimal(esiEmployer) } : {}),
        ...(gratuityMonthly !== undefined ? { gratuityMonthly: new Prisma.Decimal(gratuityMonthly) } : {}),
        ...(insuranceMonthly !== undefined ? { insuranceMonthly: new Prisma.Decimal(insuranceMonthly) } : {}),
        ...(incrementLetterUrl !== undefined ? { incrementLetterUrl: incrementLetterUrl ? (incrementLetterUrl as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
        ...(customComponents !== undefined ? { customComponents: customComponents ? (customComponents as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
      },
    });
  }

  /**
   * Soft delete salary record
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.employeeSalary.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const salaryRepo = new SalaryRepository();
