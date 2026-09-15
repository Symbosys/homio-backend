import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as authController from "../controllers/auth.controller.js";

const router = Router();

// Public auth endpoints
router.post("/login", authController.login);

// Authenticated session & profile endpoints
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getMe);
router.patch("/me", authenticate, authController.updateMe);

export default router;
