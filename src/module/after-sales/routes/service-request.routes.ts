import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createServiceRequest,
  getServiceRequests,
  getServiceRequestById,
  updateServiceRequest,
  assignServiceRequest,
  updateServiceRequestStatus,
  resolveServiceRequest,
  closeServiceRequest,
  reopenServiceRequest,
  deleteServiceRequest,
} from "../controllers/service-request.controller.js";

const serviceRequestRoutes = Router({ mergeParams: true });

serviceRequestRoutes.use(authenticate);

const requestUpload = upload.fields(
  [{ name: "attachments", maxCount: 5 }],
  { category: "all" }
);

/**
 * @route   POST /api/v1/after-sales/requests
 * @desc    Create a new service request work order with attachments
 */
serviceRequestRoutes.post(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  requestUpload,
  createServiceRequest
);

/**
 * @route   GET /api/v1/after-sales/requests
 * @desc    List service requests with filters & pagination
 */
serviceRequestRoutes.get(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getServiceRequests
);

/**
 * @route   GET /api/v1/after-sales/requests/:id
 * @desc    Get detailed service request docket with visits & claims
 */
serviceRequestRoutes.get(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getServiceRequestById
);

/**
 * @route   PATCH /api/v1/after-sales/requests/:id
 * @desc    Partial update service request details & attachments
 */
serviceRequestRoutes.patch(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  requestUpload,
  updateServiceRequest
);

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/assign
 * @desc    Assign or re-assign technician to service request
 */
serviceRequestRoutes.patch(
  "/:id/assign",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  assignServiceRequest
);

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/status
 * @desc    Transition service request lifecycle status
 */
serviceRequestRoutes.patch(
  "/:id/status",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  updateServiceRequestStatus
);

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/resolve
 * @desc    Mark service request resolved with resolution notes & final cost
 */
serviceRequestRoutes.patch(
  "/:id/resolve",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  resolveServiceRequest
);

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/close
 * @desc    Formally close a resolved service request
 */
serviceRequestRoutes.patch(
  "/:id/close",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  closeServiceRequest
);

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/reopen
 * @desc    Reopen a resolved or closed service request
 */
serviceRequestRoutes.patch(
  "/:id/reopen",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  reopenServiceRequest
);

/**
 * @route   DELETE /api/v1/after-sales/requests/:id
 * @desc    Soft delete service request
 */
serviceRequestRoutes.delete(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  deleteServiceRequest
);

export default serviceRequestRoutes;
