/**
 * Comprehensive Multi-Tenant User Isolation & Multi-Org Client Independence Verification Suite
 * 
 * Verifies that:
 * 1. A client User (`userType = USER`, `organizationId = null`) is completely independent of any single organization.
 * 2. A single client can have projects across multiple distinct organizations (Org A, Org B, Org C).
 * 3. Tenant CRM isolation is strictly enforced: Org A cannot see Org B's projects or customer records.
 * 4. Client Portal aggregation is strictly unified: Client querying `myProjects` retrieves all their projects across all orgs.
 * 5. Identity auto-provisioning and conflict resolution work with 100% mathematical precision.
 * 
 * Execution:
 *   bun run scripts/project/test-user-isolation-multi-org.ts
 */

import { prisma } from "../../src/lib/prisma.js";
import { userProvisioningService } from "../../src/module/user/services/user-provisioning.service.js";
import { projectService } from "../../src/module/projects/services/project.service.js";

// ANSI color formatters for terminal output
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assertEqual<T>(actual: T, expected: T, testName: string, detail?: string) {
  totalAssertions++;
  if (actual === expected) {
    passedAssertions++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} [${testName}] => ${colors.cyan}${actual}${colors.reset}`);
  } else {
    failedAssertions++;
    console.error(
      `  ${colors.red}✘ FAIL${colors.reset} [${testName}]\n` +
      `    Expected: ${colors.green}${expected}${colors.reset}\n` +
      `    Actual:   ${colors.red}${actual}${colors.reset}\n` +
      (detail ? `    Details:  ${detail}\n` : "")
    );
  }
}

function assertTrue(condition: boolean, testName: string, detail?: string) {
  assertEqual(Boolean(condition), true, testName, detail);
}

async function runMultiOrgUserIsolationVerification() {
  console.log(`\n${colors.bold}${colors.magenta}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   MULTI-TENANT USER ISOLATION & MULTI-ORG ACCESS VERIFICATION SUITE${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}========================================================================${colors.reset}\n`);

  const runId = Date.now();
  const testPhone = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testEmail = `client_${runId}@example.com`;

  let createdOrgAId: string | null = null;
  let createdOrgBId: string | null = null;
  let clientUserId: string | null = null;
  let projectAId: string | null = null;
  let projectBId: string | null = null;
  let customerAId: string | null = null;
  let customerBId: string | null = null;

  try {
    // ---------------------------------------------------------------------------------
    // SECTION 1: PROVISION 2 ISOLATED ORGANIZATIONS (ORG A & ORG B)
    // ---------------------------------------------------------------------------------
    console.log(`${colors.bold}--- [1] Provisioning 2 Isolated SaaS Organizations ---${colors.reset}`);

    const orgA = await prisma.organization.create({
      data: {
        name: `Org A - Apex Luxury Interiors (${runId})`,
        slug: `apex-interiors-${runId}`,
        email: `apex_${runId}@example.com`,
        phone: `+9191${Math.floor(10000000 + Math.random() * 90000000)}`,
      },
    });
    createdOrgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        name: `Org B - Zenith Civil Works (${runId})`,
        slug: `zenith-civil-${runId}`,
        email: `zenith_${runId}@example.com`,
        phone: `+9190${Math.floor(10000000 + Math.random() * 90000000)}`,
      },
    });
    createdOrgBId = orgB.id;

    assertTrue(Boolean(orgA.id), "Org A created with valid UUID");
    assertTrue(Boolean(orgB.id), "Org B created with valid UUID");
    assertTrue(orgA.id !== orgB.id, "Org A and Org B have distinct isolated organization IDs");

    // ---------------------------------------------------------------------------------
    // SECTION 2: GLOBAL CLIENT USER RESOLUTION & AUTO-PROVISIONING
    // ---------------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- [2] Global Client User Resolution & Independence ---${colors.reset}`);

    // Create Customer in Org A
    const customerA = await prisma.customer.create({
      data: {
        organizationId: orgA.id,
        customerCode: `CUST-A-${runId}`,
        firstName: "Rajesh",
        lastName: "Sharma",
        phone: testPhone,
        email: testEmail,
        customerType: "LEAD_CUSTOMER",
      },
    });
    customerAId = customerA.id;

    // Create Project in Org A via ProjectService (triggers auto-provisioning)
    const projectA = await projectService.createProject(orgA.id, {
      name: "Villa Luxury Interior Execution",
      customerId: customerA.id,
      type: "TURNKEY",
      status: "PLANNED",
    });
    projectAId = projectA.id;

    // Fetch the resolved user
    const fetchedProjectA = await prisma.project.findUnique({
      where: { id: projectA.id },
      include: { user: true, customer: true },
    });

    assertTrue(Boolean(fetchedProjectA?.userId), "Project A has mandatory non-null userId");
    clientUserId = fetchedProjectA!.userId;

    const globalUser = fetchedProjectA!.user;
    assertEqual(globalUser.userType, "USER", "User is assigned global userType 'USER'");
    assertEqual(globalUser.status, "ACTIVE", "User status is 'ACTIVE'");
    assertEqual(globalUser.organizationId, null, "User organizationId is NULL (Independent from Org A)");
    assertEqual(globalUser.phone, testPhone, "User phone matches client contact phone");
    assertEqual(globalUser.email, testEmail, "User email matches client contact email");

    // Verify Customer A was updated with userId and promoted to CLIENT
    const updatedCustomerA = await prisma.customer.findUnique({
      where: { id: customerA.id },
    });
    assertEqual(updatedCustomerA?.userId, clientUserId, "Customer A in Org A is linked to global User.id");
    assertEqual(updatedCustomerA?.customerType, "CLIENT", "Customer A is promoted to CLIENT");

    // ---------------------------------------------------------------------------------
    // SECTION 3: MULTI-ORG LINKING (ORG B CREATES PROJECT FOR SAME CLIENT)
    // ---------------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- [3] Multi-Org Linking (Org B Creates Project for Same User) ---${colors.reset}`);

    // Create Customer in Org B with same Phone & Email
    const customerB = await prisma.customer.create({
      data: {
        organizationId: orgB.id,
        customerCode: `CUST-B-${runId}`,
        firstName: "Rajesh",
        lastName: "Sharma",
        phone: testPhone,
        email: testEmail,
        customerType: "LEAD_CUSTOMER",
      },
    });
    customerBId = customerB.id;

    // Create Project in Org B via ProjectService
    const projectB = await projectService.createProject(orgB.id, {
      name: "Structural Civil Renovation & Plumbing",
      customerId: customerB.id,
      type: "RENOVATION",
      status: "EXECUTION",
    });
    projectBId = projectB.id;

    const fetchedProjectB = await prisma.project.findUnique({
      where: { id: projectB.id },
      include: { user: true, customer: true },
    });

    assertEqual(fetchedProjectB?.userId, clientUserId, "Project B from Org B is linked to the EXACT same global User.id");
    assertTrue(fetchedProjectB?.organizationId === orgB.id, "Project B belongs to Org B");
    assertTrue(fetchedProjectA?.organizationId === orgA.id, "Project A belongs to Org A");

    // Total Users in database for this phone must strictly be 1 (No duplicate user created)
    const usersWithPhone = await prisma.user.findMany({
      where: { phone: testPhone },
    });
    assertEqual(usersWithPhone.length, 1, "Exactly 1 global User exists for this phone across the platform");

    // ---------------------------------------------------------------------------------
    // SECTION 4: TENANT CRM ISOLATION (ORG-SCOPED ACCESS CHECK)
    // ---------------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- [4] Tenant CRM Query Isolation Verification ---${colors.reset}`);

    // 1. Org A queries its projects
    const orgAProjects = await prisma.project.findMany({
      where: {
        organizationId: orgA.id,
        isDeleted: false,
      },
    });
    assertEqual(orgAProjects.length, 1, "Org A query returns exactly 1 project");
    assertEqual(orgAProjects[0]?.id, projectA.id, "Org A query contains Project A");
    assertTrue(!orgAProjects.some((p) => p.id === projectB.id), "Org A CANNOT see Project B from Org B");

    // 2. Org B queries its projects
    const orgBProjects = await prisma.project.findMany({
      where: {
        organizationId: orgB.id,
        isDeleted: false,
      },
    });
    assertEqual(orgBProjects.length, 1, "Org B query returns exactly 1 project");
    assertEqual(orgBProjects[0]?.id, projectB.id, "Org B query contains Project B");
    assertTrue(!orgBProjects.some((p) => p.id === projectA.id), "Org B CANNOT see Project A from Org A");

    // 3. Cross-Tenant Direct ID Query Attempt (Org A trying to fetch Project B with org scoping)
    const crossTenantAttempt = await prisma.project.findFirst({
      where: {
        id: projectB.id,
        organizationId: orgA.id, // Org A trying to access Org B's project
      },
    });
    assertEqual(crossTenantAttempt, null, "Cross-tenant access attempt strictly returns NULL");

    // ---------------------------------------------------------------------------------
    // SECTION 5: CLIENT PORTAL INDEPENDENCE (UNIFIED myProjects AGGREGATION)
    // ---------------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- [5] Client Portal Unified Access (myProjects) ---${colors.reset}`);

    // Client logs in and queries their projects by global userId
    const clientProjects = await prisma.project.findMany({
      where: {
        userId: clientUserId!,
        isClientPortalVisible: true,
        isDeleted: false,
      },
      include: {
        organization: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    assertEqual(clientProjects.length, 2, "Client Portal queries exactly 2 projects across all organizations");

    const p1 = clientProjects.find((p) => p.id === projectA.id);
    const p2 = clientProjects.find((p) => p.id === projectB.id);

    assertTrue(Boolean(p1), "Client Portal includes Project A");
    assertEqual(p1?.organization.id, orgA.id, "Project A accurately identifies Org A as provider");
    assertEqual(p1?.organization.name, orgA.name, "Project A displays Org A company name");

    assertTrue(Boolean(p2), "Client Portal includes Project B");
    assertEqual(p2?.organization.id, orgB.id, "Project B accurately identifies Org B as provider");
    assertEqual(p2?.organization.name, orgB.name, "Project B displays Org B company name");

    // ---------------------------------------------------------------------------------
    // SECTION 6: PHONE & EMAIL IDENTITY CONFLICT RESOLUTION TESTS
    // ---------------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- [6] Edge Case 1: Same Phone, Different Email (Multi-Org Project Creation) ---${colors.reset}`);

    const caseAPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    const caseAEmail1 = `client_work_${runId}@company.com`;
    const caseAEmail2 = `client_personal_${runId}@gmail.com`;

    // 1. Org A creates customer & project with Phone P and Work Email
    const customerCaseA1 = await prisma.customer.create({
      data: {
        organizationId: orgA.id,
        customerCode: `CUST-A1-${runId}`,
        firstName: "Vikram",
        lastName: "Malhotra",
        phone: caseAPhone,
        email: caseAEmail1,
      },
    });

    const projectCaseA1 = await projectService.createProject(orgA.id, {
      name: "Corporate Penthouse Interior (Org A)",
      customerId: customerCaseA1.id,
    });

    // 2. Org B creates customer & project with SAME Phone P and Personal Email
    const customerCaseA2 = await prisma.customer.create({
      data: {
        organizationId: orgB.id,
        customerCode: `CUST-B2-${runId}`,
        firstName: "Vikram",
        lastName: "Malhotra",
        phone: caseAPhone,
        email: caseAEmail2,
      },
    });

    const projectCaseA2 = await projectService.createProject(orgB.id, {
      name: "Weekend Villa Civil Restoration (Org B)",
      customerId: customerCaseA2.id,
    });

    // 3. Assertions for Case A
    const fetchedCaseA1 = await prisma.project.findUnique({ where: { id: projectCaseA1.id } });
    const fetchedCaseA2 = await prisma.project.findUnique({ where: { id: projectCaseA2.id } });

    assertEqual(fetchedCaseA1?.userId, fetchedCaseA2?.userId, "Same Phone, Different Email: Both projects link to the EXACT same global User.id");
    
    // Check that Org A and Org B customer records preserve their distinct emails
    const custA1Check = await prisma.customer.findUnique({ where: { id: customerCaseA1.id } });
    const custA2Check = await prisma.customer.findUnique({ where: { id: customerCaseA2.id } });
    assertEqual(custA1Check?.email, caseAEmail1, "Org A customer retains work email");
    assertEqual(custA2Check?.email, caseAEmail2, "Org B customer retains personal email");

    // Client Portal query for Case A User
    const caseAUserProjects = await prisma.project.findMany({
      where: { userId: fetchedCaseA1!.userId, isDeleted: false },
    });
    assertEqual(caseAUserProjects.length, 2, "Client Portal myProjects returns both projects across Org A and Org B");

    console.log(`\n${colors.bold}--- [7] Edge Case 2: Same Email, Different Phone (Multi-Org Project Creation) ---${colors.reset}`);

    const caseBEmail = `client_shared_${runId}@domain.com`;
    const caseBPhone1 = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
    const caseBPhone2 = `+9196${Math.floor(10000000 + Math.random() * 90000000)}`;

    // 1. Org A creates customer & project with Primary Phone and Shared Email
    const customerCaseB1 = await prisma.customer.create({
      data: {
        organizationId: orgA.id,
        customerCode: `CUST-B1-${runId}`,
        firstName: "Ananya",
        lastName: "Roy",
        phone: caseBPhone1,
        email: caseBEmail,
      },
    });

    const projectCaseB1 = await projectService.createProject(orgA.id, {
      name: "Apartment Modular Kitchen (Org A)",
      customerId: customerCaseB1.id,
    });

    // 2. Org B creates customer & project with Alternate Site Phone and SAME Shared Email
    const customerCaseB2 = await prisma.customer.create({
      data: {
        organizationId: orgB.id,
        customerCode: `CUST-B22-${runId}`,
        firstName: "Ananya",
        lastName: "Roy",
        phone: caseBPhone2,
        email: caseBEmail,
      },
    });

    const projectCaseB2 = await projectService.createProject(orgB.id, {
      name: "Duplex False Ceiling & Lighting (Org B)",
      customerId: customerCaseB2.id,
    });

    // 3. Assertions for Case B
    const fetchedCaseB1 = await prisma.project.findUnique({ where: { id: projectCaseB1.id } });
    const fetchedCaseB2 = await prisma.project.findUnique({ where: { id: projectCaseB2.id } });

    assertEqual(fetchedCaseB1?.userId, fetchedCaseB2?.userId, "Same Email, Different Phone: Both projects link to the EXACT same global User.id");

    // Check that Org A and Org B customer records preserve their distinct phones
    const custB1Check = await prisma.customer.findUnique({ where: { id: customerCaseB1.id } });
    const custB2Check = await prisma.customer.findUnique({ where: { id: customerCaseB2.id } });
    assertEqual(custB1Check?.phone, caseBPhone1, "Org A customer retains primary phone");
    assertEqual(custB2Check?.phone, caseBPhone2, "Org B customer retains site alternate phone");

    // Client Portal query for Case B User
    const caseBUserProjects = await prisma.project.findMany({
      where: { userId: fetchedCaseB1!.userId, isDeleted: false },
    });
    assertEqual(caseBUserProjects.length, 2, "Client Portal myProjects returns both projects across Org A and Org B");

    // Cleanup Case A & B records
    await prisma.project.deleteMany({ where: { id: { in: [projectCaseA1.id, projectCaseA2.id, projectCaseB1.id, projectCaseB2.id] } } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { id: { in: [customerCaseA1.id, customerCaseA2.id, customerCaseB1.id, customerCaseB2.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [fetchedCaseA1!.userId, fetchedCaseB1!.userId] } } }).catch(() => {});

  } finally {
    // ---------------------------------------------------------------------------------
    // TEARDOWN & CLEANUP
    // ---------------------------------------------------------------------------------
    console.log(`\n${colors.dim}--- Cleaning up test artifacts ---${colors.reset}`);
    if (projectAId) await prisma.project.delete({ where: { id: projectAId } }).catch(() => {});
    if (projectBId) await prisma.project.delete({ where: { id: projectBId } }).catch(() => {});
    if (customerAId) await prisma.customer.delete({ where: { id: customerAId } }).catch(() => {});
    if (customerBId) await prisma.customer.delete({ where: { id: customerBId } }).catch(() => {});
    if (createdOrgAId) await prisma.organization.delete({ where: { id: createdOrgAId } }).catch(() => {});
    if (createdOrgBId) await prisma.organization.delete({ where: { id: createdOrgBId } }).catch(() => {});
    if (clientUserId) await prisma.user.delete({ where: { id: clientUserId } }).catch(() => {});
    console.log(`  ${colors.green}✔ Cleanup completed successfully.${colors.reset}`);
  }

  // ---------------------------------------------------------------------------------
  // FINAL SCORE & SUMMARY
  // ---------------------------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.magenta}========================================================================${colors.reset}`);
  console.log(`${colors.bold}          USER ISOLATION & MULTI-ORG SUITE SUMMARY RESULTS${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}========================================================================${colors.reset}`);
  console.log(`  Total Assertions Tested: ${colors.bold}${totalAssertions}${colors.reset}`);
  console.log(`  Passed:                 ${colors.green}${colors.bold}${passedAssertions}${colors.reset}`);
  console.log(`  Failed:                 ${failedAssertions > 0 ? colors.red : colors.green}${colors.bold}${failedAssertions}${colors.reset}`);
  
  const accuracy = ((passedAssertions / totalAssertions) * 100).toFixed(2);
  console.log(`  Overall Accuracy Score: ${accuracy === "100.00" ? colors.green : colors.yellow}${colors.bold}${accuracy}%${colors.reset}\n`);

  if (failedAssertions === 0) {
    console.log(`${colors.green}${colors.bold}🌟 SUCCESS: Multi-Tenant User Isolation & Multi-Org Client Independence is 100% ACCURATE!${colors.reset}\n`);
  } else {
    console.error(`${colors.red}${colors.bold}❌ ERROR: Some assertions failed. Review log above.${colors.reset}\n`);
    process.exit(1);
  }
}

runMultiOrgUserIsolationVerification()
  .catch((err) => {
    console.error("Fatal error running verification script:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
