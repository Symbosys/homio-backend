import { geofenceRepo } from "../repos/geofence.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateGeofenceInput,
  UpdateGeofenceInput,
  GetGeofencesQueryInput,
  AssignEmployeesToGeofenceInput,
} from "../validators/geofence.validator.js";

export class GeofenceService {
  /**
   * Create a new geofence
   */
  async createGeofence(organizationId: string, input: CreateGeofenceInput, userId?: string) {
    if (input.code) {
      const existing = await geofenceRepo.findByCode(input.code, organizationId);
      if (existing) {
        throw new ErrorResponse(
          `Geofence with code '${input.code}' already exists in your organization`,
          statusCode.Conflict
        );
      }
    }

    return geofenceRepo.create(organizationId, input, userId);
  }

  /**
   * Get all geofences
   */
  async getGeofences(organizationId: string, filters: GetGeofencesQueryInput) {
    return geofenceRepo.findAll(organizationId, filters);
  }

  /**
   * Get single geofence by ID
   */
  async getGeofenceById(id: string, organizationId: string) {
    const geofence = await geofenceRepo.findById(id, organizationId);
    if (!geofence) {
      throw new ErrorResponse("Geofence not found", statusCode.Not_Found);
    }
    return geofence;
  }

  /**
   * Update geofence
   */
  async updateGeofence(id: string, organizationId: string, input: UpdateGeofenceInput, userId?: string) {
    await this.getGeofenceById(id, organizationId);

    if (input.code) {
      const existing = await geofenceRepo.findByCode(input.code, organizationId);
      if (existing && existing.id !== id) {
        throw new ErrorResponse(
          `Geofence with code '${input.code}' already exists in your organization`,
          statusCode.Conflict
        );
      }
    }

    return geofenceRepo.update(id, organizationId, input, userId);
  }

  /**
   * Soft delete geofence
   */
  async deleteGeofence(id: string, organizationId: string, userId?: string) {
    await this.getGeofenceById(id, organizationId);
    return geofenceRepo.softDelete(id, organizationId, userId);
  }

  /**
   * Assign or unassign employees to/from geofence
   */
  async assignEmployees(id: string, organizationId: string, input: AssignEmployeesToGeofenceInput) {
    await this.getGeofenceById(id, organizationId);
    return geofenceRepo.assignEmployees(id, input.employeeIds, input.action);
  }

  /**
   * Get geofences assigned to employee
   */
  async getGeofencesForEmployee(employeeId: string, organizationId: string) {
    const data = await geofenceRepo.getGeofencesForEmployee(employeeId, organizationId);
    if (!data) {
      throw new ErrorResponse("Employee not found", statusCode.Not_Found);
    }
    return data;
  }
}

export const geofenceService = new GeofenceService();
