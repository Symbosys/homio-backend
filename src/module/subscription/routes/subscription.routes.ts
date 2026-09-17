import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import * as subscriptionController from "../controllers/subscription.controller.js";

const router = Router();

// Protect all subscription plan management routes with authenticate + authorize("PLATFORM_ADMIN")
router.use(authenticate, authorize("PLATFORM_ADMIN"));

// Create a new subscription plan with features
router.post("/", subscriptionController.createPlan);

// List all subscription plans (no pagination)
router.get("/", subscriptionController.getAllPlans);

// Get single subscription plan by ID
router.get("/:id", subscriptionController.getPlanById);

// Update subscription plan & features
router.patch("/:id", subscriptionController.updatePlan);

// Toggle plan active status
router.patch("/:id/toggle-status", subscriptionController.togglePlanStatus);

// Delete subscription plan
router.delete("/:id", subscriptionController.deletePlan);

export default router;
