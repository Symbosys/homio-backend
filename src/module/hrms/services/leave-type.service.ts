import { leaveTypeRepo } from "../repos/leave-type.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateLeaveTypeInput,
  UpdateLeaveTypeInput,
  GetLeaveTypesQueryInput,
} from "../validators/leave-type.validator.js";

export class LeaveTypeService {
  /**
   * Create a new leave type
   */
  async createLeaveType(organizationId: string, input: CreateLeaveTypeInput, userId?: string) {
    const existingCode = await leaveTypeRepo.findByCode(input.code, organizationId);
    if (existingCode) {
      throw new ErrorResponse(
        `Leave type with code '${input.code}' already exists in your organization`,
        statusCode.Conflict
      );
    }

    const existingName = await leaveTypeRepo.findByName(input.name, organizationId);
    if (existingName) {
      throw new ErrorResponse(
        `Leave type with name '${input.name}' already exists in your organization`,
        statusCode.Conflict
      );
    }

    return leaveTypeRepo.create(organizationId, input, userId);
  }

  /**
   * Get all leave types
   */
  async getLeaveTypes(organizationId: string, filters: GetLeaveTypesQueryInput) {
    return leaveTypeRepo.findAll(organizationId, filters);
  }

  /**
   * Get single leave type by ID
   */
  async getLeaveTypeById(id: string, organizationId: string) {
    const leaveType = await leaveTypeRepo.findById(id, organizationId);
    if (!leaveType) {
      throw new ErrorResponse("Leave type not found", statusCode.Not_Found);
    }
    return leaveType;
  }

  /**
   * Update leave type
   */
  async updateLeaveType(
    id: string,
    organizationId: string,
    input: UpdateLeaveTypeInput,
    userId?: string
  ) {
    await this.getLeaveTypeById(id, organizationId);

    if (input.code) {
      const duplicateCode = await leaveTypeRepo.findByCode(input.code, organizationId);
      if (duplicateCode && duplicateCode.id !== id) {
        throw new ErrorResponse(
          `Leave type with code '${input.code}' already exists in your organization`,
          statusCode.Conflict
        );
      }
    }

    if (input.name) {
      const duplicateName = await leaveTypeRepo.findByName(input.name, organizationId);
      if (duplicateName && duplicateName.id !== id) {
        throw new ErrorResponse(
          `Leave type with name '${input.name}' already exists in your organization`,
          statusCode.Conflict
        );
      }
    }

    return leaveTypeRepo.update(id, organizationId, input, userId);
  }

  /**
   * Soft delete leave type
   */
  async deleteLeaveType(id: string, organizationId: string, userId?: string) {
    await this.getLeaveTypeById(id, organizationId);
    return leaveTypeRepo.softDelete(id, organizationId, userId);
  }
}

export const leaveTypeService = new LeaveTypeService();
