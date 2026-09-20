import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as performanceReviewController from "../controllers/performance-review.controller.js";

const router = Router();

// Protect all performance review endpoints
router.use(authenticate);

/**
 * @route   GET /api/v1/hrms/performance-reviews/my-reviews
 * @desc    Fetch authenticated employee's personal appraisal and performance rating history
 */
router.get("/my-reviews", performanceReviewController.getMyReviews);

/**
 * @route   POST /api/v1/hrms/performance-reviews
 * @desc    Conduct and submit new employee performance evaluation (KPI ratings, strengths, goals)
 */
router.post("/", performanceReviewController.createReview);

/**
 * @route   GET /api/v1/hrms/performance-reviews
 * @desc    Fetch paginated list of all performance reviews with department and cycle filters
 */
router.get("/", performanceReviewController.getAllReviews);

/**
 * @route   GET /api/v1/hrms/performance-reviews/:id
 * @desc    Get complete performance review details and reviewer feedback by ID
 */
router.get("/:id", performanceReviewController.getReviewById);

/**
 * @route   PATCH /api/v1/hrms/performance-reviews/:id
 * @desc    Update performance review scores or reviewer feedback notes
 */
router.patch("/:id", performanceReviewController.updateReview);

/**
 * @route   DELETE /api/v1/hrms/performance-reviews/:id
 * @desc    Soft-delete / remove performance evaluation record
 */
router.delete("/:id", performanceReviewController.deleteReview);

export default router;
