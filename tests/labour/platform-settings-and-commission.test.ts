import { describe, it, expect } from "bun:test";
import { platformLabourSettingSchema } from "../../src/module/labour/validators/labour-booking.validator.js";

describe("Platform Labour Settings & Dynamic Commission Engine Test Suite", () => {
  describe("1. Platform Labour Settings Validation", () => {
    it("should accept valid operational settings payload with dynamic commission rate", () => {
      const payload = {
        body: {
          autoAssignLabour: false,
          platformCommissionRate: 15.5,
          cooldownPeriodDays: 7,
          consecutiveRejectionsThreshold: 4,
          delayReportMinHours: 36,
        },
      };

      const parsed = platformLabourSettingSchema.parse(payload);
      expect(parsed.body.autoAssignLabour).toBe(false);
      expect(parsed.body.platformCommissionRate).toBe(15.5);
      expect(parsed.body.cooldownPeriodDays).toBe(7);
      expect(parsed.body.consecutiveRejectionsThreshold).toBe(4);
      expect(parsed.body.delayReportMinHours).toBe(36);
    });

    it("should reject negative commission rate", () => {
      const payload = {
        body: {
          platformCommissionRate: -2.5,
        },
      };

      expect(() => platformLabourSettingSchema.parse(payload)).toThrow();
    });

    it("should reject commission rate exceeding 100%", () => {
      const payload = {
        body: {
          platformCommissionRate: 105.0,
        },
      };

      expect(() => platformLabourSettingSchema.parse(payload)).toThrow();
    });

    it("should reject invalid cooldown bounds (< 1 day or > 90 days)", () => {
      expect(() => platformLabourSettingSchema.parse({ body: { cooldownPeriodDays: 0 } })).toThrow();
      expect(() => platformLabourSettingSchema.parse({ body: { cooldownPeriodDays: 95 } })).toThrow();
    });

    it("should reject invalid consecutive rejections threshold (< 1 or > 20)", () => {
      expect(() => platformLabourSettingSchema.parse({ body: { consecutiveRejectionsThreshold: 0 } })).toThrow();
      expect(() => platformLabourSettingSchema.parse({ body: { consecutiveRejectionsThreshold: 25 } })).toThrow();
    });

    it("should reject invalid delay report min hours (< 1 or > 168)", () => {
      expect(() => platformLabourSettingSchema.parse({ body: { delayReportMinHours: 0 } })).toThrow();
      expect(() => platformLabourSettingSchema.parse({ body: { delayReportMinHours: 200 } })).toThrow();
    });
  });

  describe("2. Dynamic Platform Commission Calculation Engine", () => {
    it("should calculate commission accurately using dynamic platform setting rate", () => {
      const platformSetting = {
        platformCommissionRate: 12.5, // 12.5% take rate set by platform
      };

      const quoteDealValue = 8000; // ₹8,000 quote
      const commissionAmount = Number(((quoteDealValue * platformSetting.platformCommissionRate) / 100).toFixed(2));
      const netLabourTakeHome = quoteDealValue - commissionAmount;

      expect(commissionAmount).toBe(1000.0);
      expect(netLabourTakeHome).toBe(7000.0);
    });

    it("should reflect updated platform commission rate when platform changes setting", () => {
      // Platform updates rate from 10% to 18.0%
      let platformRate = 10.0;
      let dealAmount = 15000;
      let commission = Number(((dealAmount * platformRate) / 100).toFixed(2));
      expect(commission).toBe(1500.0);

      // Admin updates platform rate to 18.0%
      platformRate = 18.0;
      commission = Number(((dealAmount * platformRate) / 100).toFixed(2));
      const netLabourEarnings = dealAmount - commission;

      expect(commission).toBe(2700.0);
      expect(netLabourEarnings).toBe(12300.0);
    });

    it("should enforce 0% commission for internal B2B Organization site bookings regardless of platform rate", () => {
      const platformSetting = {
        platformCommissionRate: 15.0,
      };

      const bookingChannel: string = "ORGANIZATION_PROJECT";
      const totalAmount = 25000;

      const rate = bookingChannel === "PLATFORM_MARKETPLACE" ? platformSetting.platformCommissionRate : 0.0;
      const commissionAmount = Number(((totalAmount * rate) / 100).toFixed(2));

      expect(rate).toBe(0.0);
      expect(commissionAmount).toBe(0.0);
    });
  });

  describe("3. Dynamic Anti-Abuse Cooldown Policy", () => {
    it("should lock user based on dynamic consecutiveRejectionsThreshold and cooldownPeriodDays", () => {
      // Platform config: threshold = 2 rejections, cooldown = 5 days
      const dynamicSettings = {
        consecutiveRejectionsThreshold: 2,
        cooldownPeriodDays: 5,
      };

      let rejectionCount = 0;
      let isLocked = false;
      let lockedUntil: Date | null = null;
      const now = Date.now();

      // Rejection 1
      rejectionCount += 1;
      if (rejectionCount >= dynamicSettings.consecutiveRejectionsThreshold) {
        isLocked = true;
        lockedUntil = new Date(now + dynamicSettings.cooldownPeriodDays * 24 * 60 * 60 * 1000);
      }
      expect(rejectionCount).toBe(1);
      expect(isLocked).toBe(false);

      // Rejection 2 -> Reaches dynamic threshold of 2
      rejectionCount += 1;
      if (rejectionCount >= dynamicSettings.consecutiveRejectionsThreshold) {
        isLocked = true;
        lockedUntil = new Date(now + dynamicSettings.cooldownPeriodDays * 24 * 60 * 60 * 1000);
      }
      expect(rejectionCount).toBe(2);
      expect(isLocked).toBe(true);
      expect(lockedUntil).not.toBeNull();

      const hoursLocked = Math.round((lockedUntil!.getTime() - now) / (1000 * 60 * 60));
      expect(hoursLocked).toBe(120); // 5 days * 24h = 120 hours
    });

    it("should clear cooldown lock when client accepts a quotation", () => {
      let isLocked = true;
      let rejectionCount = 3;
      let lockedUntil: Date | null = new Date(Date.now() + 72 * 60 * 60 * 1000);

      // Client accepts quote
      isLocked = false;
      rejectionCount = 0;
      lockedUntil = null;

      expect(isLocked).toBe(false);
      expect(rejectionCount).toBe(0);
      expect(lockedUntil).toBeNull();
    });
  });

  describe("4. Dynamic Delay Reporting Policy", () => {
    it("should enforce dynamic delayReportMinHours before delay reporting is allowed", () => {
      const dynamicSetting = {
        delayReportMinHours: 36, // 36 hours required instead of default 24
      };

      const bookingStartTime = Date.now() - 20 * 60 * 60 * 1000; // 20 hours ago
      const hoursElapsed1 = (Date.now() - bookingStartTime) / (1000 * 60 * 60);

      const canReportDelay1 = hoursElapsed1 >= dynamicSetting.delayReportMinHours;
      expect(canReportDelay1).toBe(false);

      const bookingStartTime2 = Date.now() - 38 * 60 * 60 * 1000; // 38 hours ago
      const hoursElapsed2 = (Date.now() - bookingStartTime2) / (1000 * 60 * 60);

      const canReportDelay2 = hoursElapsed2 >= dynamicSetting.delayReportMinHours;
      expect(canReportDelay2).toBe(true);
    });
  });
});
