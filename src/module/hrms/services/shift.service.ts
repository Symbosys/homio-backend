import { shiftRepo } from "../repos/shift.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateShiftInput,
  UpdateShiftInput,
  GetShiftsQueryInput,
  AssignEmployeesToShiftInput,
} from "../validators/shift.validator.js";

export class ShiftService {
  /**
   * Create a new shift
   */
  async createShift(organizationId: string, input: CreateShiftInput, userId?: string) {
    if (input.code) {
      const existing = await shiftRepo.findByCode(input.code, organizationId);
      if (existing) {
        throw new ErrorResponse(
          `Shift with code '${input.code}' already exists in your organization`,
          statusCode.Conflict
        );
      }
    }

    return shiftRepo.create(organizationId, input, userId);
  }

  /**
   * Get all shifts
   */
  async getShifts(organizationId: string, filters: GetShiftsQueryInput) {
    return shiftRepo.findAll(organizationId, filters);
  }

  /**
   * Get single shift by ID
   */
  async getShiftById(id: string, organizationId: string) {
    const shift = await shiftRepo.findById(id, organizationId);
    if (!shift) {
      throw new ErrorResponse("Shift not found", statusCode.Not_Found);
    }
    return shift;
  }

  /**
   * Update shift
   */
  async updateShift(id: string, organizationId: string, input: UpdateShiftInput, userId?: string) {
    await this.getShiftById(id, organizationId);

    if (input.code) {
      const existing = await shiftRepo.findByCode(input.code, organizationId);
      if (existing && existing.id !== id) {
        throw new ErrorResponse(
          `Shift with code '${input.code}' already exists in your organization`,
          statusCode.Conflict
        );
      }
    }

    return shiftRepo.update(id, organizationId, input, userId);
  }

  /**
   * Soft delete shift
   */
  async deleteShift(id: string, organizationId: string, userId?: string) {
    await this.getShiftById(id, organizationId);
    return shiftRepo.softDelete(id, organizationId, userId);
  }

  /**
   * Bulk assign employees to shift
   */
  async assignEmployees(id: string, organizationId: string, input: AssignEmployeesToShiftInput) {
    await this.getShiftById(id, organizationId);
    return shiftRepo.assignEmployees(id, organizationId, input.employeeIds);
  }

  /**
   * Unassign employee from shift
   */
  async unassignEmployee(employeeId: string, organizationId: string) {
    return shiftRepo.unassignEmployee(employeeId, organizationId);
  }
}

export const shiftService = new ShiftService();
