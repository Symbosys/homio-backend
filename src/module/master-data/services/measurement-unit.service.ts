import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { measurementUnitRepo } from "../repos/measurement-unit.repo.js";
import type {
  CreateMeasurementUnitInput,
  UpdateMeasurementUnitInput,
  GetMeasurementUnitsQuery,
} from "../validators/measurement-unit.validator.js";

export class MeasurementUnitService {
  /**
   * Create a new MeasurementUnit with uniqueness check
   */
  async createUnit(organizationId: string, data: CreateMeasurementUnitInput) {
    const [existingName, existingSymbol] = await Promise.all([
      measurementUnitRepo.findByName(data.name, organizationId),
      measurementUnitRepo.findBySymbol(data.symbol, organizationId),
    ]);

    if (existingName) {
      throw new ErrorResponse("A measurement unit with this name already exists", statusCode.Conflict);
    }
    if (existingSymbol) {
      throw new ErrorResponse("A measurement unit with this symbol already exists", statusCode.Conflict);
    }

    return measurementUnitRepo.create(organizationId, data);
  }

  /**
   * Get paginated measurement units
   */
  async getUnits(organizationId: string, query: GetMeasurementUnitsQuery) {
    return measurementUnitRepo.findAll(organizationId, query);
  }

  /**
   * Get unit by ID
   */
  async getUnitById(id: string, organizationId: string) {
    const unit = await measurementUnitRepo.findById(id, organizationId);
    if (!unit) {
      throw new ErrorResponse("Measurement unit not found", statusCode.Not_Found);
    }
    return unit;
  }

  /**
   * Update unit
   */
  async updateUnit(id: string, organizationId: string, data: UpdateMeasurementUnitInput) {
    const existing = await measurementUnitRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Measurement unit not found", statusCode.Not_Found);
    }

    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await measurementUnitRepo.findByName(data.name, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A measurement unit with this name already exists", statusCode.Conflict);
      }
    }

    if (data.symbol && data.symbol.toLowerCase() !== existing.symbol.toLowerCase()) {
      const duplicate = await measurementUnitRepo.findBySymbol(data.symbol, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A measurement unit with this symbol already exists", statusCode.Conflict);
      }
    }

    return measurementUnitRepo.update(id, organizationId, data);
  }

  /**
   * Soft delete unit (with check for system locked unit)
   */
  async deleteUnit(id: string, organizationId: string) {
    const existing = await measurementUnitRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Measurement unit not found", statusCode.Not_Found);
    }

    if (existing.isSystem) {
      throw new ErrorResponse("Core system measurement units cannot be deleted. Deactivate instead.", statusCode.Forbidden);
    }

    return measurementUnitRepo.softDelete(id, organizationId);
  }

  /**
   * Toggle active state
   */
  async toggleActive(id: string, organizationId: string) {
    const updated = await measurementUnitRepo.toggleActive(id, organizationId);
    if (!updated) {
      throw new ErrorResponse("Measurement unit not found", statusCode.Not_Found);
    }
    return updated;
  }
}

export const measurementUnitService = new MeasurementUnitService();
