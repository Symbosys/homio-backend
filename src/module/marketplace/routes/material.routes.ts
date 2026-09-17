import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createMaterial,
  getMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
} from "../controllers/material.controller.js";

const router = Router();

// Public Procurement Catalog Discovery (supports ?organizationId=... and filters)
router.get("/", getMaterials);
router.get("/:id", getMaterialById);

// Protected Org Admin Material Management
router.post("/", authenticate, authorize("ADMIN"), upload.single("coverImage"), createMaterial);
router.put("/:id", authenticate, authorize("ADMIN"), upload.single("coverImage"), updateMaterial);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteMaterial);

export default router;
