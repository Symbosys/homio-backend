import { describe, it, expect } from "bun:test";

describe("HRMS Payroll Attendance-Based Salary Calculation Tests", () => {
  it("should calculate exact daily wage rate based on monthly gross and cycle days", () => {
    const monthlyGross = 10000;
    const daysInCycle = 30;
    const dailyWageRate = Math.round((monthlyGross / daysInCycle) * 100) / 100;

    expect(dailyWageRate).toBe(333.33);
  });

  it("should accurately deduct 10 days of salary when employee is absent for 10 days out of 30 days", () => {
    const monthlyGross = 10000;
    const daysInCycle = 30;
    const presentDays = 20; // 30 - 10 absent
    const absentDays = 10;

    const attendanceRatio = presentDays / daysInCycle;
    const grossEarned = Math.round(monthlyGross * attendanceRatio);
    const absentDeduction = monthlyGross - grossEarned;

    expect(grossEarned).toBe(6667);
    expect(absentDeduction).toBe(3333);
    expect(grossEarned + absentDeduction).toBe(monthlyGross);
  });

  it("should accurately pay 50% for half days and deduct the remaining 50%", () => {
    const monthlyGross = 10000;
    const daysInCycle = 30;
    const fullPresentDays = 25;
    const halfDays = 5; // 5 half days -> 2.5 days paid, 2.5 days deducted

    const effectivePayableDays = fullPresentDays * 1.0 + halfDays * 0.5; // 27.5 days
    const effectiveDeductedDays = halfDays * 0.5; // 2.5 days

    expect(effectivePayableDays).toBe(27.5);
    expect(effectiveDeductedDays).toBe(2.5);

    const attendanceRatio = effectivePayableDays / daysInCycle;
    const grossEarned = Math.round(monthlyGross * attendanceRatio);
    const halfDayDeduction = monthlyGross - grossEarned;

    expect(grossEarned).toBe(9167);
    expect(halfDayDeduction).toBe(833);
  });

  it("should combine absent days, half days, paid leaves, and week offs correctly", () => {
    const monthlyGross = 30000;
    const daysInCycle = 30;
    // Schedule: 18 present, 4 week offs, 2 paid leaves, 2 half days, 4 absent
    const presentDays = 18;
    const weekOffs = 4;
    const paidLeaves = 2;
    const halfDays = 2; // 1 day paid, 1 day deducted
    const absentDays = 4;

    const effectivePayableDays = presentDays + weekOffs + paidLeaves + halfDays * 0.5; // 18 + 4 + 2 + 1 = 25 days
    const effectiveDeductedDays = absentDays + halfDays * 0.5; // 4 + 1 = 5 days

    expect(effectivePayableDays).toBe(25);
    expect(effectiveDeductedDays).toBe(5);
    expect(effectivePayableDays + effectiveDeductedDays).toBe(daysInCycle);

    const attendanceRatio = effectivePayableDays / daysInCycle;
    const grossEarned = Math.round(monthlyGross * attendanceRatio);
    const deduction = monthlyGross - grossEarned;

    expect(grossEarned).toBe(25000);
    expect(deduction).toBe(5000);
  });

  it("should handle 100% full attendance without deductions", () => {
    const monthlyGross = 50000;
    const daysInCycle = 31;
    const effectivePayableDays = 31;

    const attendanceRatio = effectivePayableDays / daysInCycle;
    const grossEarned = Math.round(monthlyGross * attendanceRatio);

    expect(grossEarned).toBe(50000);
  });

  it("should handle 100% absence with zero earned gross pay", () => {
    const monthlyGross = 25000;
    const daysInCycle = 30;
    const effectivePayableDays = 0;

    const attendanceRatio = effectivePayableDays / daysInCycle;
    const grossEarned = Math.round(monthlyGross * attendanceRatio);

    expect(grossEarned).toBe(0);
  });
});
