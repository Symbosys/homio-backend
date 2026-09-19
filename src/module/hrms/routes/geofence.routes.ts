import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as geofenceController from "../controllers/geofence.controller.js";

const router = Router();

// Protect all geofence endpoints
router.use(authenticate);

// Geofence CRUD
router.post("/", geofenceController.createGeofence);
router.get("/", geofenceController.getGeofences);
router.get("/employee/:employeeId", geofenceController.getEmployeeGeofences);
router.get("/:id", geofenceController.getGeofenceById);
router.patch("/:id", geofenceController.updateGeofence);
router.delete("/:id", geofenceController.deleteGeofence);

// Bulk employee assignment
router.post("/:id/assign-employees", geofenceController.assignEmployees);

export default router;
