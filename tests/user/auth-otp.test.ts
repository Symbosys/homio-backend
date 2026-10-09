import { describe, it, expect, afterAll } from "bun:test";
import { authService } from "../../src/module/user/services/auth.service";
import { prisma } from "../../src/lib/prisma";
import jwt from "jsonwebtoken";
import { ENV } from "../../src/config/env";

describe("Passwordless OTP Authentication & Auto-Provisioning Tests", () => {
  const testRunId = Date.now();
  const createdUserIds: string[] = [];

  afterAll(async () => {
    // Cleanup users created during test run
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }
  });

  // =========================================================================
  // 1. Phone OTP Dispatch & Verification
  // =========================================================================
  describe("Phone OTP Login & Registration Flow", () => {
    const rawTenDigits = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testPhoneWithCountryCode = `+91${rawTenDigits}`;
    const testPhone = rawTenDigits;

    it("should generate and save a 6-digit numeric OTP for a phone number (normalized to 10 digits)", async () => {
      // Dispatch with +91 country prefix
      const sendResult = await authService.sendOtp({
        identifier: testPhoneWithCountryCode,
      });

      expect(sendResult.identifier).toBe(testPhone); // Normalized to 10 digits
      expect(sendResult.type).toBe("PHONE");
      expect(sendResult.userExists).toBe(false);
      expect(sendResult.otp).toBeDefined();
      expect(sendResult.otp?.length).toBe(6);
      expect(/^\d{6}$/.test(sendResult.otp!)).toBe(true);

      // Verify stored in DB with 10 digits
      const dbOtp = await prisma.authOtp.findFirst({
        where: { identifier: testPhone, isUsed: false },
        orderBy: { createdAt: "desc" },
      });

      expect(dbOtp).toBeDefined();
      expect(dbOtp?.otp).toBe(sendResult.otp!);
      expect(dbOtp?.type).toBe("PHONE");
      expect(dbOtp?.purpose).toBe("LOGIN");
      expect(dbOtp?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should verify OTP, auto-provision user with 'Homio User' and issue JWT tokens for new phone user", async () => {
      const sendResult = await authService.sendOtp({ identifier: testPhone });
      const otpCode = sendResult.otp!;

      const verifyResult = await authService.verifyOtp(
        {
          identifier: testPhone,
          otp: otpCode,
        },
        { ipAddress: "127.0.0.1", userAgent: "Bun-Test-Agent" }
      );

      expect(verifyResult.isNewUser).toBe(true);
      expect(verifyResult.user).toBeDefined();
      expect(verifyResult.user.id).toBeDefined();
      createdUserIds.push(verifyResult.user.id);

      expect(verifyResult.user.firstName).toBe("Homio User");
      expect(verifyResult.user.lastName).toBeNull();
      expect(verifyResult.user.phone).toBe(testPhone);
      expect(verifyResult.user.email).toContain("@client.homiocrm.com");
      expect(verifyResult.user.userType).toBe("USER");
      expect(verifyResult.user.status).toBe("ACTIVE");
      expect(verifyResult.user.organizationId).toBeNull();

      expect(verifyResult.accessToken).toBeDefined();
      expect(verifyResult.refreshToken).toBeDefined();

      // Verify JWT payload
      const decoded = jwt.verify(verifyResult.accessToken, ENV.JWT_SECRET || "fallback_jwt_secret") as any;
      expect(decoded.userId).toBe(verifyResult.user.id);
      expect(decoded.userType).toBe("USER");

      // Verify OTP is marked as used
      const usedOtp = await prisma.authOtp.findFirst({
        where: { identifier: testPhone, otp: otpCode },
      });
      expect(usedOtp?.isUsed).toBe(true);
    });

    it("should login existing phone user with new OTP without creating a duplicate user (even if entered with +91)", async () => {
      // 1. Send OTP for existing user with +91 prefix
      const sendResult = await authService.sendOtp({ identifier: testPhoneWithCountryCode });
      expect(sendResult.identifier).toBe(testPhone);
      expect(sendResult.userExists).toBe(true); // User exists now

      // 2. Verify OTP with raw 10 digits
      const verifyResult = await authService.verifyOtp(
        {
          identifier: testPhone,
          otp: sendResult.otp!,
        },
        { ipAddress: "127.0.0.1" }
      );

      expect(verifyResult.isNewUser).toBe(false); // Existing user
      expect(verifyResult.user.phone).toBe(testPhone);
      expect(verifyResult.user.firstName).toBe("Homio User");

      // Verify only 1 user exists with this phone
      const allUsers = await prisma.user.findMany({ where: { phone: testPhone } });
      expect(allUsers.length).toBe(1);
    });
  });

  // =========================================================================
  // 2. Email OTP Dispatch & Verification
  // =========================================================================
  describe("Email OTP Login & Registration Flow", () => {
    const testEmail = `client_otp_${testRunId}@example.com`;

    it("should generate and save a 6-digit numeric OTP for an email address", async () => {
      const sendResult = await authService.sendOtp({
        identifier: `  ${testEmail.toUpperCase()}  `, // Test normalization
      });

      expect(sendResult.identifier).toBe(testEmail);
      expect(sendResult.type).toBe("EMAIL");
      expect(sendResult.userExists).toBe(false);
      expect(sendResult.otp).toBeDefined();
      expect(sendResult.otp?.length).toBe(6);
    });

    it("should verify OTP, auto-provision user with 'Homio User' and issue tokens for new email user", async () => {
      const sendResult = await authService.sendOtp({ identifier: testEmail });
      const otpCode = sendResult.otp!;

      const verifyResult = await authService.verifyOtp(
        {
          identifier: testEmail,
          otp: otpCode,
        },
        { ipAddress: "127.0.0.1" }
      );

      expect(verifyResult.isNewUser).toBe(true);
      expect(verifyResult.user.id).toBeDefined();
      createdUserIds.push(verifyResult.user.id);

      expect(verifyResult.user.firstName).toBe("Homio User");
      expect(verifyResult.user.email).toBe(testEmail);
      expect(verifyResult.user.phone).toBeNull();
      expect(verifyResult.user.userType).toBe("USER");
      expect(verifyResult.user.status).toBe("ACTIVE");
      expect(verifyResult.user.organizationId).toBeNull();

      expect(verifyResult.accessToken).toBeDefined();
      expect(verifyResult.refreshToken).toBeDefined();
    });

    it("should login existing email user with new OTP without creating a duplicate user", async () => {
      const sendResult = await authService.sendOtp({ identifier: testEmail });
      expect(sendResult.userExists).toBe(true);

      const verifyResult = await authService.verifyOtp({
        identifier: testEmail,
        otp: sendResult.otp!,
      }, { ipAddress: "127.0.0.1" });

      expect(verifyResult.isNewUser).toBe(false);
      expect(verifyResult.user.email).toBe(testEmail);

      const allUsers = await prisma.user.findMany({ where: { email: testEmail } });
      expect(allUsers.length).toBe(1);
    });
  });

  // =========================================================================
  // 3. Security & Validation Failure Cases
  // =========================================================================
  describe("Security & OTP Rejection Scenarios", () => {
    const securityPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    it("should reject verification with incorrect OTP code", async () => {
      await authService.sendOtp({ identifier: securityPhone });

      let errorCaught = false;
      try {
        await authService.verifyOtp(
          {
            identifier: securityPhone,
            otp: "000000", // Wrong OTP
          },
          { ipAddress: "127.0.0.1" }
        );
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toContain("Invalid or expired OTP code");
      }
      expect(errorCaught).toBe(true);
    });

    it("should reject re-using an already consumed OTP (Replay Attack Prevention)", async () => {
      const sendResult = await authService.sendOtp({ identifier: securityPhone });
      const validOtp = sendResult.otp!;

      // 1. First verification succeeds
      const firstVerify = await authService.verifyOtp(
        { identifier: securityPhone, otp: validOtp },
        { ipAddress: "127.0.0.1" }
      );
      expect(firstVerify.user.id).toBeDefined();
      createdUserIds.push(firstVerify.user.id);

      // 2. Second verification with same OTP MUST fail
      let errorCaught = false;
      try {
        await authService.verifyOtp(
          { identifier: securityPhone, otp: validOtp },
          { ipAddress: "127.0.0.1" }
        );
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toContain("Invalid or expired OTP code");
      }
      expect(errorCaught).toBe(true);
    });

    it("should reject verification of expired OTP", async () => {
      const expiredPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
      const expiredOtpCode = "889911";

      // Insert an expired OTP directly
      await prisma.authOtp.create({
        data: {
          identifier: expiredPhone,
          type: "PHONE",
          otp: expiredOtpCode,
          purpose: "LOGIN",
          expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 min ago
          isUsed: false,
        },
      });

      let errorCaught = false;
      try {
        await authService.verifyOtp(
          { identifier: expiredPhone, otp: expiredOtpCode },
          { ipAddress: "127.0.0.1" }
        );
      } catch (err: any) {
        errorCaught = true;
        expect(err.message).toContain("Invalid or expired OTP code");
      }
      expect(errorCaught).toBe(true);
    });
  });
});
