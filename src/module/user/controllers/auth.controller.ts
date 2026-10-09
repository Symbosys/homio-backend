import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { authService } from "../services/auth.service.js";
import {
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  updateMeSchema,
} from "../validators/auth.validator.js";

/**
 * Controller: Generate and send OTP to Phone or Email
 *
 * @route   POST /api/v1/user/auth/send-otp
 * @desc    Generate 6-digit OTP code and save to auth_otps
 */
export const sendOtp = asyncHandler(async (req, res) => {
  const parsed = sendOtpSchema.parse({ body: req.body });
  const result = await authService.sendOtp(parsed.body);
  return SuccessResponse(res, result.message, result, statusCode.OK);
});

/**
 * Controller: Verify OTP code and authenticate / auto-provision user
 *
 * @route   POST /api/v1/user/auth/verify-otp
 * @desc    Validate OTP code, issue JWT access/refresh tokens, and auto-provision user if new
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const parsed = verifyOtpSchema.parse({ body: req.body });
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  const result = await authService.verifyOtp(parsed.body, { ipAddress, userAgent });
  const message = result.isNewUser
    ? "Registration & login successful via OTP"
    : "Login successful via OTP";
  return SuccessResponse(res, message, result, statusCode.OK);
});

/**
 * Controller: User login with credentials (Email & Password)
 *
 * @route   POST /api/v1/user/auth/login
 * @desc    Authenticate staff or admin using password
 */
export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.parse({ body: req.body });
  const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  const result = await authService.login(parsed.body, { ipAddress, userAgent });
  return SuccessResponse(res, "Login successful", result, statusCode.OK);
});

/**
 * Controller: User logout (revokes refresh token)
 *
 * @route   POST /api/v1/user/auth/logout
 * @desc    Revoke session refresh token
 */
export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.body?.refreshToken;
  const result = await authService.logout(req.user!.id, rawRefreshToken);
  return SuccessResponse(res, "Logout successful", result, statusCode.OK);
});

/**
 * Controller: Get current authenticated user profile
 *
 * @route   GET /api/v1/user/auth/me
 * @desc    Retrieve profile of currently authenticated user
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user!.id);
  return SuccessResponse(res, "Profile retrieved successfully", user, statusCode.OK);
});

/**
 * Controller: Update current authenticated user profile
 *
 * @route   PATCH /api/v1/user/auth/me
 * @desc    Update profile information for authenticated user
 */
export const updateMe = asyncHandler(async (req, res) => {
  const parsed = updateMeSchema.parse({ body: req.body });
  const user = await authService.updateMe(req.user!.id, parsed.body);
  return SuccessResponse(res, "Profile updated successfully", user, statusCode.OK);
});