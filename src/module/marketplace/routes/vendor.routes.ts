import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
} from "../controllers/vendor.controller.js";

const router = Router();

// Org Admin Vendor Management
router.post("/", authenticate, authorize("ADMIN"), createVendor);
router.get("/", authenticate, authorize("ADMIN"), getVendors);
router.get("/:id", authenticate, authorize("ADMIN"), getVendorById);
router.put("/:id", authenticate, authorize("ADMIN"), updateVendor);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteVendor);

export default router;
