import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createHomeDecor,
  getHomeDecor,
  getHomeDecorById,
  updateHomeDecor,
  deleteHomeDecor,
} from "../controllers/home-decor.controller.js";

const router = Router();

// Public Catalog Discovery (supports ?organizationId=... and filters)
router.get("/", getHomeDecor);
router.get("/:id", getHomeDecorById);

// Protected Org Admin Actions
router.post("/", authenticate, authorize("ADMIN"), upload.single("coverImage"), createHomeDecor);
router.put("/:id", authenticate, authorize("ADMIN"), upload.single("coverImage"), updateHomeDecor);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteHomeDecor);

export default router;
