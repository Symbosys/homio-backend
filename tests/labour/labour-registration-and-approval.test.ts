import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../../src/lib/prisma.js";
import { labourService } from "../../src/module/labour/services/labour.service.js";
import { LabourStatus, UserStatus, UserType } from "../../src/types/types.js";

describe("Labour Self-Registration & Platform Approval Integration Tests", () => {
  let createdLabourIds: string[] = [];
  let createdUserIds: string[] = [];

  afterAll(async () => {
    // Cleanup created test records
    if (createdLabourIds.length > 0) {
      await prisma.labourKycDocument.deleteMany({
        where: { labourId: { in: createdLabourIds } },
      }).catch(() => {});

      await prisma.labour.deleteMany({
        where: { id: { in: createdLabourIds } },
      }).catch(() => {});
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }
  });

  // =========================================================================
  // 1. Public Self-Registration (Platform Pool, PENDING Status)
  // =========================================================================
  it("should successfully register a new labour into the platform pool with PENDING status", async () => {
    const uniquePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const uniqueEmail = `worker_${Date.now()}@example.com`;

    const result = await labourService.registerPublicLabour({
      name: "Rameshwar Sharma",
      phone: uniquePhone,
      altPhone: "9123456789",
      email: uniqueEmail,
      password: "LabourSecurePass123!",
      trade: "Carpentry",
      skillLevel: "Skilled",
      dailyRate: 1100,
      hourlyRate: 160,
      address: "Shivaji Nagar, Lane 4",
      state: "Maharashtra",
      city: "Pune",
      locality: "Shivaji Nagar",
      pincode: "411005",
      aadhaarNo: "456789012345",
      bankName: "State Bank of India",
      bankAccountNo: "30012345678",
      ifscCode: "SBIN0001234",
      accountHolderName: "Rameshwar Sharma",
      upiId: "rameshwar@upi",
      emergencyContact: "Sunita Sharma",
      emergencyPhone: "9876543210",
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    createdLabourIds.push(result.id);
    if (result.userId) createdUserIds.push(result.userId);

    // Verify Labour record in Database
    const dbLabour = await prisma.labour.findUnique({
      where: { id: result.id },
      include: { kycDocument: true, user: true },
    });

    expect(dbLabour).toBeDefined();
    expect(dbLabour?.organizationId).toBeNull(); // Belongs to platform pool
    expect(dbLabour?.status).toBe(LabourStatus.PENDING);
    expect(dbLabour?.isAvailable).toBe(false); // Not available until approved
    expect(dbLabour?.isKycVerified).toBe(false);
    expect(dbLabour?.trade).toBe("Carpentry");
    expect(Number(dbLabour?.dailyRate)).toBe(1100);

    // Verify KYC Document record
    expect(dbLabour?.kycDocument).toBeDefined();
    expect(dbLabour?.kycDocument?.status).toBe("PENDING");
    expect(dbLabour?.kycDocument?.aadhaarNumber).toBe("456789012345");
    expect(dbLabour?.kycDocument?.bankAccountNo).toBe("30012345678");

    // Verify User record
    expect(dbLabour?.user).toBeDefined();
    expect(dbLabour?.user?.userType).toBe(UserType.LABOUR);
    expect(dbLabour?.user?.status).toBe(UserStatus.PENDING_VERIFICATION);
    expect(dbLabour?.user?.email).toBe(uniqueEmail);
  });

  // =========================================================================
  // 2. Conflict Handling (Duplicate Phone)
  // =========================================================================
  it("should reject registration with 409 Conflict if phone number is already registered", async () => {
    const sharedPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;

    const initial = await labourService.registerPublicLabour({
      name: "Mukesh Kumar",
      phone: sharedPhone,
      password: "Password123!",
      trade: "Plumbing",
      dailyRate: 950,
      state: "Delhi",
      city: "New Delhi",
    });
    createdLabourIds.push(initial.id);
    if (initial.userId) createdUserIds.push(initial.userId);

    // Attempt to register again with same phone
    let threw = false;
    try {
      await labourService.registerPublicLabour({
        name: "Mukesh Kumar Duplicate",
        phone: sharedPhone,
        password: "AnotherPassword123!",
        trade: "Plumbing",
        dailyRate: 1000,
        state: "Delhi",
        city: "New Delhi",
      });
    } catch (err: any) {
      threw = true;
      expect(err.message).toContain("already registered");
    }
    expect(threw).toBe(true);
  }, 15000);

  // =========================================================================
  // 3. Platform Admin Approval Flow
  // =========================================================================
  it("should allow Platform Admin to approve a PENDING labour and activate status to AVAILABLE", async () => {
    const phone = `96${Math.floor(10000000 + Math.random() * 90000000)}`;

    const labour = await labourService.registerPublicLabour({
      name: "Anil Prajapati",
      phone,
      password: "SecurePassword123!",
      trade: "Masonry",
      dailyRate: 1200,
      state: "Karnataka",
      city: "Bangalore",
    });
    createdLabourIds.push(labour.id);
    if (labour.userId) createdUserIds.push(labour.userId);

    expect(labour.status).toBe(LabourStatus.PENDING);

    // Platform Admin approves the labour
    const approved = await labourService.approveLabour(
      labour.id,
      { id: "admin-uuid-1", firstName: "Super", lastName: "Admin" },
      {
        tradeTestScore: 92.5,
        verificationNotes: "Aadhaar verified and trade practical test cleared with distinction",
      }
    );

    expect(approved.status).toBe(LabourStatus.AVAILABLE);
    expect(approved.isAvailable).toBe(true);
    expect(approved.isKycVerified).toBe(true);

    // Verify KYC document in DB
    const kycDoc = await prisma.labourKycDocument.findUnique({
      where: { labourId: labour.id },
    });
    expect(kycDoc?.status).toBe("APPROVED");
    expect(kycDoc?.tradeTestScore).toBe(92.5);
    expect(kycDoc?.verifiedBy).toBe("Super Admin");
    expect(kycDoc?.verifiedAt).toBeDefined();

    // Verify User account status in DB is now ACTIVE
    if (labour.userId) {
      const user = await prisma.user.findUnique({
        where: { id: labour.userId },
      });
      expect(user?.status).toBe(UserStatus.ACTIVE);
    }
  }, 15000);

  // =========================================================================
  // 4. Platform Admin Rejection Flow
  // =========================================================================
  it("should allow Platform Admin to reject an application with audit rejection reason", async () => {
    const phone = `95${Math.floor(10000000 + Math.random() * 90000000)}`;

    const labour = await labourService.registerPublicLabour({
      name: "Sanjay Yadav",
      phone,
      password: "Password123!",
      trade: "Electrical",
      dailyRate: 1050,
      state: "Haryana",
      city: "Gurugram",
    });
    createdLabourIds.push(labour.id);
    if (labour.userId) createdUserIds.push(labour.userId);

    // Platform Admin rejects
    const rejected = await labourService.rejectLabour(
      labour.id,
      { id: "admin-uuid-2", firstName: "Security", lastName: "Officer" },
      {
        rejectionReason: "Aadhaar document blurred and failed phone verification check",
      }
    );

    expect(rejected.status).toBe(LabourStatus.REJECTED);
    expect(rejected.isAvailable).toBe(false);
    expect(rejected.isKycVerified).toBe(false);

    const kycDoc = await prisma.labourKycDocument.findUnique({
      where: { labourId: labour.id },
    });
    expect(kycDoc?.status).toBe("REJECTED");
    expect(kycDoc?.rejectionReason).toContain("blurred");

    if (labour.userId) {
      const user = await prisma.user.findUnique({
        where: { id: labour.userId },
      });
      expect(user?.status).toBe(UserStatus.SUSPENDED);
    }
  }, 15000);

  // =========================================================================
  // 5. Work Lifecycle Transitions (AVAILABLE -> AT_WORK -> UNAVAILABLE)
  // =========================================================================
  it("should correctly transition labour status through operational work phases", async () => {
    const phone = `94${Math.floor(10000000 + Math.random() * 90000000)}`;

    const labour = await labourService.registerPublicLabour({
      name: "Gopal Verma",
      phone,
      password: "Password123!",
      trade: "Painting",
      dailyRate: 900,
      state: "Maharashtra",
      city: "Mumbai",
    });
    createdLabourIds.push(labour.id);
    if (labour.userId) createdUserIds.push(labour.userId);

    // 1. Approve
    await labourService.approveLabour(labour.id, { id: "admin", firstName: "Admin" });

    // 2. Set to AT_WORK
    const atWork = await labourService.updateLabourStatus(labour.id, LabourStatus.AT_WORK);
    expect(atWork.status).toBe(LabourStatus.AT_WORK);
    expect(atWork.isAvailable).toBe(false);

    // 3. Set to UNAVAILABLE
    const unavail = await labourService.updateLabourStatus(labour.id, LabourStatus.UNAVAILABLE);
    expect(unavail.status).toBe(LabourStatus.UNAVAILABLE);
    expect(unavail.isAvailable).toBe(false);

    // 4. Return to AVAILABLE
    const avail = await labourService.updateLabourStatus(labour.id, LabourStatus.AVAILABLE);
    expect(avail.status).toBe(LabourStatus.AVAILABLE);
    expect(avail.isAvailable).toBe(true);
  }, 15000);
});
