import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ENV } from "../../../config/env.js";
import { userRepo } from "../repos/user.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { LoginInput, UpdateMeInput } from "../validators/auth.validator.js";

export class AuthService {
  /**
   * Authenticate user with credentials, generate access & refresh tokens
   */
  async login(input: LoginInput, meta: { ipAddress?: string; userAgent?: string }) {
    const user = await userRepo.findByEmail(input.email);
    if (!user) {
      throw new ErrorResponse("Invalid email or password", statusCode.Unauthorized);
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      throw new ErrorResponse(
        `Account is temporarily locked. Try again in ${remainingMinutes} minute(s).`,
        statusCode.Forbidden
      );
    }

    // Check account status
    if (user.status !== "ACTIVE") {
      throw new ErrorResponse(
        `Account is currently ${user.status.toLowerCase()}. Please contact administrator.`,
        statusCode.Forbidden
      );
    }

    if (!user.passwordHash) {
      throw new ErrorResponse("Password not configured for this account. Please use reset password.", statusCode.Unauthorized);
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      await userRepo.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new ErrorResponse("Invalid email or password", statusCode.Unauthorized);
    }

    // Reset failed counter & record login IP
    await userRepo.recordSuccessfulLogin(user.id, meta.ipAddress);

    if (!ENV.JWT_SECRET) {
      throw new ErrorResponse("JWT Secret is not configured on server", statusCode.Internal_Server_Error);
    }

    // Issue Access Token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        userType: user.userType,
        organizationId: user.organizationId,
      },
      ENV.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Issue Refresh Token
    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await userRepo.createRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
      deviceInfo: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const { passwordHash: _, ...safeUser } = user as any;

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: safeUser,
    };
  }

  /**
   * Log out user and revoke session token
   */
  async logout(userId: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
      await userRepo.revokeRefreshToken(tokenHash);
    } else {
      await userRepo.revokeAllUserTokens(userId);
    }
    return { message: "Successfully logged out" };
  }

  /**
   * Get current authenticated user profile with roles and permissions
   */
  async getMe(userId: string) {
    const user = await userRepo.findById(userId, true);
    if (!user) {
      throw new ErrorResponse("User not found", statusCode.Not_Found);
    }

    const { passwordHash: _, ...safeUser } = user as any;
    return safeUser;
  }

  /**
   * Update self profile
   */
  async updateMe(userId: string, input: UpdateMeInput) {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new ErrorResponse("User not found", statusCode.Not_Found);
    }

    if (input.phone && input.phone !== user.phone) {
      const existingPhone = await userRepo.findByPhone(input.phone);
      if (existingPhone && existingPhone.id !== userId) {
        throw new ErrorResponse("Phone number is already associated with another account", statusCode.Conflict);
      }
    }

    const updated = await userRepo.update(userId, input);
    const { passwordHash: _, ...safeUser } = updated as any;
    return safeUser;
  }
}

export const authService = new AuthService();
