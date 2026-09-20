import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as travelController from "../controllers/travel.controller.js";

const router = Router();

// Protect all travel endpoints
router.use(authenticate);

/**
 * @route   GET /api/v1/hrms/travels/my-travels
 * @desc    Fetch authenticated employee's personal assigned business travel plans
 */
router.get("/my-travels", travelController.getMyTravels);

/**
 * @route   POST /api/v1/hrms/travels
 * @desc    Create a new business travel itinerary with flight/hotel document attachments
 */
router.post(
  "/",
  upload.array("documents", 10, { category: "document" }),
  travelController.createTravel
);

/**
 * @route   GET /api/v1/hrms/travels
 * @desc    Fetch paginated list of organization business travels with status and date filters
 */
router.get("/", travelController.getTravels);

/**
 * @route   GET /api/v1/hrms/travels/:id
 * @desc    Get complete travel itinerary details, expense claims, and tickets
 */
router.get("/:id", travelController.getTravelById);

/**
 * @route   PATCH /api/v1/hrms/travels/:id
 * @desc    Update travel itinerary details and budget estimates
 */
router.patch("/:id", travelController.updateTravel);

/**
 * @route   DELETE /api/v1/hrms/travels/:id
 * @desc    Cancel / delete travel record
 */
router.delete("/:id", travelController.deleteTravel);

/**
 * @route   POST /api/v1/hrms/travels/:id/assign-employees
 * @desc    Assign team members / traveling staff to trip itinerary
 */
router.post("/:id/assign-employees", travelController.assignEmployees);

/**
 * @route   PATCH /api/v1/hrms/travels/:id/expenses
 * @desc    Submit or update actual travel expense claims with receipt proof attachments
 */
router.patch(
  "/:id/expenses",
  upload.array("documents", 10, { category: "document" }),
  travelController.updateExpenses
);

/**
 * @route   PATCH /api/v1/hrms/travels/:id/status
 * @desc    Approve, reject, or mark business travel as completed
 */
router.patch("/:id/status", travelController.updateStatus);

export default router;
