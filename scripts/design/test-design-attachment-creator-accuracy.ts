/**
 * Comprehensive Design Attachment Creator & Employee Tracking Verification Suite
 * 
 * Verifies that:
 * 1. Design Version Attachments are correctly linked to Employee (`createdById` foreign key and `createdBy` relation).
 * 2. Organization tenant scoping is strictly enforced (cross-tenant employee assignment is rejected).
 * 3. Repository methods (`createAttachment`, `findAttachments`, `findAttachmentById`, `updateAttachment`, `findDesignById`) populate `createdBy` metadata.
 * 4. Symmetrical editability works cleanly (re-assigning creator employee and un-assigning creator).
 * 5. Employee design file count and DAM productivity tracking can query attachments directly via `employee.createdDesignAttachments` or raw counts with 100% precision.
 * 
 * Execution:
 *   bun run scripts/design/test-design-attachment-creator-accuracy.ts
 */

import { prisma } from "../../src/lib/prisma.js";
import { designService } from "../../src/module/projects/services/design.service.js";
import { designRepo } from "../../src/module/projects/repos/design.repo.js";

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

function assertDefined<T>(value: T | null | undefined, testName: string, detail?: string) {
  assertTrue(value !== null && value !== undefined, testName, detail);
}

async function runDesignAttachmentCreatorAccuracySuite() {
  console.log(`\n${colors.bold}${colors.magenta}================================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   DESIGN ATTACHMENT CREATOR & EMPLOYEE TRACKING 100% ACCURACY TEST SUITE${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}================================================================================${colors.reset}\n`);

  const timestamp = Date.now();
  const testOrgSlug = `test-design-org-${timestamp}`;
  const otherOrgSlug = `other-design-org-${timestamp}`;

  let testOrg: any = null;
  let otherOrg: any = null;
  let employee1: any = null;
  let employee2: any = null;
  let otherOrgEmployee: any = null;
  let clientUser: any = null;
  let customer: any = null;
  let project: any = null;
  let folder: any = null;
  let design: any = null;
  let version: any = null;

  try {
    // =========================================================================
    // STEP 1: FIXTURE SETUP (Organizations, Employees, Project, Design, Version)
    // =========================================================================
    console.log(`${colors.bold}${colors.yellow}--- STEP 1: Provisioning Multi-Tenant Fixtures & Designer Employees ---${colors.reset}`);

    testOrg = await prisma.organization.create({
      data: {
        name: `Homio Design Studio ${timestamp}`,
        slug: testOrgSlug,
        email: `studio-${timestamp}@homio.test`,
      },
    });
    console.log(`  Created Test Org: ${colors.cyan}${testOrg.name}${colors.reset} (${testOrg.id})`);

    otherOrg = await prisma.organization.create({
      data: {
        name: `Competitor Studio ${timestamp}`,
        slug: otherOrgSlug,
        email: `competitor-${timestamp}@homio.test`,
      },
    });
    console.log(`  Created Foreign Org: ${colors.cyan}${otherOrg.name}${colors.reset} (${otherOrg.id})`);

    // Create Designer Employee 1 in testOrg
    employee1 = await prisma.employee.create({
      data: {
        organizationId: testOrg.id,
        employeeCode: `EMP-DES-${timestamp}-01`,
        firstName: "Aarav",
        lastName: "Sharma",
        displayName: "Aarav Sharma (3D Lead)",
        workEmail: `aarav.${timestamp}@homio.test`,
        designation: "Senior 3D Visualizer",
        joiningDate: new Date(),
      },
    });
    console.log(`  Created Designer 1: ${colors.cyan}${employee1.displayName}${colors.reset} (${employee1.employeeCode})`);

    // Create Designer Employee 2 in testOrg
    employee2 = await prisma.employee.create({
      data: {
        organizationId: testOrg.id,
        employeeCode: `EMP-DES-${timestamp}-02`,
        firstName: "Priya",
        lastName: "Patel",
        displayName: "Priya Patel (Architect)",
        workEmail: `priya.${timestamp}@homio.test`,
        designation: "Principal Architect",
        joiningDate: new Date(),
      },
    });
    console.log(`  Created Designer 2: ${colors.cyan}${employee2.displayName}${colors.reset} (${employee2.employeeCode})`);

    // Create Employee in Foreign Org for cross-tenant isolation test
    otherOrgEmployee = await prisma.employee.create({
      data: {
        organizationId: otherOrg.id,
        employeeCode: `EMP-FOR-${timestamp}`,
        firstName: "Foreign",
        lastName: "Designer",
        displayName: "Foreign Designer",
        workEmail: `foreign.${timestamp}@homio.test`,
        designation: "External Designer",
        joiningDate: new Date(),
      },
    });
    console.log(`  Created Foreign Employee: ${colors.cyan}${otherOrgEmployee.displayName}${colors.reset}`);

    // Create Client User & Customer
    let clientUser = await prisma.user.create({
      data: {
        email: `client-${timestamp}@homio.test`,
        firstName: "Vikram",
        lastName: "Malhotra",
        phone: `+9198${String(timestamp).slice(-8)}`,
        userType: "USER",
        status: "ACTIVE",
      },
    });

    let customer = await prisma.customer.create({
      data: {
        organizationId: testOrg.id,
        userId: clientUser.id,
        customerCode: `CUST-${timestamp}`,
        firstName: "Vikram",
        lastName: "Malhotra",
        displayName: "Vikram Malhotra",
        phone: clientUser.phone!,
        email: clientUser.email,
        customerType: "CLIENT",
      },
    });

    // Create Test Project
    project = await prisma.project.create({
      data: {
        organizationId: testOrg.id,
        customerId: customer.id,
        userId: clientUser.id,
        projectCode: `PRJ-DES-${timestamp}`,
        name: "Villa Solarium Luxury Interiors",
        status: "EXECUTION",
      },
    });

    // Create Design Folder
    folder = await prisma.projectDesignFolder.create({
      data: {
        organizationId: testOrg.id,
        projectId: project.id,
        folderCode: `FLD-LIV-${timestamp}`,
        name: "Living & Dining 3D Concepts",
        roomType: "LIVING_ROOM",
        stage: "RENDER_3D",
        orderIndex: 0,
      },
    });

    // Create Master Design & Initial Version
    design = await prisma.projectDesign.create({
      data: {
        organizationId: testOrg.id,
        projectId: project.id,
        folderId: folder.id,
        designCode: `DES-LIV-01`,
        title: "Living Room Modern Contemporary Render & False Ceiling CAD",
        designType: "RENDER_3D",
        priority: "HIGH",
        currentVersionNumber: 1,
        status: "DRAFT",
      },
    });

    version = await prisma.designVersion.create({
      data: {
        designId: design.id,
        versionNumber: 1,
        versionCode: "v1.0",
        versionName: "Initial Concept 3D Revision",
        renderingEngine: "Corona 10 / 3ds Max",
        resolution: "3840x2160 (4K UHD)",
        status: "DRAFT",
      },
    });

    console.log(`  Created Project, Folder, Design (${design.id}), and Version (${version.id})\n`);

    // =========================================================================
    // STEP 2: CROSS-TENANT ISOLATION VALIDATION
    // =========================================================================
    console.log(`${colors.bold}${colors.yellow}--- STEP 2: Testing Multi-Tenant Employee Scoping on Attachment Creation ---${colors.reset}`);

    let crossTenantErrorCaught = false;
    try {
      await designService.createAttachment(
        project.id,
        testOrg.id,
        design.id,
        version.id,
        {
          attachmentType: "RENDER_IMAGE",
          title: "Illegal Cross-Tenant Render",
          createdById: otherOrgEmployee.id, // Foreign org employee!
        }
      );
    } catch (err: any) {
      crossTenantErrorCaught = true;
      console.log(`  ${colors.dim}Caught expected tenant mismatch error: ${err.message}${colors.reset}`);
    }
    assertTrue(crossTenantErrorCaught, "Cross-Tenant Employee Assignment Rejection", "Service must reject createdById from foreign organization");

    // =========================================================================
    // STEP 3: ATTACHMENT CREATION & EMPLOYEE RELATION POPULATION
    // =========================================================================
    console.log(`\n${colors.bold}${colors.yellow}--- STEP 3: Creating Attachments with Explicit Creator Attribution ---${colors.reset}`);

    // Attachment 1 by Designer 1 (Aarav)
    const att1 = await designService.createAttachment(
      project.id,
      testOrg.id,
      design.id,
      version.id,
      {
        attachmentType: "RENDER_IMAGE",
        title: "Living Room Day Lighting 4K Render",
        caption: "Corona Sun + Sky 6500K with warm accent lamps",
        createdById: employee1.id,
        isPrimary: true,
        file: {
          id: `att-day-${timestamp}`,
          url: "https://storage.homio.test/designs/living-day.webp",
          bytes: 84000,
          format: "webp",
          provider: "LOCAL",
        },
      }
    );

    assertDefined(att1, "Attachment 1 Created Successfully");
    assertEqual(att1.createdById, employee1.id, "Attachment 1 createdById matches Employee 1");
    assertDefined(att1.createdBy, "Attachment 1 createdBy relation is populated");
    assertEqual(att1.createdBy?.id, employee1.id, "Attachment 1 createdBy.id matches");
    assertEqual(att1.createdBy?.employeeCode, employee1.employeeCode, "Attachment 1 createdBy.employeeCode matches");
    assertEqual(att1.createdBy?.displayName, employee1.displayName, "Attachment 1 createdBy.displayName matches");

    // Attachment 2 by Designer 2 (Priya)
    const att2 = await designService.createAttachment(
      project.id,
      testOrg.id,
      design.id,
      version.id,
      {
        attachmentType: "TECHNICAL_DRAWING_PDF",
        title: "False Ceiling & Electrical Conduit GFC Drawing",
        caption: "Good for construction working layout with dimmer switch circuits",
        createdById: employee2.id,
        isPrimary: false,
        file: {
          id: `att-cad-${timestamp}`,
          url: "https://storage.homio.test/designs/living-cad.pdf",
          bytes: 92000,
          format: "pdf",
          provider: "LOCAL",
        },
      }
    );

    assertDefined(att2, "Attachment 2 Created Successfully");
    assertEqual(att2.createdById, employee2.id, "Attachment 2 createdById matches Employee 2");
    assertEqual(att2.createdBy?.employeeCode, employee2.employeeCode, "Attachment 2 createdBy.employeeCode matches");
    assertEqual(att2.createdBy?.displayName, employee2.displayName, "Attachment 2 createdBy.displayName matches");

    // Attachment 3 with no creator specified (unassigned/external client upload)
    const att3 = await designService.createAttachment(
      project.id,
      testOrg.id,
      design.id,
      version.id,
      {
        attachmentType: "EXTERNAL_DRIVE_LINK",
        title: "Client Reference Moodboard Pinterest Link",
        externalUrl: "https://pinterest.com/pin/sample-interior",
        createdById: null,
      }
    );

    assertDefined(att3, "Attachment 3 Created Successfully");
    assertEqual(att3.createdById, null, "Attachment 3 createdById is null");
    assertEqual(att3.createdBy, null, "Attachment 3 createdBy relation is null");

    // =========================================================================
    // STEP 4: REPOSITORY & AGGREGATED RETRIEVAL ACCURACY
    // =========================================================================
    console.log(`\n${colors.bold}${colors.yellow}--- STEP 4: Testing Repository Queries & Relational Population ---${colors.reset}`);

    // Query all attachments in the version
    const attachmentsList = await designRepo.findAttachments(version.id);
    assertEqual(attachmentsList.length, 3, "findAttachments returns all 3 attachments");

    const foundAtt1 = attachmentsList.find((a) => a.id === att1.id);
    assertDefined(foundAtt1, "Attachment 1 found in version list");
    assertEqual(foundAtt1?.createdBy?.displayName, employee1.displayName, "findAttachments populates Employee 1 details");

    const foundAtt2 = attachmentsList.find((a) => a.id === att2.id);
    assertDefined(foundAtt2, "Attachment 2 found in version list");
    assertEqual(foundAtt2?.createdBy?.displayName, employee2.displayName, "findAttachments populates Employee 2 details");

    // Query single attachment by ID
    const singleAtt = await designRepo.findAttachmentById(version.id, att1.id);
    assertDefined(singleAtt, "findAttachmentById returns attachment");
    assertEqual(singleAtt?.createdBy?.employeeCode, employee1.employeeCode, "findAttachmentById populates createdBy");

    // Query Master Design by ID (deep nested relation test)
    const masterDesign = await designRepo.findDesignById(testOrg.id, project.id, design.id);
    assertDefined(masterDesign, "findDesignById returns full design");
    const nestedVersion = masterDesign?.versions?.find((v) => v.id === version.id);
    assertDefined(nestedVersion, "Nested version found in design");
    assertEqual(nestedVersion?.attachments?.length, 3, "Nested version contains 3 attachments");
    const nestedAtt1 = nestedVersion?.attachments?.find((a) => a.id === att1.id);
    assertEqual(nestedAtt1?.createdBy?.displayName, employee1.displayName, "Nested design query populates attachment creator");

    // =========================================================================
    // STEP 5: SYMMETRICAL EDITABILITY & RE-ASSIGNMENT
    // =========================================================================
    console.log(`\n${colors.bold}${colors.yellow}--- STEP 5: Testing Symmetrical Editability (Re-assignment & Clearing) ---${colors.reset}`);

    // Re-assign Attachment 1 from Employee 1 to Employee 2
    const reassignedAtt1 = await designService.updateAttachment(
      project.id,
      testOrg.id,
      design.id,
      version.id,
      att1.id,
      {
        createdById: employee2.id,
        title: "Living Room Day Lighting 4K Render (Revised by Priya)",
      }
    );

    assertEqual(reassignedAtt1.createdById, employee2.id, "Attachment 1 successfully re-assigned to Employee 2");
    assertEqual(reassignedAtt1.createdBy?.employeeCode, employee2.employeeCode, "Attachment 1 createdBy reflects Employee 2 code");
    assertEqual(reassignedAtt1.title, "Living Room Day Lighting 4K Render (Revised by Priya)", "Title updated simultaneously");

    // Clear creator on Attachment 2 (set to null)
    const clearedAtt2 = await designService.updateAttachment(
      project.id,
      testOrg.id,
      design.id,
      version.id,
      att2.id,
      {
        createdById: null,
      }
    );

    assertEqual(clearedAtt2.createdById, null, "Attachment 2 creator cleared (set to null)");
    assertEqual(clearedAtt2.createdBy, null, "Attachment 2 createdBy relation cleared to null");

    // =========================================================================
    // STEP 6: EMPLOYEE ATTACHMENT AGGREGATION & REPORTING ACCURACY
    // =========================================================================
    console.log(`\n${colors.bold}${colors.yellow}--- STEP 6: Validating Employee Productivity & File Count Attribution ---${colors.reset}`);

    // Currently:
    // - Attachment 1 is assigned to Employee 2
    // - Attachment 2 is unassigned (null)
    // - Attachment 3 is unassigned (null)

    // Let's add 2 more attachments directly for Employee 1 (Aarav) to test multi-file counts
    await designService.createAttachment(
      project.id,
      testOrg.id,
      design.id,
      version.id,
      {
        attachmentType: "THREED_MODEL_FILE",
        title: "Living Room 3D GLB Model Asset",
        createdById: employee1.id,
      }
    );

    await designService.createAttachment(
      project.id,
      testOrg.id,
      design.id,
      version.id,
      {
        attachmentType: "RENDER_IMAGE",
        title: "Living Room Evening Sunset Lighting Render",
        createdById: employee1.id,
      }
    );

    // Count attachments for Employee 1 (Aarav)
    const emp1FileCount = await prisma.designVersionAttachment.count({
      where: {
        createdById: employee1.id,
      },
    });
    assertEqual(emp1FileCount, 2, "Employee 1 (Aarav) has exactly 2 design files attributed");

    // Count attachments for Employee 2 (Priya)
    const emp2FileCount = await prisma.designVersionAttachment.count({
      where: {
        createdById: employee2.id,
      },
    });
    assertEqual(emp2FileCount, 1, "Employee 2 (Priya) has exactly 1 design file attributed");

    // Count unassigned attachments
    const unassignedCount = await prisma.designVersionAttachment.count({
      where: {
        designVersion: {
          design: {
            organizationId: testOrg.id,
          },
        },
        createdById: null,
      },
    });
    assertEqual(unassignedCount, 2, "Organization has exactly 2 unassigned design files");

    // Test Prisma reverse navigation from Employee model: employee.createdDesignAttachments
    const employeeWithAttachments = await prisma.employee.findUnique({
      where: { id: employee1.id },
      include: {
        createdDesignAttachments: {
          select: {
            id: true,
            title: true,
            attachmentType: true,
          },
        },
      },
    });

    assertDefined(employeeWithAttachments, "Employee 1 found via Prisma reverse relation");
    assertEqual(
      employeeWithAttachments?.createdDesignAttachments.length,
      2,
      "employee.createdDesignAttachments reverse navigation returns exactly 2 items"
    );

    console.log(`\n${colors.bold}${colors.green}✔ ALL STEPS COMPLETED WITH 100% PRECISION!${colors.reset}`);
  } catch (error: any) {
    console.error(`\n${colors.bold}${colors.red}FATAL ERROR IN SUITE: ${error?.message}${colors.reset}`);
    console.error(error);
    failedAssertions++;
  } finally {
    // =========================================================================
    // STEP 7: CLEANUP FIXTURES
    // =========================================================================
    console.log(`\n${colors.bold}${colors.yellow}--- CLEANUP: Removing Test Data ---${colors.reset}`);
    try {
      if (design) {
        await prisma.designVersionAttachment.deleteMany({
          where: { designVersion: { designId: design.id } },
        });
        await prisma.designVersion.deleteMany({
          where: { designId: design.id },
        });
        await prisma.projectDesign.deleteMany({
          where: { id: design.id },
        });
      }
      if (folder) {
        await prisma.projectDesignFolder.deleteMany({
          where: { id: folder.id },
        });
      }
      if (project) {
        await prisma.project.deleteMany({
          where: { id: project.id },
        });
      }
      if (customer) {
        await prisma.customer.deleteMany({
          where: { id: customer.id },
        });
      }
      if (clientUser) {
        await prisma.user.deleteMany({
          where: { id: clientUser.id },
        });
      }
      if (employee1) {
        await prisma.employee.deleteMany({
          where: { id: employee1.id },
        });
      }
      if (employee2) {
        await prisma.employee.deleteMany({
          where: { id: employee2.id },
        });
      }
      if (otherOrgEmployee) {
        await prisma.employee.deleteMany({
          where: { id: otherOrgEmployee.id },
        });
      }
      if (testOrg) {
        await prisma.organization.deleteMany({
          where: { id: testOrg.id },
        });
      }
      if (otherOrg) {
        await prisma.organization.deleteMany({
          where: { id: otherOrg.id },
        });
      }
      console.log(`  ${colors.green}✔ Test database fixtures cleaned up successfully.${colors.reset}\n`);
    } catch (cleanupErr: any) {
      console.error(`  ${colors.red}Warning: Cleanup failed: ${cleanupErr.message}${colors.reset}`);
    }
  }

  // Final Summary Report
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}`);
  console.log(`${colors.bold}SUMMARY REPORT: ${passedAssertions}/${totalAssertions} Assertions Passed${colors.reset}`);
  if (failedAssertions === 0) {
    console.log(`${colors.bold}${colors.green}STATUS: 100% PRODUCTION READY & VERIFIED! 🎉${colors.reset}`);
  } else {
    console.log(`${colors.bold}${colors.red}STATUS: ${failedAssertions} ASSERTIONS FAILED.${colors.reset}`);
    process.exit(1);
  }
  console.log(`${colors.bold}${colors.cyan}================================================================================${colors.reset}\n`);
}

runDesignAttachmentCreatorAccuracySuite().catch((err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});
