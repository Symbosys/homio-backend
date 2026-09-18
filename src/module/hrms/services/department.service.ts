import { departmentRepo } from "../repos/department.repo.js";
import { employeeRepo } from "../repos/employee.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  GetDepartmentsQueryInput,
} from "../validators/department.validator.js";

export class DepartmentService {
  /**
   * Create a new department
   */
  async createDepartment(organizationId: string, data: CreateDepartmentInput, createdById?: string) {
    const code = data.code.toUpperCase().trim();
    const name = data.name.trim();

    // 1. Check unique code
    const existingByCode = await departmentRepo.findByCode(code, organizationId);
    if (existingByCode) {
      throw new ErrorResponse(`Department with code "${code}" already exists in this organization`, statusCode.Conflict);
    }

    // 2. Check unique name
    const existingByName = await departmentRepo.findByName(name, organizationId);
    if (existingByName) {
      throw new ErrorResponse(`Department with name "${name}" already exists in this organization`, statusCode.Conflict);
    }

    // 3. Validate Head of Department if provided
    if (data.headOfDepartmentId) {
      const head = await employeeRepo.findById(data.headOfDepartmentId, organizationId);
      if (!head) {
        throw new ErrorResponse("Head of department employee not found in this organization", statusCode.Not_Found);
      }
    }

    return departmentRepo.create(
      organizationId,
      {
        ...data,
        name,
        code,
      },
      createdById
    );
  }

  /**
   * Get department by ID
   */
  async getDepartmentById(id: string, organizationId: string) {
    const department = await departmentRepo.findById(id, organizationId);
    if (!department) {
      throw new ErrorResponse("Department not found", statusCode.Not_Found);
    }
    return department;
  }

  /**
   * Get all departments with pagination and filters
   */
  async getDepartments(organizationId: string, query: GetDepartmentsQueryInput) {
    return departmentRepo.findAll(organizationId, query);
  }

  /**
   * Update department
   */
  async updateDepartment(
    id: string,
    organizationId: string,
    data: UpdateDepartmentInput,
    updatedById?: string
  ) {
    const existing = await departmentRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Department not found", statusCode.Not_Found);
    }

    // Check code collision
    if (data.code && data.code.toUpperCase() !== existing.code) {
      const code = data.code.toUpperCase().trim();
      const codeDuplicate = await departmentRepo.findByCode(code, organizationId);
      if (codeDuplicate && codeDuplicate.id !== id) {
        throw new ErrorResponse(`Department code "${code}" is already taken`, statusCode.Conflict);
      }
    }

    // Check name collision
    if (data.name && data.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const name = data.name.trim();
      const nameDuplicate = await departmentRepo.findByName(name, organizationId);
      if (nameDuplicate && nameDuplicate.id !== id) {
        throw new ErrorResponse(`Department name "${name}" is already taken`, statusCode.Conflict);
      }
    }

    // Validate Head of Department if modified
    if (data.headOfDepartmentId) {
      const head = await employeeRepo.findById(data.headOfDepartmentId, organizationId);
      if (!head) {
        throw new ErrorResponse("Head of department employee not found in this organization", statusCode.Not_Found);
      }
    }

    return departmentRepo.update(
      id,
      organizationId,
      {
        ...data,
        ...(data.code ? { code: data.code.toUpperCase().trim() } : {}),
        ...(data.name ? { name: data.name.trim() } : {}),
      },
      updatedById
    );
  }

  /**
   * Soft delete department with integrity safeguards
   */
  async deleteDepartment(id: string, organizationId: string, updatedById?: string) {
    const existing = await departmentRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Department not found", statusCode.Not_Found);
    }

    if (existing._count.employeeAssignments > 0) {
      throw new ErrorResponse(
        `Cannot delete department. There are ${existing._count.employeeAssignments} active employee(s) assigned. Reassign them first.`,
        statusCode.Bad_Request
      );
    }

    if (existing._count.teams > 0) {
      throw new ErrorResponse(
        `Cannot delete department. There are ${existing._count.teams} team(s) under this department. Delete or reassign teams first.`,
        statusCode.Bad_Request
      );
    }

    return departmentRepo.softDelete(id, organizationId, updatedById);
  }

  /**
   * Get members assigned to a department
   */
  async getDepartmentMembers(departmentId: string, organizationId: string) {
    const department = await departmentRepo.findById(departmentId, organizationId);
    if (!department) {
      throw new ErrorResponse("Department not found", statusCode.Not_Found);
    }

    return departmentRepo.getDepartmentMembers(departmentId, organizationId);
  }
}

export const departmentService = new DepartmentService();
