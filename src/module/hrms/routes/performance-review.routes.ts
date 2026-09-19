import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as performanceReviewController from "../controllers/performance-review.controller.js";

const router = Router();

// Protect all performance review endpoints
router.use(authenticate);

// Personal reviews
router.get("/my-reviews", performanceReviewController.getMyReviews);

// Admin / Reviewer endpoints
router.post("/", performanceReviewController.createReview);
router.get("/", performanceReviewController.getAllReviews);
router.get("/:id", performanceReviewController.getReviewById);
router.patch("/:id", performanceReviewController.updateReview);
router.delete("/:id", performanceReviewController.deleteReview);

export default router;
