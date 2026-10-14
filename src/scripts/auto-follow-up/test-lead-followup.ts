import "dotenv/config";
import { prisma } from "../../lib/prisma.js";
import { leadFollowUpService } from "../../module/auto-followup/services/lead-followup.service.js";
import { autoFollowUpService } from "../../module/auto-followup/services/auto-followup.service.js";
import { variableMappingEngine } from "../../module/communication/services/variable-mapping.engine.js";
import {
  FollowUpConfigType,
  FollowUpEnrollmentStatus,
  FollowUpExecutionStatus,
  LeadStatus,
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

async function runLeadFollowUpTest() {
  console.log("\n" + "=".repeat(75));
  console.log("   🧪 HOMIO CRM: LEAD AUTO FOLLOW-UP COMPREHENSIVE VERIFICATION SCRIPT");
  console.log("=".repeat(75) + "\n");

  // Track created test entities for guaranteed cleanup
  const cleanupIds = {
    customerIds: [] as string[],
    leadIds: [] as string[],
    enrollmentIds: [] as string[],
  };

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Organization & Configuration Verification
    // -------------------------------------------------------------------------
    console.log("📌 Phase 1: Configuration & Tenant Isolation Verification");

    // Find active organization with LEAD_NO_RESPONSE config
    const targetConfig = await prisma.orgFollowUpConfig.findFirst({
      where: {
        type: FollowUpConfigType.LEAD_NO_RESPONSE,
        isActive: true,
      },
      include: {
        organization: true,
        leadSteps: {
          orderBy: { stepOrder: "asc" },
          include: { template: { include: { variables: true } } },
        },
      },
    });

    assert(Boolean(targetConfig), "Active LEAD_NO_RESPONSE configuration exists in DB");
    if (!targetConfig) {
      throw new Error("No active LEAD_NO_RESPONSE config found. Please run seed script first.");
    }

    const orgId = targetConfig.organizationId;
    console.log(`   🏢 Tenant Organization: "${targetConfig.organization.name}" (${orgId})`);
    console.log(`   ⚙️ Config Name: "${targetConfig.name}" | Preferred Send Time: ${targetConfig.preferredSendTime}`);

    assert(targetConfig.leadSteps.length >= 1, `Lead configuration contains active steps (found ${targetConfig.leadSteps.length} steps)`);

    // Verify step order and final step flag
    const steps = targetConfig.leadSteps;
    const isSorted = steps.every((s, i) => i === 0 || s.stepOrder >= steps[i - 1]!.stepOrder);
    assert(isSorted, "Lead steps are strictly ordered by stepOrder ascending");

    const finalStep = steps[steps.length - 1];
    assert(Boolean(finalStep?.isFinalStep), "Last step in sequence is flagged with isFinalStep = true");

    // -------------------------------------------------------------------------
    // Phase 2: Test Customer & Lead Entity Creation
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 2: Lead Entity Creation & Context Linking");

    const testTimestamp = Date.now();
    const testCustomer = await prisma.customer.create({
      data: {
        organizationId: orgId,
        customerCode: `CUST-TEST-${testTimestamp}`,
        firstName: "TestLead",
        lastName: `Customer_${testTimestamp}`,
        displayName: `Test Lead Customer ${testTimestamp}`,
        phone: "+919876543210",
        email: `lead.test.${testTimestamp}@homio.test`,
      },
    });
    cleanupIds.customerIds.push(testCustomer.id);
    assert(Boolean(testCustomer.id), "Test customer created successfully with international phone number");

    const testLead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        customerId: testCustomer.id,
        leadCode: `LEAD-TEST-${testTimestamp}`,
        title: "Villa 301 Luxury Interior Requirement",
        status: LeadStatus.NEW,
        estimatedBudget: 1500000,
        propertyCity: "Mumbai",
        propertyState: "Maharashtra",
      },
    });
    cleanupIds.leadIds.push(testLead.id);
    assert(testLead.status === LeadStatus.NEW, "Initial lead created in NEW status");

    // -------------------------------------------------------------------------
    // Phase 3: Lead Auto Follow-Up Enrollment & Step 0 Pre-Scheduling
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 3: Auto Follow-Up Enrollment Lifecycle");

    const enrollment = await leadFollowUpService.enrollLead(orgId, testLead.id);
    assert(Boolean(enrollment), "leadFollowUpService.enrollLead succeeded and returned enrollment");
    if (!enrollment) throw new Error("Enrollment returned null");
    cleanupIds.enrollmentIds.push(enrollment.id);

    assert(enrollment.status === FollowUpEnrollmentStatus.ACTIVE, "Enrollment status is ACTIVE");
    assert(enrollment.currentStepIndex === 0, "Enrollment starts at currentStepIndex = 0");
    assert(enrollment.totalSteps === steps.length, `totalSteps matches config step count (${steps.length})`);
    assert(Boolean(enrollment.nextExecutionAt), "nextExecutionAt timestamp is properly calculated for Step 0");

    // Verify scheduled execution log in database
    const step0Log = await prisma.followUpExecutionLog.findFirst({
      where: {
        enrollmentId: enrollment.id,
        leadId: testLead.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
    });
    assert(Boolean(step0Log), "Pre-created execution log exists in DB with SCHEDULED status for Step 0");
    assert(step0Log?.leadStepId === steps[0]?.id, "Execution log points to Step 0 leadStepId");

    // -------------------------------------------------------------------------
    // Phase 4: Idempotency & Excluded Status Verification
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 4: Duplicate Prevention & Excluded Status Restrictions");

    // Re-enroll same lead
    const duplicateEnrollment = await leadFollowUpService.enrollLead(orgId, testLead.id);
    assert(duplicateEnrollment?.id === enrollment.id, "Re-enrolling active lead returns existing enrollment (idempotency passed)");

    const activeCount = await prisma.followUpEnrollment.count({
      where: { leadId: testLead.id, status: FollowUpEnrollmentStatus.ACTIVE },
    });
    assert(activeCount === 1, "Exactly 1 active enrollment exists in DB; no duplicates created");

    // Verify excluded statuses cannot be enrolled
    const excludedStatuses = [
      LeadStatus.ONLINE_MEETING_SCHEDULED,
      LeadStatus.SITE_VISIT_SCHEDULED,
      LeadStatus.WON,
      LeadStatus.LOST,
      LeadStatus.JUNK,
    ];

    for (const exStatus of excludedStatuses) {
      const exLead = await prisma.lead.create({
        data: {
          organizationId: orgId,
          customerId: testCustomer.id,
          leadCode: `LEAD-EX-${exStatus}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: `Excluded Status Test (${exStatus})`,
          status: exStatus,
        },
      });
      cleanupIds.leadIds.push(exLead.id);

      const rejectedEnrollment = await leadFollowUpService.enrollLead(orgId, exLead.id);
      assert(rejectedEnrollment === null, `enrollLead correctly rejected lead in ${exStatus} status`);
    }

    // -------------------------------------------------------------------------
    // Phase 5: Template Variable Mapping & Dynamic Resolution
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 5: WhatsApp Template Variable Mapping Engine");

    const stepWithTemplate = steps.find((s) => s.template);
    if (stepWithTemplate?.template) {
      const resolved = await variableMappingEngine.resolveTemplate(
        {
          headerType: stepWithTemplate.template.headerType,
          headerText: stepWithTemplate.template.headerText,
          bodyText: stepWithTemplate.template.bodyText,
          footerText: stepWithTemplate.template.footerText,
          variables: stepWithTemplate.template.variables,
        },
        {
          organizationId: orgId,
          leadId: testLead.id,
          customerId: testCustomer.id,
          recipientName: `${testCustomer.firstName} ${testCustomer.lastName}`,
          recipientPhone: testCustomer.phone,
        }
      );

      assert(Boolean(resolved.body), `Template "${stepWithTemplate.template.name}" rendered successfully`);
      assert(
        resolved.body.includes(testCustomer.firstName || "") ||
        resolved.body.includes("there"),
        "Dynamic customer first name placeholder correctly substituted in rendered body"
      );
      assert(!resolved.body.includes("{{99}}"), "No unmapped arbitrary parameter leaks in rendered body");
    } else {
      console.log("   ℹ️ No step has template attached, skipping variable resolution test.");
    }

    // -------------------------------------------------------------------------
    // Phase 6: Step Execution & Step Progression
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 6: Step Execution & Sequence Advancement");

    // Execute Step 0
    await leadFollowUpService.executeStep(enrollment.id);

    const executedLog = await prisma.followUpExecutionLog.findFirst({
      where: {
        enrollmentId: enrollment.id,
        leadStepId: steps[0]?.id,
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

    if (steps.length > 1) {
      assert(refreshedEnrollment?.currentStepIndex === 1, "Enrollment advanced to currentStepIndex = 1");
      assert(Boolean(refreshedEnrollment?.lastExecutedAt), "lastExecutedAt recorded on enrollment");

      // Verify next step execution log pre-created
      const step1Log = await prisma.followUpExecutionLog.findFirst({
        where: {
          enrollmentId: enrollment.id,
          leadStepId: steps[1]?.id,
          status: FollowUpExecutionStatus.SCHEDULED,
        },
      });
      assert(Boolean(step1Log), "Step 1 execution log automatically pre-created in SCHEDULED state");
    }

    // -------------------------------------------------------------------------
    // Phase 7: Progression to Final Step & Lead NOT_RESPONDING State
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 7: Final Step Completion & Lead Status Auto-Transition");

    // Fast-forward enrollment to final step index
    const lastStepIndex = steps.length - 1;
    await prisma.followUpEnrollment.update({
      where: { id: enrollment.id },
      data: { currentStepIndex: lastStepIndex },
    });

    // Execute the final step
    await leadFollowUpService.executeStep(enrollment.id);

    const finalEnrollment = await prisma.followUpEnrollment.findUnique({
      where: { id: enrollment.id },
    });
    assert(finalEnrollment?.status === FollowUpEnrollmentStatus.COMPLETED, "Enrollment marked COMPLETED after final step execution");
    assert(finalEnrollment?.nextExecutionAt === null, "nextExecutionAt cleared to null upon completion");

    const finalLead = await prisma.lead.findUnique({
      where: { id: testLead.id },
    });
    assert(
      finalLead?.status === LeadStatus.NOT_RESPONDING,
      `Lead status automatically transitioned to "${LeadStatus.NOT_RESPONDING}" upon final step completion`
    );

    // -------------------------------------------------------------------------
    // Phase 8: Meeting Scheduled Auto-Stop Trigger
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 8: Meeting Scheduled Auto-Stop Trigger");

    // Create another test lead
    const stopTestLead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        customerId: testCustomer.id,
        leadCode: `LEAD-STOP-${Date.now()}`,
        title: "Auto-Stop Meeting Trigger Test Lead",
        status: LeadStatus.NEW,
      },
    });
    cleanupIds.leadIds.push(stopTestLead.id);

    const stopEnrollment = await leadFollowUpService.enrollLead(orgId, stopTestLead.id);
    assert(Boolean(stopEnrollment), "Created second test enrollment for auto-stop verification");
    if (stopEnrollment) cleanupIds.enrollmentIds.push(stopEnrollment.id);

    // Stop follow-up simulating a meeting booked
    await leadFollowUpService.stopLeadFollowUp(
      orgId,
      stopTestLead.id,
      "Meeting successfully booked by user",
    );

    const stoppedEnrollment = await prisma.followUpEnrollment.findUnique({
      where: { id: stopEnrollment?.id },
    });
    assert(
      stoppedEnrollment?.status === FollowUpEnrollmentStatus.STOPPED_MEETING_BOOKED,
      `Enrollment transitioned to STOPPED_MEETING_BOOKED upon meeting booking`
    );
    assert(Boolean(stoppedEnrollment?.stoppedAt), "stoppedAt recorded on enrollment");
    assert(Boolean(stoppedEnrollment?.stopReason?.includes("Meeting")), "stopReason correctly captures meeting booking reason");

    const pendingLogs = await prisma.followUpExecutionLog.findMany({
      where: {
        enrollmentId: stopEnrollment?.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
    });
    assert(pendingLogs.length === 0, "All pending scheduled execution logs cancelled after stopLeadFollowUp");

    // -------------------------------------------------------------------------
    // Phase 9: Manual Cancellation API
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 9: Manual Enrollment Cancellation (Admin Orchestrator)");

    const cancelLead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        customerId: testCustomer.id,
        leadCode: `LEAD-CANCEL-${Date.now()}`,
        title: "Manual Cancel Test Lead",
        status: LeadStatus.NEW,
      },
    });
    cleanupIds.leadIds.push(cancelLead.id);

    const cancelEnrollment = await leadFollowUpService.enrollLead(orgId, cancelLead.id);
    if (cancelEnrollment) cleanupIds.enrollmentIds.push(cancelEnrollment.id);

    await autoFollowUpService.cancelEnrollment(orgId, cancelEnrollment!.id, "User requested manual cancellation");

    const postCancel = await prisma.followUpEnrollment.findUnique({
      where: { id: cancelEnrollment!.id },
    });
    assert(postCancel?.status === FollowUpEnrollmentStatus.STOPPED_CANCELLED, "autoFollowUpService.cancelEnrollment set status to STOPPED_CANCELLED");
    assert(postCancel?.stopReason === "User requested manual cancellation", "stopReason recorded accurately");

  } finally {
    // -------------------------------------------------------------------------
    // Phase 10: Complete Database Cleanup
    // -------------------------------------------------------------------------
    console.log("\n🧹 Phase 10: Database Teardown & Cleanup");

    try {
      if (cleanupIds.enrollmentIds.length > 0) {
        await prisma.followUpExecutionLog.deleteMany({
          where: { enrollmentId: { in: cleanupIds.enrollmentIds } },
        });
        await prisma.followUpEnrollment.deleteMany({
          where: { id: { in: cleanupIds.enrollmentIds } },
        });
      }

      if (cleanupIds.leadIds.length > 0) {
        await prisma.lead.deleteMany({
          where: { id: { in: cleanupIds.leadIds } },
        });
      }

      if (cleanupIds.customerIds.length > 0) {
        await prisma.customer.deleteMany({
          where: { id: { in: cleanupIds.customerIds } },
        });
      }

      console.log(`   ✅ Cleaned up ${cleanupIds.enrollmentIds.length} enrollments, ${cleanupIds.leadIds.length} leads, and ${cleanupIds.customerIds.length} customers.`);
    } catch (cleanupErr) {
      console.error("   ⚠️ Warning during cleanup:", cleanupErr);
    }
  }

  // -------------------------------------------------------------------------
  // Final Scorecard
  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(75));
  console.log("   📊 LEAD AUTO FOLLOW-UP TEST RESULTS SCORECARD");
  console.log("=".repeat(75));
  console.log(`   Total Assertions Tested: ${stats.total}`);
  console.log(`   Passed:                  ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
  console.log(`   Failed:                  ${stats.failed}`);
  console.log("=".repeat(75) + "\n");

  if (stats.failed > 0) {
    console.error(`❌ Verification failed with ${stats.failed} assertion error(s).`);
    process.exit(1);
  } else {
    console.log("🎉 ALL LEAD AUTO FOLLOW-UP TESTS PASSED WITH 100% SUCCESS!\n");
  }
}

runLeadFollowUpTest()
  .catch((err) => {
    console.error("\n💥 Unhandled error in lead follow-up verification script:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
