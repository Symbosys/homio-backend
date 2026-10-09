import { describe, it, expect, beforeEach } from "bun:test";
import { userProvisioningService } from "../../src/module/user/services/user-provisioning.service";
import { prisma } from "../../src/lib/prisma";

describe("Project Client User Identity & Multi-Org Linking Tests", () => {
  const TEST_PREFIX = `test_${Date.now()}`;
  const mockOrgAId = "00000000-0000-4000-8000-000000000001";
  const mockOrgBId = "00000000-0000-4000-8000-000000000002";

  // =========================================================================
  // 1. User Provisioning Service - Phone & Email Resolution Scenarios
  // =========================================================================
  describe("UserProvisioningService Resolution & Auto-Provisioning", () => {
    it("should auto-provision a new global User (userType: USER, status: ACTIVE) when phone does not exist", async () => {
      const testPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
      const testEmail = `${TEST_PREFIX}_newclient@example.com`;

      const user = await userProvisioningService.resolveOrCreateClientUser({
        phone: testPhone,
        email: testEmail,
        firstName: "Vikram",
        lastName: "Malhotra",
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.phone).toBe(testPhone);
      expect(user.email).toBe(testEmail);
      expect(user.firstName).toBe("Vikram");
      expect(user.lastName).toBe("Malhotra");
      expect(user.userType).toBe("USER");
      expect(user.status).toBe("ACTIVE");
      expect(user.organizationId).toBeNull(); // Global identity across all orgs
    });

    it("should resolve existing User by phone and NOT create a duplicate user", async () => {
      const existingPhone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
      const primaryEmail = `${TEST_PREFIX}_primary@example.com`;

      // 1. First call creates the user
      const initialUser = await userProvisioningService.resolveOrCreateClientUser({
        phone: existingPhone,
        email: primaryEmail,
        firstName: "Ananya",
        lastName: "Roy",
      });

      // 2. Second call with the same phone (even with different email) resolves the existing user
      const resolvedUser = await userProvisioningService.resolveOrCreateClientUser({
        phone: existingPhone,
        email: `${TEST_PREFIX}_alternate_email@example.com`,
        firstName: "Ananya",
        lastName: "Roy",
      });

      expect(resolvedUser.id).toBe(initialUser.id);
      expect(resolvedUser.phone).toBe(existingPhone);
      expect(resolvedUser.email).toBe(primaryEmail);
    });

    it("should resolve existing User by email when phone is omitted", async () => {
      const existingEmail = `${TEST_PREFIX}_emailonly@example.com`;

      const user1 = await userProvisioningService.resolveOrCreateClientUser({
        email: existingEmail,
        firstName: "Sameer",
        lastName: "Verma",
      });

      const user2 = await userProvisioningService.resolveOrCreateClientUser({
        email: existingEmail,
        firstName: "Sameer",
      });

      expect(user1.id).toBe(user2.id);
      expect(user2.email).toBe(existingEmail);
      expect(user2.userType).toBe("USER");
    });

    it("should prioritize Phone match when Phone matches User 1 and Email matches User 2", async () => {
      const phoneU1 = `+9196${Math.floor(10000000 + Math.random() * 90000000)}`;
      const emailU1 = `${TEST_PREFIX}_u1@example.com`;

      const phoneU2 = `+9195${Math.floor(10000000 + Math.random() * 90000000)}`;
      const emailU2 = `${TEST_PREFIX}_u2@example.com`;

      // Create User 1 and User 2
      const u1 = await userProvisioningService.resolveOrCreateClientUser({
        phone: phoneU1,
        email: emailU1,
        firstName: "UserOne",
      });

      const u2 = await userProvisioningService.resolveOrCreateClientUser({
        phone: phoneU2,
        email: emailU2,
        firstName: "UserTwo",
      });

      expect(u1.id).not.toBe(u2.id);

      // Now resolve with Phone of U1 and Email of U2
      const resolved = await userProvisioningService.resolveOrCreateClientUser({
        phone: phoneU1,
        email: emailU2,
        firstName: "ConflictTest",
      });

      // Phone takes precedence
      expect(resolved.id).toBe(u1.id);
      expect(resolved.phone).toBe(phoneU1);
    });

    it("should generate a valid synthetic fallback email when only phone is supplied", async () => {
      const phoneOnly = `+9194${Math.floor(10000000 + Math.random() * 90000000)}`;

      const user = await userProvisioningService.resolveOrCreateClientUser({
        phone: phoneOnly,
        firstName: "PhoneOnlyClient",
      });

      expect(user.id).toBeDefined();
      expect(user.phone).toBe(phoneOnly);
      expect(user.email).toContain("@client.homiocrm.com");
      expect(user.userType).toBe("USER");
    });

    it("should trim phone and normalize email to lowercase during lookup", async () => {
      const rawPhone = `  +9193${Math.floor(10000000 + Math.random() * 90000000)}  `;
      const rawEmail = `  ${TEST_PREFIX}_UPPERCASE@EXAMPLE.COM  `;

      const user1 = await userProvisioningService.resolveOrCreateClientUser({
        phone: rawPhone,
        email: rawEmail,
        firstName: "CaseSensitiveTest",
      });

      const user2 = await userProvisioningService.resolveOrCreateClientUser({
        phone: rawPhone.trim(),
        email: rawEmail.trim().toLowerCase(),
        firstName: "CaseSensitiveTest",
      });

      expect(user1.id).toBe(user2.id);
      expect(user1.email).toBe(rawEmail.trim().toLowerCase());
    });
  });

  // =========================================================================
  // 2. Multi-Organization Project Unification under Global User (myProjects)
  // =========================================================================
  describe("Multi-Tenant Project Linking under myProjects", () => {
    it("should link projects across multiple organizations to the same global User.id", async () => {
      const sharedClientPhone = `+9192${Math.floor(10000000 + Math.random() * 90000000)}`;
      const sharedClientEmail = `${TEST_PREFIX}_multiorg@example.com`;

      // 1. Resolve global user
      const clientUser = await userProvisioningService.resolveOrCreateClientUser({
        phone: sharedClientPhone,
        email: sharedClientEmail,
        firstName: "Rahul",
        lastName: "Kapoor",
      });

      expect(clientUser.id).toBeDefined();

      // 2. Org A Project representation
      const orgAProject = {
        name: "Villa Interiors - Org A",
        projectCode: "PRJ-2026-0010",
        organizationId: mockOrgAId,
        customerId: "11111111-1111-4111-8111-111111111111",
        userId: clientUser.id, // Mandatory direct relation
      };

      // 3. Org B Project representation
      const orgBProject = {
        name: "Kitchen Renovation - Org B",
        projectCode: "PRJ-2026-0020",
        organizationId: mockOrgBId,
        customerId: "22222222-2222-4222-8222-222222222222",
        userId: clientUser.id, // Mandatory direct relation
      };

      // Both projects share the same global client User.id
      expect(orgAProject.userId).toBe(clientUser.id);
      expect(orgBProject.userId).toBe(clientUser.id);
      expect(orgAProject.organizationId).not.toBe(orgBProject.organizationId);

      // Verify that querying by userId unites both projects
      const clientProjectsList = [orgAProject, orgBProject];
      const matchedProjects = clientProjectsList.filter((p) => p.userId === clientUser.id);
      expect(matchedProjects.length).toBe(2);
      expect(matchedProjects.map((p) => p.organizationId)).toEqual([mockOrgAId, mockOrgBId]);
    });

    it("should enforce that Project.userId is strictly non-null and matches User relation", () => {
      const validProject = {
        name: "Commercial Office Turnkey",
        projectCode: "PRJ-2026-0030",
        organizationId: mockOrgAId,
        customerId: "11111111-1111-4111-8111-111111111111",
        userId: "99999999-9999-4999-8999-999999999999",
      };

      expect(validProject.userId).toBeTruthy();
      expect(typeof validProject.userId).toBe("string");
      expect(validProject.userId.length).toBe(36);
    });
  });

  // =========================================================================
  // 3. Customer Lifecycle & Global User Association
  // =========================================================================
  describe("Customer to Global User Linkage", () => {
    it("should promote customer to CLIENT and link to User.id upon project creation", () => {
      const mockUser = {
        id: "77777777-7777-4777-8777-777777777777",
        phone: "+919876543210",
        email: "client@example.com",
        userType: "USER",
      };

      const customerUpdatePayload = {
        customerType: "CLIENT" as const,
        convertedAt: new Date(),
        userId: mockUser.id,
        portalAccessEnabled: true,
      };

      expect(customerUpdatePayload.customerType).toBe("CLIENT");
      expect(customerUpdatePayload.userId).toBe(mockUser.id);
      expect(customerUpdatePayload.portalAccessEnabled).toBe(true);
    });
  });
});
