import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createLabourRating,
  getAllLabourRatings,
  getLabourRatingById,
  updateLabourRating,
  deleteLabourRating,
} from "../controllers/labour-rating.controller.js";

const router = Router();

// Protect all rating endpoints with authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/labour/ratings
 * @desc    Submit labour rating
 * 
 * @route   GET /api/v1/labour/ratings
 * @desc    Get paginated ratings
 */
router
  .route("/ratings")
  .post(createLabourRating)
  .get(getAllLabourRatings);

/**
 * @route   GET /api/v1/labour/ratings/:id
 * @desc    Get rating by ID
 * 
 * @route   PUT /api/v1/labour/ratings/:id
 * @desc    Update rating
 * 
 * @route   DELETE /api/v1/labour/ratings/:id
 * @desc    Delete rating
 */
router
  .route("/ratings/:id")
  .get(getLabourRatingById)
  .put(updateLabourRating)
  .delete(deleteLabourRating);

export default router;
