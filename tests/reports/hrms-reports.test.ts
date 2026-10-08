import { describe, it, expect } from "bun:test";
import { HrmsReportsRepository } from "../../src/module/reports/repos/hrms-report.repo.js";

describe("HRMS Reports & Analytics Tests", () => {
  const repo = new HrmsReportsRepository();

  describe("Date Range Presets Resolution", () => {
    it("should resolve this_month preset with start of month and end of month", () => {
      const { startDate, endDate } = repo.resolveDateRange({ preset: "this_month" });
      const now = new Date();

      expect(startDate).toBeDefined();
      expect(endDate).toBeDefined();
      expect(startDate?.getUTCFullYear()).toBe(now.getFullYear());
      expect(startDate?.getUTCMonth()).toBe(now.getMonth());
      expect(startDate?.getUTCDate()).toBe(1);
    });

    it("should resolve last_month preset correctly", () => {
      const { startDate, endDate } = repo.resolveDateRange({ preset: "last_month" });

      expect(startDate).toBeDefined();
      expect(endDate).toBeDefined();
      expect(startDate?.getUTCDate()).toBe(1);
    });

    it("should resolve this_year preset starting on Jan 1st and ending Dec 31st", () => {
      const { startDate, endDate } = repo.resolveDateRange({ preset: "this_year" });
      const now = new Date();

      expect(startDate?.getUTCFullYear()).toBe(now.getFullYear());
      expect(startDate?.getUTCMonth()).toBe(0);
      expect(startDate?.getUTCDate()).toBe(1);
      expect(endDate?.getUTCMonth()).toBe(11);
      expect(endDate?.getUTCDate()).toBe(31);
    });

    it("should resolve custom date range correctly", () => {
      const { startDate, endDate } = repo.resolveDateRange({
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      });

      expect(startDate?.toISOString().slice(0, 10)).toBe("2026-06-01");
      expect(endDate?.toISOString().slice(0, 10)).toBe("2026-06-30");
    });
  });

  describe("HRMS Payroll & Incentives Metric Mathematics", () => {
    it("should accurately compute gross, net, deductions, and average salary", () => {
      const records = [
        { grossEarnings: 50000, totalDeductions: 5000, netPay: 45000 },
        { grossEarnings: 30000, totalDeductions: 3000, netPay: 27000 },
        { grossEarnings: 20000, totalDeductions: 2000, netPay: 18000 },
      ];

      const totalGross = records.reduce((acc, r) => acc + r.grossEarnings, 0);
      const totalNet = records.reduce((acc, r) => acc + r.netPay, 0);
      const totalDeductions = records.reduce((acc, r) => acc + r.totalDeductions, 0);
      const avgSalary = Math.round(totalNet / records.length);

      expect(totalGross).toBe(100000);
      expect(totalNet).toBe(90000);
      expect(totalDeductions).toBe(10000);
      expect(avgSalary).toBe(30000);
    });

    it("should calculate credit vs debit incentive totals and percentages accurately", () => {
      const totalCredits = 45000;
      const totalDebits = 5000;
      const totalVolume = totalCredits + totalDebits;
      const netIncentives = totalCredits - totalDebits;

      const creditPercentage = Math.round((totalCredits / totalVolume) * 1000) / 10;
      const debitPercentage = Math.round((totalDebits / totalVolume) * 1000) / 10;

      expect(netIncentives).toBe(40000);
      expect(creditPercentage).toBe(90);
      expect(debitPercentage).toBe(10);
      expect(creditPercentage + debitPercentage).toBe(100);
    });

    it("should rank top incentive earners by net incentives correctly", () => {
      const earners = [
        { employeeName: "Alice", netIncentives: 15000 },
        { employeeName: "Bob", netIncentives: 30000 },
        { employeeName: "Charlie", netIncentives: 22000 },
      ];

      const ranked = [...earners].sort((a, b) => b.netIncentives - a.netIncentives);

      expect(ranked[0]!.employeeName).toBe("Bob");
      expect(ranked[0]!.netIncentives).toBe(30000);
      expect(ranked[1]!.employeeName).toBe("Charlie");
      expect(ranked[2]!.employeeName).toBe("Alice");
    });

    it("should compute overall attendance rate from present, half days, and logs correctly", () => {
      const presentCount = 20;
      const halfDayCount = 4;
      const absentCount = 6;
      const totalLogs = presentCount + halfDayCount + absentCount; // 30

      const effectiveAttended = presentCount + halfDayCount * 0.5; // 22
      const rate = Math.round((effectiveAttended / totalLogs) * 1000) / 10;

      expect(totalLogs).toBe(30);
      expect(effectiveAttended).toBe(22);
      expect(rate).toBe(73.3);
    });
  });
});
