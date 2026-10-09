import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as authController from "../controllers/auth.controller.js";

const router = Router();

/**
 * @route   POST /api/v1/user/auth/send-otp
 * @desc    Generate and dispatch 6-digit OTP to Phone number or Email
 */
router.post("/send-otp", authController.sendOtp);

/**
 * @route   POST /api/v1/user/auth/verify-otp
 * @desc    Validate 6-digit OTP code, auto-provision user if new, and return JWT tokens
 */
router.post("/verify-otp", authController.verifyOtp);

/**
 * @route   POST /api/v1/user/auth/login
 * @desc    Authenticate staff or admin using email and password
 */
router.post("/login", authController.login);

/**
 * @route   POST /api/v1/user/auth/logout
 * @desc    Log out current session and revoke refresh token
 */
router.post("/logout", authenticate, authController.logout);

/**
 * @route   GET /api/v1/user/auth/me
 * @desc    Get profile details for authenticated user
 */
router.get("/me", authenticate, authController.getMe);

/**
 * @route   PATCH /api/v1/user/auth/me
 * @desc    Update self profile details
 */
router.patch("/me", authenticate, authController.updateMe);

export default router;
