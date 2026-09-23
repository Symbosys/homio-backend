import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createMeasurementUnit,
  getMeasurementUnits,
  getMeasurementUnitById,
  updateMeasurementUnit,
  deleteMeasurementUnit,
  toggleActiveMeasurementUnit,
} from "../controllers/measurement-unit.controller.js";

const measurementUnitRoutes = Router();

// Protect all measurement unit routes
measurementUnitRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/master-data/measurement-units
 * @desc    Create a new measurement unit for the organization
 */
measurementUnitRoutes.post("/", createMeasurementUnit);

/**
 * @route   GET /api/v1/master-data/measurement-units
 * @desc    Fetch paginated list of measurement units for the organization
 */
measurementUnitRoutes.get("/", getMeasurementUnits);

/**
 * @route   GET /api/v1/master-data/measurement-units/:id
 * @desc    Fetch details of a single measurement unit
 */
measurementUnitRoutes.get("/:id", getMeasurementUnitById);

/**
 * @route   PATCH /api/v1/master-data/measurement-units/:id
 * @desc    Update measurement unit details
 */
measurementUnitRoutes.patch("/:id", updateMeasurementUnit);

/**
 * @route   PATCH /api/v1/master-data/measurement-units/:id/toggle-active
 * @desc    Toggle active state of a measurement unit
 */
measurementUnitRoutes.patch("/:id/toggle-active", toggleActiveMeasurementUnit);

/**
 * @route   DELETE /api/v1/master-data/measurement-units/:id
 * @desc    Soft delete a measurement unit
 */
measurementUnitRoutes.delete("/:id", deleteMeasurementUnit);

export default measurementUnitRoutes;
