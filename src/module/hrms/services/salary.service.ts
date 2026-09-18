import { salaryRepo } from "../repos/salary.repo.js";
import { employeeRepo } from "../repos/employee.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType } from "../../../types/types.js";
import type { CreateSalaryStructureInput, UpdateSalaryStructureInput } from "../validators/salary.validator.js";

export class SalaryService {
  /**
   * Assign or revise employee salary structure with automatic temporal period closing (Effective Dating)
   */
  async createSalaryRevision(
    organizationId: string,
    employeeId: string,
    data: CreateSalaryStructureInput,
    documentFile?: Express.Multer.File,
    createdById?: string
  ) {
    // 1. Verify employee exists and belongs to the organization
    const employee = await employeeRepo.findById(employeeId, organizationId);
    if (!employee) {
      throw new ErrorResponse("Employee not found in this organization", statusCode.Not_Found);
    }

    // 2. Fetch existing active salary
    const currentSalary = await salaryRepo.getCurrentSalary(employeeId, organizationId);

    // 3. Compute percentage hike if not explicitly provided and a prior salary exists
    let percentageHike = data.percentageHike;
    if (percentageHike === undefined || percentageHike === null) {
      if (currentSalary && Number(currentSalary.annualCtc) > 0) {
        const oldCtc = Number(currentSalary.annualCtc);
        const newCtc = Number(data.annualCtc);
        const hike = ((newCtc - oldCtc) / oldCtc) * 100;
        percentageHike = Math.round(hike * 100) / 100;
      }
    }

    // 4. Auto-compute monthlyNet if omitted
    let monthlyNet = data.monthlyNet;
    if (monthlyNet === undefined || monthlyNet === null) {
      const totalDeductions =
        Number(data.pfEmployee || 0) +
        Number(data.esiEmployee || 0) +
        Number(data.professionalTax || 0) +
        Number(data.tdsMonthly || 0);
      monthlyNet = Math.max(0, Number(data.monthlyGross) - totalDeductions);
    }

    // 5. Handle increment letter document upload if provided
    let incrementLetterUrlData: ImageType | null = null;
    if (documentFile && documentFile.buffer && documentFile.buffer.length > 0) {
      const uploadResult = await storageService.upload(
        {
          buffer: documentFile.buffer,
          originalname: documentFile.originalname,
          mimetype: documentFile.mimetype,
          size: documentFile.size,
        },
        {
          folder: `homio/organizations/${organizationId}/hrms/employees/salary-letters`,
          resourceType: "auto",
        }
      );
      incrementLetterUrlData = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    // 6. Execute atomic SCD Type 2 salary revision transaction
    return salaryRepo.createSalaryRevisionWithTransaction(
      organizationId,
      employeeId,
      {
        ...data,
        percentageHike,
        monthlyNet,
        ...(incrementLetterUrlData ? { incrementLetterUrl: incrementLetterUrlData } : {}),
      },
      createdById
    );
  }

  /**
   * Get full historical salary timeline for an employee
   */
  async getSalaryHistory(employeeId: string, organizationId: string) {
    const employee = await employeeRepo.findById(employeeId, organizationId);
    if (!employee) {
      throw new ErrorResponse("Employee not found in this organization", statusCode.Not_Found);
    }
    return salaryRepo.getSalaryHistory(employeeId, organizationId);
  }

  /**
   * Get currently active salary structure for an employee
   */
  async getCurrentSalary(employeeId: string, organizationId: string) {
    const employee = await employeeRepo.findById(employeeId, organizationId);
    if (!employee) {
      throw new ErrorResponse("Employee not found in this organization", statusCode.Not_Found);
    }
    const currentSalary = await salaryRepo.getCurrentSalary(employeeId, organizationId);
    if (!currentSalary) {
      throw new ErrorResponse("No active salary structure found for this employee", statusCode.Not_Found);
    }
    return currentSalary;
  }

  /**
   * Get specific salary record by ID
   */
  async getSalaryById(id: string, organizationId: string) {
    const salary = await salaryRepo.findById(id, organizationId);
    if (!salary) {
      throw new ErrorResponse("Salary record not found", statusCode.Not_Found);
    }
    return salary;
  }

  /**
   * Update salary record
   */
  async updateSalary(
    id: string,
    organizationId: string,
    data: UpdateSalaryStructureInput,
    documentFile?: Express.Multer.File
  ) {
    const existing = await salaryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Salary record not found", statusCode.Not_Found);
    }

    let incrementLetterUrlData: ImageType | undefined;
    if (documentFile && documentFile.buffer && documentFile.buffer.length > 0) {
      const uploadResult = await storageService.upload(
        {
          buffer: documentFile.buffer,
          originalname: documentFile.originalname,
          mimetype: documentFile.mimetype,
          size: documentFile.size,
        },
        {
          folder: `homio/organizations/${organizationId}/hrms/employees/salary-letters`,
          resourceType: "auto",
        }
      );
      incrementLetterUrlData = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    return salaryRepo.update(id, organizationId, {
      ...data,
      ...(incrementLetterUrlData ? { incrementLetterUrl: incrementLetterUrlData } : {}),
    });
  }

  /**
   * Soft delete salary record
   */
  async deleteSalary(id: string, organizationId: string) {
    const existing = await salaryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Salary record not found", statusCode.Not_Found);
    }
    return salaryRepo.softDelete(id, organizationId);
  }
}

export const salaryService = new SalaryService();
