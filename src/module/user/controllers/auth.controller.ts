import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { authService } from "../services/auth.service.js";
import { loginSchema, updateMeSchema } from "../validators/auth.validator.js";

/**
 * Controller: User login
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
 */
export const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.body?.refreshToken;
  const result = await authService.logout(req.user!.id, rawRefreshToken);
  return SuccessResponse(res, "Logout successful", result, statusCode.OK);
});

/**
 * Controller: Get current authenticated user profile
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user!.id);
  return SuccessResponse(res, "Profile retrieved successfully", user, statusCode.OK);
});

/**
 * Controller: Update current authenticated user profile
 */
export const updateMe = asyncHandler(async (req, res) => {
  const parsed = updateMeSchema.parse({ body: req.body });
  const user = await authService.updateMe(req.user!.id, parsed.body);
  return SuccessResponse(res, "Profile updated successfully", user, statusCode.OK);
});