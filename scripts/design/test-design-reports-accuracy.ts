/**
 * Design Reports & Analytics API 100% Accuracy & Ground-Truth Verification Suite
 *
 * Verifies that:
 * 1. "Files" strictly represents `DesignVersionAttachment` records.
 * 2. `NO. OF FILES MADE` matches total design version attachments created.
 * 3. `FILE DONE` accurately calculates approved design attachments.
 * 4. `SENT FOR EXECUTION` accurately calculates GFC/As-Built locked attachments.
 * 5. `TOTAL FILES PENDING` accurately captures drafts & in-review files.
 * 6. `FILES REJECTED` accurately captures change-requested/rejected files.
 * 7. Asset types distribution (3D Renders, CAD DWG, Technical PDF, Specs, Models) matches DB counts with 100% precision.
 * 8. Designer/Architect productivity matrix attributes every file to its creator employee with correct counts & percentages.
 * 9. Project filter correctly isolates project-specific deliverables.
 * 10. Employee filter correctly isolates employee-specific deliverables.
 * 11. Multi-tenant isolation is strictly preserved (0 leakage from other organizations).
 *
 * Execution:
 *   bun run scripts/design/test-design-reports-accuracy.ts
 */

import { prisma } from "../../src/lib/prisma.js";
import { designReportService } from "../../src/module/reports/services/design-report.service.js";

// ANSI color formatters for terminal output
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assertEqual<T>(
  actual: T,
  expected: T,
  testName: string,
  detail?: string,
) {
  totalAssertions++;
  if (actual === expected) {
    passedAssertions++;
    console.log(
      `  ${colors.green}✔ PASS${colors.reset} [${testName}] => ${colors.cyan}${actual}${colors.reset}`,
    );
  } else {
    failedAssertions++;
    console.error(
      `  ${colors.red}✘ FAIL${colors.reset} [${testName}]\n` +
        `    Expected: ${colors.green}${expected}${colors.reset}\n` +
        `    Actual:   ${colors.red}${actual}${colors.reset}\n` +
        (detail ? `    Details:  ${detail}\n` : ""),
    );
  }
}

function assertTrue(condition: boolean, testName: string, detail?: string) {
  assertEqual(Boolean(condition), true, testName, detail);
}

async function runDesignReportsAccuracySuite() {
  console.log(
    `\n${colors.bold}${colors.magenta}================================================================================${colors.reset}`,
  );
  console.log(
    `${colors.bold}${colors.cyan}     DESIGN REPORTS & DAM ANALYTICS 100% GROUND-TRUTH ACCURACY TEST SUITE       ${colors.reset}`,
  );
  console.log(
    `${colors.bold}${colors.magenta}================================================================================${colors.reset}\n`,
  );

  const timestamp = Date.now();
  const testOrgSlug = `test-report-org-${timestamp}`;
  const otherOrgSlug = `other-report-org-${timestamp}`;

  let testOrg: any = null;
  let otherOrg: any = null;
  let designerA: any = null;
  let designerB: any = null;
  let otherOrgDesigner: any = null;
  let clientUser: any = null;
  let customer: any = null;
  let otherOrgUser: any = null;
  let otherOrgCustomer: any = null;
  let project1: any = null;
  let project2: any = null;
  let otherOrgProject: any = null;

  try {
    // =========================================================================
    // STEP 1: FIXTURE SETUP
    // =========================================================================
    console.log(
      `${colors.bold}${colors.yellow}--- STEP 1: Provisioning Organizations, Projects, & Designers ---${colors.reset}`,
    );

    testOrg = await prisma.organization.create({
      data: {
        name: `Homio Design Studio ${timestamp}`,
        slug: testOrgSlug,
        email: `studio-${timestamp}@homio.test`,
      },
    });

    otherOrg = await prisma.organization.create({
      data: {
        name: `Foreign Studio ${timestamp}`,
        slug: otherOrgSlug,
        email: `foreign-${timestamp}@homio.test`,
      },
    });

    // Create 2 Designers in testOrg
    designerA = await prisma.employee.create({
      data: {
        organizationId: testOrg.id,
        employeeCode: `EMP-DES-A-${timestamp.toString().slice(-4)}`,
        firstName: "Aarav",
        lastName: "Sharma",
        displayName: "Aarav (Senior 3D Visualizer)",
        designation: "Senior 3D Visualizer",
        workEmail: `aarav-${timestamp}@homio.test`,
        workPhone: `+9198${timestamp.toString().slice(-8)}`,
        joiningDate: new Date(),
      },
    });

    designerB = await prisma.employee.create({
      data: {
        organizationId: testOrg.id,
        employeeCode: `EMP-DES-B-${timestamp.toString().slice(-4)}`,
        firstName: "Bhavna",
        lastName: "Patel",
        displayName: "Bhavna (CAD Lead)",
        designation: "CAD Architect",
        workEmail: `bhavna-${timestamp}@homio.test`,
        workPhone: `+9197${timestamp.toString().slice(-8)}`,
        joiningDate: new Date(),
      },
    });

    // Designer in otherOrg (Tenant isolation check)
    otherOrgDesigner = await prisma.employee.create({
      data: {
        organizationId: otherOrg.id,
        employeeCode: `EMP-FOR-${timestamp.toString().slice(-4)}`,
        firstName: "Foreign",
        lastName: "Architect",
        displayName: "Foreign Architect",
        designation: "Foreign Architect",
        workEmail: `foreign-${timestamp}@homio.test`,
        workPhone: `+9196${timestamp.toString().slice(-8)}`,
        joiningDate: new Date(),
      },
    });

    // Client User & Customer in testOrg
    clientUser = await prisma.user.create({
      data: {
        organizationId: testOrg.id,
        firstName: "Vikram",
        lastName: "Malhotra",
        email: `vikram-user-${timestamp}@client.test`,
        phone: `+9191${timestamp.toString().slice(-8)}`,
      },
    });

    customer = await prisma.customer.create({
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

    // Foreign User & Customer
    otherOrgUser = await prisma.user.create({
      data: {
        organizationId: otherOrg.id,
        firstName: "Foreign",
        lastName: "Client",
        email: `foreign-user-${timestamp}@client.test`,
        phone: `+9190${timestamp.toString().slice(-8)}`,
      },
    });

    otherOrgCustomer = await prisma.customer.create({
      data: {
        organizationId: otherOrg.id,
        userId: otherOrgUser.id,
        customerCode: `CUST-FOR-${timestamp}`,
        firstName: "Foreign",
        lastName: "Client",
        displayName: "Foreign Client",
        phone: otherOrgUser.phone!,
        email: otherOrgUser.email,
        customerType: "CLIENT",
      },
    });

    // Project 1 & Project 2 in testOrg
    project1 = await prisma.project.create({
      data: {
        organizationId: testOrg.id,
        customerId: customer.id,
        userId: clientUser.id,
        projectCode: `PRJ-LUX-${timestamp.toString().slice(-4)}`,
        name: "Villa Imperia 4BHK",
        status: "EXECUTION",
      },
    });

    project2 = await prisma.project.create({
      data: {
        organizationId: testOrg.id,
        customerId: customer.id,
        userId: clientUser.id,
        projectCode: `PRJ-APT-${timestamp.toString().slice(-4)}`,
        name: "Skyline Penthouse",
        status: "DESIGN",
      },
    });

    // Project in foreign org
    otherOrgProject = await prisma.project.create({
      data: {
        organizationId: otherOrg.id,
        customerId: otherOrgCustomer.id,
        userId: otherOrgUser.id,
        projectCode: `PRJ-FOR-${timestamp.toString().slice(-4)}`,
        name: "Foreign Villa",
        status: "EXECUTION",
      },
    });

    console.log(`  Provisioned Test Org: ${testOrg.id}`);
    console.log(
      `  Provisioned Designer A: ${designerA.displayName} (${designerA.id})`,
    );
    console.log(
      `  Provisioned Designer B: ${designerB.displayName} (${designerB.id})`,
    );
    console.log(`  Provisioned Project 1: ${project1.name} (${project1.id})`);
    console.log(`  Provisioned Project 2: ${project2.name} (${project2.id})`);

    // =========================================================================
    // STEP 2: CREATE DESIGN WORKSPACES, FOLDERS, VERSIONS & ATTACHMENTS
    // =========================================================================
    console.log(
      `\n${colors.bold}${colors.yellow}--- STEP 2: Creating Controlled Ground-Truth Design Files & Deliverables ---${colors.reset}`,
    );

    // Folder 1: Living Room Concept (RENDER_3D) in Project 1
    const folderConceptP1 = await prisma.projectDesignFolder.create({
      data: {
        organizationId: testOrg.id,
        projectId: project1.id,
        folderCode: `FLD-LIV-${timestamp.toString().slice(-4)}`,
        name: "Living Room Concept Renders",
        roomType: "LIVING_ROOM",
        stage: "RENDER_3D",
      },
    });

    // Folder 2: Modular Kitchen GFC (GOOD_FOR_CONSTRUCTION_GFC) in Project 1 -> SENT FOR EXECUTION
    const folderGfcP1 = await prisma.projectDesignFolder.create({
      data: {
        organizationId: testOrg.id,
        projectId: project1.id,
        folderCode: `FLD-KIT-${timestamp.toString().slice(-4)}`,
        name: "Kitchen Working Drawings GFC",
        roomType: "KITCHEN",
        stage: "GOOD_FOR_CONSTRUCTION_GFC",
      },
    });

    // Folder 3: Master Bedroom in Project 2
    const folderP2 = await prisma.projectDesignFolder.create({
      data: {
        organizationId: testOrg.id,
        projectId: project2.id,
        folderCode: `FLD-BED-${timestamp.toString().slice(-4)}`,
        name: "Master Suite 3D Views",
        roomType: "MASTER_BEDROOM",
        stage: "DESIGN_DEVELOPMENT",
      },
    });

    // -------------------------------------------------------------------------
    // Design 1: Living Room Modern Italian Design (Project 1)
    // Status: APPROVED (File Done!)
    // -------------------------------------------------------------------------
    const design1 = await prisma.projectDesign.create({
      data: {
        organizationId: testOrg.id,
        projectId: project1.id,
        folderId: folderConceptP1.id,
        designCode: `DSG-1-${timestamp.toString().slice(-4)}`,
        title: "Modern Italian Living Area",
        designType: "RENDER_3D",
        status: "APPROVED",
        currentVersionNumber: 1,
      },
    });

    const v1Design1 = await prisma.designVersion.create({
      data: {
        designId: design1.id,
        versionNumber: 1,
        status: "APPROVED",
      },
    });

    // Designer A creates 2 3D Renders in Design 1 (Approved)
    await prisma.designVersionAttachment.create({
      data: {
        designVersionId: v1Design1.id,
        attachmentType: "RENDER_IMAGE",
        title: "Living Room Panoramic 4K Render",
        file: {
          id: `file-${timestamp}-1`,
          url: "https://cloud.homio.test/render-1.webp",
          bytes: 85000,
          format: "webp",
          provider: "local",
        },
        createdById: designerA.id,
      },
    });

    await prisma.designVersionAttachment.create({
      data: {
        designVersionId: v1Design1.id,
        attachmentType: "RENDER_IMAGE",
        title: "TV Unit Lighting Close-up",
        file: {
          id: `file-${timestamp}-2`,
          url: "https://cloud.homio.test/render-2.webp",
          bytes: 90000,
          format: "webp",
          provider: "local",
        },
        createdById: designerA.id,
      },
    });

    // Designer B creates 1 Spec Sheet in Design 1 (Approved)
    await prisma.designVersionAttachment.create({
      data: {
        designVersionId: v1Design1.id,
        attachmentType: "SPECIFICATION_SHEET",
        title: "Italian Marble & Veneer Spec Sheet",
        file: {
          id: `file-${timestamp}-3`,
          url: "https://cloud.homio.test/specs-1.pdf",
          bytes: 95000,
          format: "pdf",
          provider: "local",
        },
        createdById: designerB.id,
      },
    });

    // Approval Record for Design 1 (Rated 5 Stars!)
    await prisma.designVersionApproval.create({
      data: {
        organizationId: testOrg.id,
        designVersionId: v1Design1.id,
        projectId: project1.id,
        approvedByUserId: clientUser.id,
        customerId: customer.id,
        decision: "APPROVED",
        clientRating: 5,
        reviewComments: "Stunning render! Exactly what we envisioned.",
      },
    });

    // -------------------------------------------------------------------------
    // Design 2: Kitchen Working Drawings (Project 1, GFC Folder)
    // Status: APPROVED & Locked -> SENT FOR EXECUTION!
    // -------------------------------------------------------------------------
    const design2 = await prisma.projectDesign.create({
      data: {
        organizationId: testOrg.id,
        projectId: project1.id,
        folderId: folderGfcP1.id,
        designCode: `DSG-2-${timestamp.toString().slice(-4)}`,
        title: "Kitchen Carpentry & Electrical GFC",
        designType: "DRAWING_2D",
        status: "APPROVED",
        currentVersionNumber: 1,
      },
    });

    const v1Design2 = await prisma.designVersion.create({
      data: {
        designId: design2.id,
        versionNumber: 1,
        status: "APPROVED",
        isLocked: true,
      },
    });

    // Designer B creates 2 CAD / Tech Drawing sheets in Design 2 (GFC Execution Ready)
    await prisma.designVersionAttachment.create({
      data: {
        designVersionId: v1Design2.id,
        attachmentType: "CAD_DWG_FILE",
        title: "Kitchen Carcass & Hardware DWG",
        file: {
          id: `file-${timestamp}-4`,
          url: "https://cloud.homio.test/kitchen-cad.dwg",
          bytes: 80000,
          format: "dwg",
          provider: "local",
        },
        createdById: designerB.id,
      },
    });

    await prisma.designVersionAttachment.create({
      data: {
        designVersionId: v1Design2.id,
        attachmentType: "TECHNICAL_DRAWING_PDF",
        title: "Kitchen Plumbing & Electrical Sheet PDF",
        file: {
          id: `file-${timestamp}-5`,
          url: "https://cloud.homio.test/kitchen-plumbing.pdf",
          bytes: 75000,
          format: "pdf",
          provider: "local",
        },
        createdById: designerB.id,
      },
    });

    // -------------------------------------------------------------------------
    // Design 3: Master Bedroom 3D Walkthrough (Project 2)
    // Status: IN_REVIEW -> TOTAL FILES PENDING
    // -------------------------------------------------------------------------
    const design3 = await prisma.projectDesign.create({
      data: {
        organizationId: testOrg.id,
        projectId: project2.id,
        folderId: folderP2.id,
        designCode: `DSG-3-${timestamp.toString().slice(-4)}`,
        title: "Master Suite Contemporary V1",
        designType: "RENDER_3D",
        status: "IN_REVIEW",
        currentVersionNumber: 1,
      },
    });

    const v1Design3 = await prisma.designVersion.create({
      data: {
        designId: design3.id,
        versionNumber: 1,
        status: "IN_REVIEW",
      },
    });

    // Designer A creates 1 3D Model (.glb) and 1 Render (Pending)
    await prisma.designVersionAttachment.create({
      data: {
        designVersionId: v1Design3.id,
        attachmentType: "THREED_MODEL_FILE",
        title: "Interactive Wardrobe 3D Model (.glb)",
        file: {
          id: `file-${timestamp}-6`,
          url: "https://cloud.homio.test/wardrobe.glb",
          bytes: 92000,
          format: "glb",
          provider: "local",
        },
        createdById: designerA.id,
      },
    });

    await prisma.designVersionAttachment.create({
      data: {
        designVersionId: v1Design3.id,
        attachmentType: "RENDER_IMAGE",
        title: "Master Bedroom Headboard Daylight View",
        file: {
          id: `file-${timestamp}-7`,
          url: "https://cloud.homio.test/master-bed.webp",
          bytes: 88000,
          format: "webp",
          provider: "local",
        },
        createdById: designerA.id,
      },
    });

    // -------------------------------------------------------------------------
    // Design 4: False Ceiling Layout (Project 2)
    // Status: CHANGES_REQUESTED -> FILES REJECTED / REWORK
    // -------------------------------------------------------------------------
    const design4 = await prisma.projectDesign.create({
      data: {
        organizationId: testOrg.id,
        projectId: project2.id,
        folderId: folderP2.id,
        designCode: `DSG-4-${timestamp.toString().slice(-4)}`,
        title: "False Ceiling Cove Lighting Plan",
        designType: "DRAWING_2D",
        status: "CHANGES_REQUESTED",
        currentVersionNumber: 1,
      },
    });

    const v1Design4 = await prisma.designVersion.create({
      data: {
        designId: design4.id,
        versionNumber: 1,
        status: "CHANGES_REQUESTED",
      },
    });

    // Designer B creates 1 CAD drawing (Rejected / Changes Requested)
    await prisma.designVersionAttachment.create({
      data: {
        designVersionId: v1Design4.id,
        attachmentType: "CAD_DWG_FILE",
        title: "Cove Lighting CAD V1",
        file: {
          id: `file-${timestamp}-8`,
          url: "https://cloud.homio.test/ceiling.dwg",
          bytes: 81000,
          format: "dwg",
          provider: "local",
        },
        createdById: designerB.id,
      },
    });

    // Change Request Filed
    await prisma.designChangeRequest.create({
      data: {
        designVersionId: v1Design4.id,
        requestedByUserId: clientUser.id,
        title: "Change cove lighting profile",
        category: "LIGHTING_AND_ELECTRICAL",
        urgency: "HIGH",
        status: "PENDING",
        description:
          "Change cove lighting from 4000K natural white to 3000K warm white profile.",
      },
    });

    // -------------------------------------------------------------------------
    // Foreign Org Design & Files (Should NEVER appear in testOrg reports!)
    // -------------------------------------------------------------------------
    const foreignFolder = await prisma.projectDesignFolder.create({
      data: {
        organizationId: otherOrg.id,
        projectId: otherOrgProject.id,
        folderCode: `FLD-FOR-${timestamp.toString().slice(-4)}`,
        name: "Foreign Space",
      },
    });

    const foreignDesign = await prisma.projectDesign.create({
      data: {
        organizationId: otherOrg.id,
        projectId: otherOrgProject.id,
        folderId: foreignFolder.id,
        designCode: `DSG-FOR-${timestamp.toString().slice(-4)}`,
        title: "Foreign Penthouse",
        status: "APPROVED",
      },
    });

    const foreignVersion = await prisma.designVersion.create({
      data: {
        designId: foreignDesign.id,
        versionNumber: 1,
        status: "APPROVED",
      },
    });

    await prisma.designVersionAttachment.create({
      data: {
        designVersionId: foreignVersion.id,
        attachmentType: "RENDER_IMAGE",
        title: "Foreign Ultra Render",
        file: {
          id: `file-${timestamp}-foreign`,
          url: "https://cloud.foreign.test/render.webp",
          bytes: 89000,
          format: "webp",
          provider: "local",
        },
        createdById: otherOrgDesigner.id,
      },
    });

    console.log(`  Ground-truth generated:`);
    console.log(`    Total Designs: 4`);
    console.log(`    Total Files Made (Attachments): 8`);
    console.log(`    Files Approved (Done): 5 (att1, att2, att3, att4, att5)`);
    console.log(`    Sent For Execution (GFC): 2 (att4, att5)`);
    console.log(`    Files Pending: 2 (att6, att7)`);
    console.log(`    Files Rejected / Changes: 1 (att8)`);
    console.log(`    Designer A Files: 4 (att1, att2, att6, att7)`);
    console.log(`    Designer B Files: 4 (att3, att4, att5, att8)`);
    console.log(`    Foreign Org Files: 1 (Must be isolated!)`);

    // =========================================================================
    // STEP 3: EXECUTE REPORT SERVICE FOR ALL TEST ORG DATA
    // =========================================================================
    console.log(
      `\n${colors.bold}${colors.yellow}--- STEP 3: Verifying Organization-Wide KPI Math & Deliverables ---${colors.reset}`,
    );

    const allOrgReport = await designReportService.getDesignAnalytics(
      testOrg.id,
      {
        datePreset: "all_time",
      },
    );

    // 1. NO. OF FILES MADE
    assertEqual(
      allOrgReport.summary.totalFilesMade,
      8,
      "NO. OF FILES MADE matches total attachments",
    );

    // 2. FILE DONE (Approved)
    assertEqual(
      allOrgReport.summary.totalFilesApproved,
      5,
      "FILE DONE matches approved attachments",
    );

    // 3. SENT FOR EXECUTION (GFC / Locked)
    assertEqual(
      allOrgReport.summary.totalFilesExecutionReady,
      2,
      "SENT FOR EXECUTION matches GFC locked attachments",
    );

    // 4. TOTAL FILES PENDING
    assertEqual(
      allOrgReport.summary.totalFilesPending,
      2,
      "TOTAL FILES PENDING matches in-review attachments",
    );

    // 5. FILES REJECTED
    assertEqual(
      allOrgReport.summary.totalFilesRejected,
      1,
      "FILES REJECTED matches changes requested attachments",
    );

    // 6. Total Master Designs & Versions
    assertEqual(
      allOrgReport.summary.totalDesigns,
      4,
      "Total Master Designs count",
    );
    assertEqual(allOrgReport.summary.totalVersions, 4, "Total Versions count");

    // 7. Client Rating & Approval Rate
    assertEqual(
      allOrgReport.summary.avgClientRating,
      5.0,
      "Average client rating calculation",
    );
    assertEqual(
      allOrgReport.summary.approvalRatePercent,
      100,
      "Approval rate percentage",
    );

    // =========================================================================
    // STEP 4: VERIFY ASSET TYPES DISTRIBUTION
    // =========================================================================
    console.log(
      `\n${colors.bold}${colors.yellow}--- STEP 4: Verifying Asset Types Distribution (Donut Data) ---${colors.reset}`,
    );

    const renderType = allOrgReport.assetTypeDistribution.find(
      (t) => t.type === "RENDER_IMAGE",
    );
    const cadDwgType = allOrgReport.assetTypeDistribution.find(
      (t) => t.type === "CAD_DWG_FILE",
    );
    const pdfType = allOrgReport.assetTypeDistribution.find(
      (t) => t.type === "TECHNICAL_DRAWING_PDF",
    );
    const specType = allOrgReport.assetTypeDistribution.find(
      (t) => t.type === "SPECIFICATION_SHEET",
    );
    const modelType = allOrgReport.assetTypeDistribution.find(
      (t) => t.type === "THREED_MODEL_FILE",
    );

    assertEqual(renderType?.count, 3, "RENDER_IMAGE count matches 3");
    assertEqual(
      renderType?.percentage,
      37.5,
      "RENDER_IMAGE percentage matches 37.5%",
    );
    assertEqual(cadDwgType?.count, 2, "CAD_DWG_FILE count matches 2");
    assertEqual(pdfType?.count, 1, "TECHNICAL_DRAWING_PDF count matches 1");
    assertEqual(specType?.count, 1, "SPECIFICATION_SHEET count matches 1");
    assertEqual(modelType?.count, 1, "THREED_MODEL_FILE count matches 1");

    // =========================================================================
    // STEP 5: VERIFY DESIGNER & ARCHITECT PRODUCTIVITY MATRIX
    // =========================================================================
    console.log(
      `\n${colors.bold}${colors.yellow}--- STEP 5: Verifying Designer Productivity Leaderboard ---${colors.reset}`,
    );

    const designerAMetric = allOrgReport.employeeLeaderboard.find(
      (e) => e.employee.id === designerA.id,
    );
    const designerBMetric = allOrgReport.employeeLeaderboard.find(
      (e) => e.employee.id === designerB.id,
    );

    // Designer A checks
    assertEqual(
      designerAMetric?.totalFilesMade,
      4,
      "Designer A total files made is 4",
    );
    assertEqual(
      designerAMetric?.renders3DCount,
      3,
      "Designer A 3D renders count is 3",
    );
    assertEqual(
      designerAMetric?.modelsCount,
      1,
      "Designer A 3D models count is 1",
    );
    assertEqual(
      designerAMetric?.approvedFilesCount,
      2,
      "Designer A approved files is 2",
    );
    assertEqual(
      designerAMetric?.productivitySharePercent,
      50.0,
      "Designer A production share is 50%",
    );

    // Designer B checks
    assertEqual(
      designerBMetric?.totalFilesMade,
      4,
      "Designer B total files made is 4",
    );
    assertEqual(
      designerBMetric?.cadDrawingsCount,
      3,
      "Designer B CAD & Tech drawings is 3 (2 DWG + 1 PDF)",
    );
    assertEqual(
      designerBMetric?.specSheetsCount,
      1,
      "Designer B spec sheets count is 1",
    );
    assertEqual(
      designerBMetric?.approvedFilesCount,
      3,
      "Designer B approved files is 3",
    );
    assertEqual(
      designerBMetric?.executionReadyFilesCount,
      2,
      "Designer B GFC execution files is 2",
    );
    assertEqual(
      designerBMetric?.productivitySharePercent,
      50.0,
      "Designer B production share is 50%",
    );

    // =========================================================================
    // STEP 6: VERIFY PROJECT FILTERING ACCURACY
    // =========================================================================
    console.log(
      `\n${colors.bold}${colors.yellow}--- STEP 6: Verifying Project Filter Isolation (Project 1 vs Project 2) ---${colors.reset}`,
    );

    const p1Report = await designReportService.getDesignAnalytics(testOrg.id, {
      projectId: project1.id,
      datePreset: "all_time",
    });

    assertEqual(
      p1Report.summary.totalDesigns,
      2,
      "Project 1 has exactly 2 designs",
    );
    assertEqual(
      p1Report.summary.totalFilesMade,
      5,
      "Project 1 has exactly 5 files made",
    );
    assertEqual(
      p1Report.summary.totalFilesApproved,
      5,
      "Project 1 has 5 approved files",
    );
    assertEqual(
      p1Report.summary.totalFilesExecutionReady,
      2,
      "Project 1 has 2 execution ready files",
    );
    assertEqual(
      p1Report.summary.totalFilesPending,
      0,
      "Project 1 has 0 pending files",
    );

    const p2Report = await designReportService.getDesignAnalytics(testOrg.id, {
      projectId: project2.id,
      datePreset: "all_time",
    });

    assertEqual(
      p2Report.summary.totalDesigns,
      2,
      "Project 2 has exactly 2 designs",
    );
    assertEqual(
      p2Report.summary.totalFilesMade,
      3,
      "Project 2 has exactly 3 files made",
    );
    assertEqual(
      p2Report.summary.totalFilesPending,
      2,
      "Project 2 has 2 pending files",
    );
    assertEqual(
      p2Report.summary.totalFilesRejected,
      1,
      "Project 2 has 1 rejected file",
    );

    // =========================================================================
    // STEP 7: VERIFY EMPLOYEE FILTERING ACCURACY
    // =========================================================================
    console.log(
      `\n${colors.bold}${colors.yellow}--- STEP 7: Verifying Employee Filter Isolation (Designer A only) ---${colors.reset}`,
    );

    const designerAReport = await designReportService.getDesignAnalytics(
      testOrg.id,
      {
        employeeId: designerA.id,
        datePreset: "all_time",
      },
    );

    assertEqual(
      designerAReport.summary.totalFilesMade,
      4,
      "Designer A filter isolates exactly 4 files",
    );
    assertEqual(
      designerAReport.summary.totalFilesApproved,
      2,
      "Designer A has 2 approved files",
    );
    assertEqual(
      designerAReport.summary.totalFilesPending,
      2,
      "Designer A has 2 pending files",
    );
    assertEqual(
      designerAReport.summary.totalFilesRejected,
      0,
      "Designer A has 0 rejected files",
    );

    // =========================================================================
    // STEP 8: VERIFY MULTI-TENANT ISOLATION
    // =========================================================================
    console.log(
      `\n${colors.bold}${colors.yellow}--- STEP 8: Verifying Multi-Tenant Isolation ---${colors.reset}`,
    );

    const otherOrgReport = await designReportService.getDesignAnalytics(
      otherOrg.id,
      {
        datePreset: "all_time",
      },
    );

    assertEqual(
      otherOrgReport.summary.totalDesigns,
      1,
      "Foreign Org has only 1 design",
    );
    assertEqual(
      otherOrgReport.summary.totalFilesMade,
      1,
      "Foreign Org has only 1 file",
    );

    // Check that testOrg does not contain foreign designer
    const foreignEmpInTestOrg = allOrgReport.employeeLeaderboard.find(
      (e) => e.employee.id === otherOrgDesigner.id,
    );
    assertTrue(
      foreignEmpInTestOrg === undefined,
      "Foreign employee is not leaked in Test Org leaderboard",
    );
  } catch (error) {
    console.error(
      `\n${colors.red}Test Suite Encountered an Unexpected Error:${colors.reset}`,
      error,
    );
    failedAssertions++;
  } finally {
    // =========================================================================
    // STEP 9: CLEANUP
    // =========================================================================
    console.log(
      `\n${colors.bold}${colors.yellow}--- STEP 9: Teardown & Resource Cleanup ---${colors.reset}`,
    );

    if (testOrg?.id) {
      await prisma.designChangeRequest.deleteMany({
        where: { designVersion: { design: { organizationId: testOrg.id } } },
      });
      await prisma.designVersionApproval.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.designVersionAttachment.deleteMany({
        where: { designVersion: { design: { organizationId: testOrg.id } } },
      });
      await prisma.designVersion.deleteMany({
        where: { design: { organizationId: testOrg.id } },
      });
      await prisma.projectDesign.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.projectDesignFolder.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.project.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.customer.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.user.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.employee.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.organization.delete({
        where: { id: testOrg.id },
      });
      console.log(`  Cleaned up Test Org: ${testOrg.id}`);
    }

    if (otherOrg?.id) {
      await prisma.designVersionAttachment.deleteMany({
        where: { designVersion: { design: { organizationId: otherOrg.id } } },
      });
      await prisma.designVersion.deleteMany({
        where: { design: { organizationId: otherOrg.id } },
      });
      await prisma.projectDesign.deleteMany({
        where: { organizationId: otherOrg.id },
      });
      await prisma.projectDesignFolder.deleteMany({
        where: { organizationId: otherOrg.id },
      });
      await prisma.project.deleteMany({
        where: { organizationId: otherOrg.id },
      });
      await prisma.customer.deleteMany({
        where: { organizationId: otherOrg.id },
      });
      await prisma.user.deleteMany({
        where: { organizationId: otherOrg.id },
      });
      await prisma.employee.deleteMany({
        where: { organizationId: otherOrg.id },
      });
      await prisma.organization.delete({
        where: { id: otherOrg.id },
      });
      console.log(`  Cleaned up Foreign Org: ${otherOrg.id}`);
    }
  }

  // =========================================================================
  // FINAL SCORECARD
  // =========================================================================
  console.log(
    `\n${colors.bold}${colors.magenta}================================================================================${colors.reset}`,
  );
  console.log(
    `${colors.bold}${colors.cyan}                      FINAL TEST SUITE RESULTS SCORECARD                        ${colors.reset}`,
  );
  console.log(
    `${colors.bold}${colors.magenta}================================================================================${colors.reset}`,
  );
  console.log(
    `  Total Assertions: ${colors.bold}${totalAssertions}${colors.reset}`,
  );
  console.log(
    `  Passed:           ${colors.bold}${colors.green}${passedAssertions}${colors.reset}`,
  );
  console.log(
    `  Failed:           ${colors.bold}${failedAssertions > 0 ? colors.red : colors.green}${failedAssertions}${colors.reset}`,
  );

  if (failedAssertions === 0 && totalAssertions > 0) {
    console.log(
      `\n${colors.bold}${colors.green}🎉 ALL ${totalAssertions} ASSERTIONS PASSED WITH 100.0% PRECISION!${colors.reset}\n`,
    );
  } else {
    console.error(
      `\n${colors.bold}${colors.red}❌ SOME ASSERTIONS FAILED! Precision < 100%${colors.reset}\n`,
    );
    process.exit(1);
  }
}

runDesignReportsAccuracySuite();
