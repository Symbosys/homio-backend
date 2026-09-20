import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as geofenceController from "../controllers/geofence.controller.js";

const router = Router();

// Protect all geofence endpoints
router.use(authenticate);

/**
 * @route   POST /api/v1/hrms/geofences
 * @desc    Create a new GPS geofence boundary location (office, site, showroom) with radius
 */
router.post("/", geofenceController.createGeofence);

/**
 * @route   GET /api/v1/hrms/geofences
 * @desc    Fetch paginated list of organization geofence locations
 */
router.get("/", geofenceController.getGeofences);

/**
 * @route   GET /api/v1/hrms/geofences/employee/:employeeId
 * @desc    Fetch all authorized geofence zones assigned to specific employee
 */
router.get("/employee/:employeeId", geofenceController.getEmployeeGeofences);

/**
 * @route   GET /api/v1/hrms/geofences/:id
 * @desc    Get detailed geofence boundary coordinates and assigned personnel
 */
router.get("/:id", geofenceController.getGeofenceById);

/**
 * @route   PATCH /api/v1/hrms/geofences/:id
 * @desc    Update geofence coordinates, radius, or active status
 */
router.patch("/:id", geofenceController.updateGeofence);

/**
 * @route   DELETE /api/v1/hrms/geofences/:id
 * @desc    Soft-delete geofence zone
 */
router.delete("/:id", geofenceController.deleteGeofence);

/**
 * @route   POST /api/v1/hrms/geofences/:id/assign-employees
 * @desc    Assign employees authorized to punch attendance within geofence
 */
router.post("/:id/assign-employees", geofenceController.assignEmployees);

export default router;
