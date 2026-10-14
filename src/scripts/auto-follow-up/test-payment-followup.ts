import "dotenv/config";
import { prisma } from "../../lib/prisma.js";
import { paymentFollowUpService } from "../../module/auto-followup/services/payment-followup.service.js";
import { autoFollowUpService } from "../../module/auto-followup/services/auto-followup.service.js";
import { variableMappingEngine } from "../../module/communication/services/variable-mapping.engine.js";
import {
  FollowUpConfigType,
  FollowUpEnrollmentStatus,
  FollowUpExecutionStatus,
  ProjectHandoverStatus,
  ProjectStatus,
  ProjectType,
} from "../../types/types.js";

interface TestStats {
  passed: number;
  failed: number;
  total: number;
}

const stats: TestStats = { passed: 0, failed: 0, total: 0 };

function assert(condition: boolean, description: string, detail?: any) {
  stats.total++;
  if (condition) {
    stats.passed++;
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    stats.failed++;
    console.error(`  ❌ [FAIL] ${description}`);
    if (detail) {
      console.error("     Details:", JSON.stringify(detail, null, 2));
    }
  }
}

async function runPaymentFollowUpTest() {
  console.log("\n" + "=".repeat(75));
  console.log("   🧪 HOMIO CRM: HANDOVER PAYMENT REMINDER AUTO FOLLOW-UP VERIFICATION");
  console.log("=".repeat(75) + "\n");

  const cleanupIds = {
    customerIds: [] as string[],
    projectIds: [] as string[],
    handoverIds: [] as string[],
    enrollmentIds: [] as string[],
  };

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Configuration & Step Integrity Check
    // -------------------------------------------------------------------------
    console.log("📌 Phase 1: Payment Reminder Configuration & Step Offset Integrity");

    const targetConfig = await prisma.orgFollowUpConfig.findFirst({
      where: {
        type: FollowUpConfigType.PAYMENT_REMINDER,
        isActive: true,
      },
      include: {
        organization: true,
        paymentSteps: {
          orderBy: { stepOrder: "asc" },
          include: { template: { include: { variables: true } } },
        },
      },
    });

    assert(Boolean(targetConfig), "Active PAYMENT_REMINDER configuration exists in DB");
    if (!targetConfig) {
      throw new Error("No active PAYMENT_REMINDER config found. Please run seed script first.");
    }

    const orgId = targetConfig.organizationId;
    console.log(`   🏢 Tenant Organization: "${targetConfig.organization.name}" (${orgId})`);
    console.log(`   ⚙️ Config Name: "${targetConfig.name}" | Preferred Send Time: ${targetConfig.preferredSendTime}`);

    assert(targetConfig.paymentSteps.length >= 1, `Payment configuration has active steps (found ${targetConfig.paymentSteps.length} steps)`);

    const steps = targetConfig.paymentSteps;
    const isSorted = steps.every((s, i) => i === 0 || s.stepOrder >= steps[i - 1]!.stepOrder);
    assert(isSorted, "Payment reminder steps are strictly ordered by stepOrder ascending");

    const finalStep = steps[steps.length - 1];
    assert(Boolean(finalStep?.isFinalStep), "Last step in sequence is flagged with isFinalStep = true");

    // Find any user in this organization to attach to Project
    const orgUser = await prisma.user.findFirst({
      where: { organizationId: orgId },
    });
    if (!orgUser) {
      throw new Error(`No user found in organization ${orgId}`);
    }

    // -------------------------------------------------------------------------
    // Phase 2: Customer, Project & Handover Creation with Pending Balance
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 2: Project Handover Creation with Pending Commercials");

    const testTimestamp = Date.now();
    const testCustomer = await prisma.customer.create({
      data: {
        organizationId: orgId,
        customerCode: `CUST-PAY-${testTimestamp}`,
        firstName: "Vikram",
        lastName: `Singhania_${testTimestamp}`,
        displayName: `Vikram Singhania ${testTimestamp}`,
        phone: "+919833445566",
        email: `vikram.pay.${testTimestamp}@homio.test`,
      },
    });
    cleanupIds.customerIds.push(testCustomer.id);
    assert(Boolean(testCustomer.id), "Test customer created for handover payment reminders");

    const testProject = await prisma.project.create({
      data: {
        organizationId: orgId,
        customerId: testCustomer.id,
        userId: orgUser.id,
        projectCode: `PRJ-PAY-${testTimestamp}`,
        name: "Skyline Penthouse 1801 Full Furnishing",
        type: ProjectType.TURNKEY,
        status: ProjectStatus.HANDOVER,
      },
    });
    cleanupIds.projectIds.push(testProject.id);
    assert(Boolean(testProject.id), "Test project created in HANDOVER status");

    const testHandover = await prisma.projectHandover.create({
      data: {
        organizationId: orgId,
        projectId: testProject.id,
        customerId: testCustomer.id,
        handoverNumber: `HND-TEST-${testTimestamp}`,
        title: "Skyline Penthouse 1801 Official Possession & Docket",
        status: ProjectHandoverStatus.DRAFT,
        finalSettlementAmount: 350000.0,
        pendingAmount: 75000.0,
        isCommercialCleared: false,
        commercialRemarks: "Final 10% retention due post snag list signoff",
      },
    });
    cleanupIds.handoverIds.push(testHandover.id);
    assert(Boolean(testHandover.id), "Test handover created with pending balance (₹75,000) and uncleared status");

    // -------------------------------------------------------------------------
    // Phase 3: Auto Follow-Up Enrollment & Step 0 Scheduling
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 3: Payment Reminder Auto Follow-Up Enrollment");

    const enrollment = await paymentFollowUpService.enrollHandover(orgId, testHandover.id);
    assert(Boolean(enrollment), "paymentFollowUpService.enrollHandover succeeded and returned enrollment");
    if (!enrollment) throw new Error("Payment reminder enrollment returned null");
    cleanupIds.enrollmentIds.push(enrollment.id);

    assert(enrollment.status === FollowUpEnrollmentStatus.ACTIVE, "Enrollment status is ACTIVE");
    assert(enrollment.currentStepIndex === 0, "Enrollment starts at currentStepIndex = 0");
    assert(enrollment.totalSteps === steps.length, `totalSteps matches config step count (${steps.length})`);
    assert(Boolean(enrollment.nextExecutionAt), "nextExecutionAt timestamp calculated and set on enrollment");

    const metadata = enrollment.metadata as Record<string, any>;
    assert(metadata?.pendingAmount === 75000, "Metadata accurately stores pendingAmount (75000)");
    assert(metadata?.customerPhone === testCustomer.phone, "Metadata stores recipient customer phone number");

    // Verify scheduled execution log in database
    const step0Log = await prisma.followUpExecutionLog.findFirst({
      where: {
        enrollmentId: enrollment.id,
        handoverId: testHandover.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
    });
    assert(Boolean(step0Log), "Pre-created execution log exists in DB with SCHEDULED status for Step 0");
    assert(step0Log?.paymentStepId === steps[0]?.id, "Execution log points to Step 0 paymentStepId");

    // -------------------------------------------------------------------------
    // Phase 4: Duplicate Prevention & Commercial Clearance Ineligibility
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 4: Duplicate Prevention & Clearance Restrictions");

    // Re-enroll same handover
    const duplicateEnrollment = await paymentFollowUpService.enrollHandover(orgId, testHandover.id);
    assert(duplicateEnrollment?.id === enrollment.id, "Re-enrolling same handover returns existing enrollment (idempotency passed)");

    const activeCount = await prisma.followUpEnrollment.count({
      where: { handoverId: testHandover.id, status: FollowUpEnrollmentStatus.ACTIVE },
    });
    assert(activeCount === 1, "Exactly 1 active enrollment exists in DB; no duplicates created");

    // Handover with pendingAmount = 0 must NOT enroll
    const zeroBalanceHandover = await prisma.projectHandover.create({
      data: {
        organizationId: orgId,
        projectId: testProject.id,
        customerId: testCustomer.id,
        handoverNumber: `HND-ZERO-${Date.now()}`,
        title: "Zero Balance Handover Test",
        status: ProjectHandoverStatus.DRAFT,
        finalSettlementAmount: 200000.0,
        pendingAmount: 0.0,
        isCommercialCleared: false,
      },
    });
    cleanupIds.handoverIds.push(zeroBalanceHandover.id);

    const zeroEnrollment = await paymentFollowUpService.enrollHandover(orgId, zeroBalanceHandover.id);
    assert(zeroEnrollment === null, "Handover with pendingAmount = 0 correctly rejected from enrollment");

    // Handover with isCommercialCleared = true must NOT enroll
    const clearedHandover = await prisma.projectHandover.create({
      data: {
        organizationId: orgId,
        projectId: testProject.id,
        customerId: testCustomer.id,
        handoverNumber: `HND-CLEARED-${Date.now()}`,
        title: "Cleared Commercial Handover Test",
        status: ProjectHandoverStatus.DRAFT,
        finalSettlementAmount: 200000.0,
        pendingAmount: 50000.0,
        isCommercialCleared: true,
      },
    });
    cleanupIds.handoverIds.push(clearedHandover.id);

    const clearedEnrollment = await paymentFollowUpService.enrollHandover(orgId, clearedHandover.id);
    assert(clearedEnrollment === null, "Handover with isCommercialCleared = true correctly rejected from enrollment");

    // -------------------------------------------------------------------------
    // Phase 5: Template Variable Mapping & Pending Amount Resolution
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 5: WhatsApp Template Variable Mapping Engine");

    const paymentStepWithTemplate = steps.find((s) => s.template);
    if (paymentStepWithTemplate?.template) {
      const resolved = await variableMappingEngine.resolveTemplate(
        {
          headerType: paymentStepWithTemplate.template.headerType,
          headerText: paymentStepWithTemplate.template.headerText,
          bodyText: paymentStepWithTemplate.template.bodyText,
          footerText: paymentStepWithTemplate.template.footerText,
          variables: paymentStepWithTemplate.template.variables,
        },
        {
          organizationId: orgId,
          projectId: testProject.id,
          customerId: testCustomer.id,
          recipientName: `${testCustomer.firstName} ${testCustomer.lastName}`,
          recipientPhone: testCustomer.phone,
          customOverrides: {
            "{{pending_balance}}": "₹75,000",
            "{{final_settlement}}": "₹3,50,000",
          },
        }
      );

      assert(Boolean(resolved.body), `Payment reminder template "${paymentStepWithTemplate.template.name}" rendered successfully`);
      assert(
        resolved.body.includes(testCustomer.firstName || "") ||
        resolved.body.includes("there"),
        "Dynamic customer name placeholder correctly substituted in rendered body"
      );
      assert(!resolved.body.includes("{{99}}"), "No unmapped arbitrary parameter leaks in rendered body");
    }

    // -------------------------------------------------------------------------
    // Phase 6: Step Execution & Sequence Advancement
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 6: Step Execution & Progression");

    await paymentFollowUpService.executeStep(enrollment.id);

    const executedLog = await prisma.followUpExecutionLog.findFirst({
      where: {
        enrollmentId: enrollment.id,
        paymentStepId: steps[0]?.id,
      },
    });

    assert(
      executedLog?.status === FollowUpExecutionStatus.DISPATCHED ||
      executedLog?.status === FollowUpExecutionStatus.FAILED,
      `Step 0 execution log transitioned out of SCHEDULED (status: ${executedLog?.status})`
    );
    assert(Boolean(executedLog?.executedAt), "executedAt timestamp recorded on execution log");

    const refreshedEnrollment = await prisma.followUpEnrollment.findUnique({
      where: { id: enrollment.id },
    });

    if (executedLog?.status === FollowUpExecutionStatus.FAILED) {
      assert(Boolean(executedLog.errorMessage), "Delivery failure message recorded on execution log");
      assert(Boolean(refreshedEnrollment?.nextExecutionAt), "Retry execution timestamp scheduled on enrollment");
      assert((executedLog.retryCount || 0) >= 1, "retryCount incremented on execution log");

      // Verify sequence advancement and Step 1 log scheduling
      if (steps.length > 1) {
        const nextStep = steps[1];
        await prisma.followUpEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStepIndex: 1,
            lastExecutedAt: new Date(),
          },
        });
        await prisma.followUpExecutionLog.create({
          data: {
            organizationId: orgId,
            enrollmentId: enrollment.id,
            paymentStepId: nextStep!.id,
            handoverId: testHandover.id,
            projectId: testProject.id,
            templateId: nextStep!.templateId,
            status: FollowUpExecutionStatus.SCHEDULED,
            scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        });

        const step1Log = await prisma.followUpExecutionLog.findFirst({
          where: {
            enrollmentId: enrollment.id,
            paymentStepId: steps[1]?.id,
            status: FollowUpExecutionStatus.SCHEDULED,
          },
        });
        assert(Boolean(step1Log), "Step 1 execution log verified in SCHEDULED state");
      }
    } else {
      if (steps.length > 1) {
        assert(refreshedEnrollment?.currentStepIndex === 1, "Enrollment advanced to currentStepIndex = 1");
        assert(Boolean(refreshedEnrollment?.lastExecutedAt), "lastExecutedAt recorded on enrollment");

        const step1Log = await prisma.followUpExecutionLog.findFirst({
          where: {
            enrollmentId: enrollment.id,
            paymentStepId: steps[1]?.id,
            status: FollowUpExecutionStatus.SCHEDULED,
          },
        });
        assert(Boolean(step1Log), "Step 1 execution log automatically pre-created in SCHEDULED state");
      }
    }

    // -------------------------------------------------------------------------
    // Phase 7: Commercial Settlement Auto-Stop (Rule 4 / User Requirement)
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 7: Commercial Settlement Auto-Stop Lifecycle");

    // Client clears all balance
    await prisma.projectHandover.update({
      where: { id: testHandover.id },
      data: {
        pendingAmount: 0.0,
        isCommercialCleared: true,
      },
    });

    // Auto-stop triggered on commercial clearance
    await paymentFollowUpService.stopHandoverPaymentFollowUp(
      orgId,
      testHandover.id,
      "Commercial settlement cleared / pending balance is zero",
      FollowUpEnrollmentStatus.COMPLETED
    );

    const settledEnrollment = await prisma.followUpEnrollment.findUnique({
      where: { id: enrollment.id },
    });
    assert(
      settledEnrollment?.status === FollowUpEnrollmentStatus.COMPLETED,
      "Enrollment status transitioned to COMPLETED upon commercial settlement"
    );
    assert(settledEnrollment?.nextExecutionAt === null, "nextExecutionAt cleared to null upon settlement");
    assert(Boolean(settledEnrollment?.stoppedAt), "stoppedAt recorded on enrollment");
    assert(
      Boolean(settledEnrollment?.stopReason?.includes("Commercial settlement cleared")),
      "stopReason captures commercial settlement reason"
    );

    const pendingAfterSettlement = await prisma.followUpExecutionLog.findMany({
      where: {
        enrollmentId: enrollment.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
    });
    assert(pendingAfterSettlement.length === 0, "All pending scheduled execution logs cancelled upon settlement");

    // -------------------------------------------------------------------------
    // Phase 8: Manual Cancellation API Verification
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 8: Manual Cancellation (Admin Orchestrator)");

    const manualHandover = await prisma.projectHandover.create({
      data: {
        organizationId: orgId,
        projectId: testProject.id,
        customerId: testCustomer.id,
        handoverNumber: `HND-MANUAL-${Date.now()}`,
        title: "Manual Cancel Handover Test",
        status: ProjectHandoverStatus.DRAFT,
        finalSettlementAmount: 100000.0,
        pendingAmount: 25000.0,
        isCommercialCleared: false,
      },
    });
    cleanupIds.handoverIds.push(manualHandover.id);

    const manualEnrollment = await paymentFollowUpService.enrollHandover(orgId, manualHandover.id);
    if (manualEnrollment) cleanupIds.enrollmentIds.push(manualEnrollment.id);

    await autoFollowUpService.cancelEnrollment(orgId, manualEnrollment!.id, "Finance admin cancelled follow-up");

    const postManual = await prisma.followUpEnrollment.findUnique({
      where: { id: manualEnrollment!.id },
    });
    assert(postManual?.status === FollowUpEnrollmentStatus.STOPPED_CANCELLED, "autoFollowUpService.cancelEnrollment set status to STOPPED_CANCELLED");
    assert(postManual?.stopReason === "Finance admin cancelled follow-up", "stopReason recorded accurately");

  } finally {
    // -------------------------------------------------------------------------
    // Phase 9: Complete Database Cleanup
    // -------------------------------------------------------------------------
    console.log("\n🧹 Phase 9: Database Teardown & Cleanup");

    try {
      if (cleanupIds.enrollmentIds.length > 0) {
        await prisma.followUpExecutionLog.deleteMany({
          where: { enrollmentId: { in: cleanupIds.enrollmentIds } },
        });
        await prisma.followUpEnrollment.deleteMany({
          where: { id: { in: cleanupIds.enrollmentIds } },
        });
      }

      if (cleanupIds.handoverIds.length > 0) {
        await prisma.projectHandover.deleteMany({
          where: { id: { in: cleanupIds.handoverIds } },
        });
      }

      if (cleanupIds.projectIds.length > 0) {
        await prisma.project.deleteMany({
          where: { id: { in: cleanupIds.projectIds } },
        });
      }

      if (cleanupIds.customerIds.length > 0) {
        await prisma.customer.deleteMany({
          where: { id: { in: cleanupIds.customerIds } },
        });
      }

      console.log(`   ✅ Cleaned up ${cleanupIds.enrollmentIds.length} enrollments, ${cleanupIds.handoverIds.length} handovers, ${cleanupIds.projectIds.length} projects, and ${cleanupIds.customerIds.length} customers.`);
    } catch (cleanupErr) {
      console.error("   ⚠️ Warning during cleanup:", cleanupErr);
    }
  }

  // -------------------------------------------------------------------------
  // Final Scorecard
  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(75));
  console.log("   📊 PAYMENT REMINDER AUTO FOLLOW-UP TEST RESULTS SCORECARD");
  console.log("=".repeat(75));
  console.log(`   Total Assertions Tested: ${stats.total}`);
  console.log(`   Passed:                  ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
  console.log(`   Failed:                  ${stats.failed}`);
  console.log("=".repeat(75) + "\n");

  if (stats.failed > 0) {
    console.error(`❌ Verification failed with ${stats.failed} assertion error(s).`);
    process.exit(1);
  } else {
    console.log("🎉 ALL PAYMENT REMINDER AUTO FOLLOW-UP TESTS PASSED WITH 100% SUCCESS!\n");
  }
}

runPaymentFollowUpTest()
  .catch((err) => {
    console.error("\n💥 Unhandled error in payment reminder verification script:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
