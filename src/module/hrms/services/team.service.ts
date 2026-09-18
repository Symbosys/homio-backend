import { teamRepo } from "../repos/team.repo.js";
import { departmentRepo } from "../repos/department.repo.js";
import { employeeRepo } from "../repos/employee.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateTeamInput,
  UpdateTeamInput,
  GetTeamsQueryInput,
} from "../validators/team.validator.js";

export class TeamService {
  /**
   * Create a new team under a department
   */
  async createTeam(
    organizationId: string,
    departmentId: string,
    data: CreateTeamInput,
    createdById?: string
  ) {
    // 1. Verify parent department
    const department = await departmentRepo.findById(departmentId, organizationId);
    if (!department) {
      throw new ErrorResponse("Parent department not found in this organization", statusCode.Not_Found);
    }

    const code = data.code.toUpperCase().trim();
    const name = data.name.trim();

    // 2. Check unique code in department
    const existingCode = await teamRepo.findByCode(code, departmentId);
    if (existingCode) {
      throw new ErrorResponse(`Team with code "${code}" already exists in this department`, statusCode.Conflict);
    }

    // 3. Check unique name in department
    const existingName = await teamRepo.findByName(name, departmentId);
    if (existingName) {
      throw new ErrorResponse(`Team with name "${name}" already exists in this department`, statusCode.Conflict);
    }

    // 4. Validate Team Lead if provided
    if (data.teamLeadId) {
      const lead = await employeeRepo.findById(data.teamLeadId, organizationId);
      if (!lead) {
        throw new ErrorResponse("Team lead employee not found in this organization", statusCode.Not_Found);
      }
    }

    return teamRepo.create(
      organizationId,
      departmentId,
      {
        ...data,
        name,
        code,
      },
      createdById
    );
  }

  /**
   * Get team by ID
   */
  async getTeamById(id: string, organizationId: string) {
    const team = await teamRepo.findById(id, organizationId);
    if (!team) {
      throw new ErrorResponse("Team not found", statusCode.Not_Found);
    }
    return team;
  }

  /**
   * List all teams across the organization or filtered by department
   */
  async getTeams(organizationId: string, query: GetTeamsQueryInput) {
    return teamRepo.findAll(organizationId, query);
  }

  /**
   * List all teams under a specific department
   */
  async getDepartmentTeams(departmentId: string, organizationId: string) {
    const department = await departmentRepo.findById(departmentId, organizationId);
    if (!department) {
      throw new ErrorResponse("Department not found", statusCode.Not_Found);
    }

    return teamRepo.findByDepartment(departmentId, organizationId);
  }

  /**
   * Update team
   */
  async updateTeam(id: string, organizationId: string, data: UpdateTeamInput, updatedById?: string) {
    const existing = await teamRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Team not found", statusCode.Not_Found);
    }

    const targetDeptId = data.departmentId || existing.department.id;

    // Check code collision
    if (data.code && data.code.toUpperCase() !== existing.code) {
      const code = data.code.toUpperCase().trim();
      const codeDuplicate = await teamRepo.findByCode(code, targetDeptId);
      if (codeDuplicate && codeDuplicate.id !== id) {
        throw new ErrorResponse(`Team code "${code}" is already taken in this department`, statusCode.Conflict);
      }
    }

    // Check name collision
    if (data.name && data.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const name = data.name.trim();
      const nameDuplicate = await teamRepo.findByName(name, targetDeptId);
      if (nameDuplicate && nameDuplicate.id !== id) {
        throw new ErrorResponse(`Team name "${name}" is already taken in this department`, statusCode.Conflict);
      }
    }

    // Validate Team Lead if provided
    if (data.teamLeadId) {
      const lead = await employeeRepo.findById(data.teamLeadId, organizationId);
      if (!lead) {
        throw new ErrorResponse("Team lead employee not found in this organization", statusCode.Not_Found);
      }
    }

    return teamRepo.update(
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
   * Soft delete team with integrity guard
   */
  async deleteTeam(id: string, organizationId: string, updatedById?: string) {
    const existing = await teamRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Team not found", statusCode.Not_Found);
    }

    if (existing._count.employeeAssignments > 0) {
      throw new ErrorResponse(
        `Cannot delete team. There are ${existing._count.employeeAssignments} active employee(s) assigned. Reassign them first.`,
        statusCode.Bad_Request
      );
    }

    return teamRepo.softDelete(id, organizationId, updatedById);
  }

  /**
   * Get members assigned to a team
   */
  async getTeamMembers(teamId: string, organizationId: string) {
    const team = await teamRepo.findById(teamId, organizationId);
    if (!team) {
      throw new ErrorResponse("Team not found", statusCode.Not_Found);
    }

    return teamRepo.getTeamMembers(teamId, organizationId);
  }
}

export const teamService = new TeamService();
