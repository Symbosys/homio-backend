import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createDigitalProduct,
  getDigitalProducts,
  getDigitalProductById,
  updateDigitalProduct,
  deleteDigitalProduct,
} from "../controllers/digital-product.controller.js";

const router = Router();

// Public Catalog Discovery (supports ?organizationId=... and filters)
router.get("/", getDigitalProducts);
router.get("/:id", getDigitalProductById);

// Protected Org Admin Actions
router.post("/", authenticate, authorize("ADMIN"), upload.single("coverImage"), createDigitalProduct);
router.put("/:id", authenticate, authorize("ADMIN"), upload.single("coverImage"), updateDigitalProduct);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteDigitalProduct);

export default router;
