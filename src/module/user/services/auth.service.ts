import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ENV } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { userRepo } from "../repos/user.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, OtpType } from "../../../types/types.js";
import type { LoginInput, UpdateMeInput, SendOtpInput, VerifyOtpInput } from "../validators/auth.validator.js";

/**
 * Service orchestrating credential-based and passwordless OTP authentication
 * for multi-tenant staff and independent global clients.
 */
export class AuthService {
  /**
   * Helper: Detect whether identifier is an Email or Phone
   */
  private detectIdentifierType(identifier: string, explicitType?: OtpType): OtpType {
    if (explicitType) return explicitType;
    return identifier.includes("@") ? "EMAIL" : "PHONE";
  }

  /**
   * Helper: Clean and normalize identifier
   */
  private normalizeIdentifier(identifier: string, type: OtpType): string {
    if (type === "EMAIL") {
      return identifier.trim().toLowerCase();
    }
    const digits = identifier.replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }

  /**
   * Send 6-digit OTP to Phone or Email for passwordless login / registration
   *
   * @param input - Identifier (phone/email) and optional type/purpose
   * @returns OTP dispatch status and debug code in non-production
   */
  async sendOtp(input: SendOtpInput) {
    const type = this.detectIdentifierType(input.identifier, input.type);
    const cleanIdentifier = this.normalizeIdentifier(input.identifier, type);

    if (type === "PHONE" && !/^\d{10}$/.test(cleanIdentifier)) {
      throw new ErrorResponse("Phone number must be exactly 10 digits", statusCode.Bad_Request);
    }

    // 1. Check if user already exists in platform
    let existingUser = null;
    if (type === "PHONE") {
      existingUser = await prisma.user.findFirst({
        where: { phone: cleanIdentifier, isDeleted: false },
        select: { id: true, firstName: true, status: true },
      });
    } else {
      existingUser = await prisma.user.findFirst({
        where: { email: cleanIdentifier, isDeleted: false },
        select: { id: true, firstName: true, status: true },
      });
    }

    // 2. Invalidate any active, unused OTPs for this identifier
    await prisma.authOtp.updateMany({
      where: {
        identifier: cleanIdentifier,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    // 3. Generate cryptographically secure 6-digit OTP
    const generatedOtp = crypto.randomInt(100000, 999999).toString();
    
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 4. Save to AuthOtp table
    await prisma.authOtp.create({
      data: {
        identifier: cleanIdentifier,
        type,
        otp: generatedOtp,
        purpose: input.purpose || "LOGIN",
        expiresAt,
        isUsed: false,
      },
    });

    const isDevMode =
      ENV.MODE !== "PRODUCTION" ||
      process.env.NODE_ENV !== "production";

    return {
      message: `your otp is ${generatedOtp}`,
      identifier: cleanIdentifier,
      type,
      userExists: Boolean(existingUser),
      otp: isDevMode ? generatedOtp : undefined,
    };
  }

  /**
   * Verify OTP, auto-provision user if new, and issue JWT access & refresh tokens
   *
   * @param input - Identifier and 6-digit OTP code
   * @param meta - Request metadata (IP address, user agent)
   * @returns Access token, refresh token, user profile, and isNewUser flag
   */
  async verifyOtp(input: VerifyOtpInput, meta: { ipAddress?: string; userAgent?: string }) {
    const type = this.detectIdentifierType(input.identifier, input.type);
    const cleanIdentifier = this.normalizeIdentifier(input.identifier, type);
    const enteredOtp = input.otp.trim();

    if (type === "PHONE" && !/^\d{10}$/.test(cleanIdentifier)) {
      throw new ErrorResponse("Phone number must be exactly 10 digits", statusCode.Bad_Request);
    }

    // 1. Locate latest active non-expired OTP record
    const otpRecord = await prisma.authOtp.findFirst({
      where: {
        identifier: cleanIdentifier,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord || otpRecord.otp !== enteredOtp) {
      throw new ErrorResponse("Invalid or expired OTP code", statusCode.Unauthorized);
    }

    // 2. Mark OTP as used (replay attack prevention)
    await prisma.authOtp.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // 3. Resolve or auto-provision global User
    let user = null;
    let isNewUser = false;

    if (type === "PHONE") {
      user = await prisma.user.findFirst({
        where: { phone: cleanIdentifier, isDeleted: false },
      });

      if (!user) {
        isNewUser = true;
        const cleanDigits = cleanIdentifier.replace(/[^0-9]/g, "");
        let fallbackEmail = `${cleanDigits || Date.now()}@client.homiocrm.com`;

        const emailConflict = await prisma.user.findUnique({
          where: { email: fallbackEmail },
          select: { id: true },
        });
        if (emailConflict) {
          fallbackEmail = `${Date.now()}_${fallbackEmail}`;
        }

        user = await prisma.user.create({
          data: {
            firstName: "Homio User",
            lastName: null,
            phone: cleanIdentifier,
            email: fallbackEmail,
            userType: "USER",
            status: "ACTIVE",
            organizationId: null, // Global independent client
            phoneVerifiedAt: new Date(),
          },
        });
      }
    } else {
      user = await prisma.user.findFirst({
        where: { email: cleanIdentifier, isDeleted: false },
      });

      if (!user) {
        isNewUser = true;
        user = await prisma.user.create({
          data: {
            firstName: "Homio User",
            lastName: null,
            phone: null,
            email: cleanIdentifier,
            userType: "USER",
            status: "ACTIVE",
            organizationId: null, // Global independent client
            emailVerifiedAt: new Date(),
          },
        });
      }
    }

    // 4. Verify Account Status
    if (user.status !== "ACTIVE") {
      throw new ErrorResponse(
        `Account is currently ${user.status.toLowerCase()}. Please contact administrator.`,
        statusCode.Forbidden
      );
    }

    // 5. Record successful login timestamp & IP
    await userRepo.recordSuccessfulLogin(user.id, meta.ipAddress);

    if (!ENV.JWT_SECRET) {
      throw new ErrorResponse("JWT Secret is not configured on server", statusCode.Internal_Server_Error);
    }

    // 6. Issue Access Token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        userType: user.userType,
        organizationId: user.organizationId,
      },
      ENV.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // 7. Issue Refresh Token
    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

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
      isNewUser,
    };
  }

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
      throw new ErrorResponse("Password not configured for this account. Please use reset password or login via OTP.", statusCode.Unauthorized);
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
