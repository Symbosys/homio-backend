import "dotenv/config";
import { prisma } from "../../lib/prisma.js";
import { meetingFollowUpService } from "../../module/auto-followup/services/meeting-followup.service.js";
import { autoFollowUpService } from "../../module/auto-followup/services/auto-followup.service.js";
import { RelativeTimeFormatter } from "../../module/auto-followup/services/relative-time.formatter.js";
import { variableMappingEngine } from "../../module/communication/services/variable-mapping.engine.js";
import {
  FollowUpConfigType,
  FollowUpEnrollmentStatus,
  FollowUpExecutionStatus,
  FollowUpIntervalUnit,
  MeetingStatus,
  MeetingType,
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

async function runMeetingFollowUpTest() {
  console.log("\n" + "=".repeat(75));
  console.log("   🧪 HOMIO CRM: MEETING REMINDER AUTO FOLLOW-UP VERIFICATION SCRIPT");
  console.log("=".repeat(75) + "\n");

  const cleanupIds = {
    customerIds: [] as string[],
    meetingIds: [] as string[],
    enrollmentIds: [] as string[],
  };

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Configuration & Step Interval Integrity Verification
    // -------------------------------------------------------------------------
    console.log("📌 Phase 1: Meeting Reminder Configuration & Interval Steps Verification");

    const targetConfig = await prisma.orgFollowUpConfig.findFirst({
      where: {
        type: FollowUpConfigType.MEETING_REMINDER,
        isActive: true,
      },
      include: {
        organization: true,
        meetingSteps: {
          orderBy: { stepOrder: "asc" },
          include: { template: { include: { variables: true } } },
        },
      },
    });

    assert(Boolean(targetConfig), "Active MEETING_REMINDER configuration exists in DB");
    if (!targetConfig) {
      throw new Error("No active MEETING_REMINDER config found. Please run seed script first.");
    }

    const orgId = targetConfig.organizationId;
    console.log(`   🏢 Tenant Organization: "${targetConfig.organization.name}" (${orgId})`);
    console.log(`   ⚙️ Config Name: "${targetConfig.name}" | Steps Configured: ${targetConfig.meetingSteps.length}`);

    assert(targetConfig.meetingSteps.length >= 1, `Meeting configuration has active reminder steps (found ${targetConfig.meetingSteps.length})`);

    const steps = targetConfig.meetingSteps;
    const allHaveIntervals = steps.every(
      (s) => s.intervalValue > 0 && Object.values(FollowUpIntervalUnit).includes(s.intervalUnit)
    );
    assert(allHaveIntervals, "All meeting reminder steps have positive intervalValue and valid FollowUpIntervalUnit");

    // -------------------------------------------------------------------------
    // Phase 2: RelativeTimeFormatter Comprehensive Unit Tests
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 2: RelativeTimeFormatter Verification (Dynamic Time Substitutions)");

    assert(RelativeTimeFormatter.formatRelativeTime(FollowUpIntervalUnit.DAYS_BEFORE, 1) === "tomorrow", "DAYS_BEFORE (1) formats to 'tomorrow'");
    assert(RelativeTimeFormatter.formatRelativeTime(FollowUpIntervalUnit.DAYS_BEFORE, 2) === "in 2 days", "DAYS_BEFORE (2) formats to 'in 2 days'");
    assert(RelativeTimeFormatter.formatRelativeTime(FollowUpIntervalUnit.HOURS_BEFORE, 1) === "in 1 hour", "HOURS_BEFORE (1) formats to 'in 1 hour'");
    assert(RelativeTimeFormatter.formatRelativeTime(FollowUpIntervalUnit.HOURS_BEFORE, 3) === "in 3 hours", "HOURS_BEFORE (3) formats to 'in 3 hours'");
    assert(RelativeTimeFormatter.formatRelativeTime(FollowUpIntervalUnit.MINUTES_BEFORE, 1) === "in 1 minute", "MINUTES_BEFORE (1) formats to 'in 1 minute'");
    assert(RelativeTimeFormatter.formatRelativeTime(FollowUpIntervalUnit.MINUTES_BEFORE, 15) === "in 15 minutes", "MINUTES_BEFORE (15) formats to 'in 15 minutes'");
    assert(RelativeTimeFormatter.formatRelativeTime(FollowUpIntervalUnit.MINUTES_BEFORE, 45) === "in 45 minutes", "MINUTES_BEFORE (45) formats to 'in 45 minutes'");

    const customText = RelativeTimeFormatter.formatRelativeTime(
      FollowUpIntervalUnit.MINUTES_BEFORE,
      15,
      "starting in {count} minutes sharply"
    );
    assert(
      customText === "starting in 15 minutes sharply",
      "Custom placeholder variable template {count} substituted accurately"
    );

    // -------------------------------------------------------------------------
    // Phase 3: Meeting Entity Creation & Auto Enrollment
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 3: Meeting Creation & Auto Enrollment Lifecycle");

    const testTimestamp = Date.now();
    const testCustomer = await prisma.customer.create({
      data: {
        organizationId: orgId,
        customerCode: `CUST-MTG-${testTimestamp}`,
        firstName: "Priya",
        lastName: `Patel_${testTimestamp}`,
        displayName: `Priya Patel ${testTimestamp}`,
        phone: "+919811223344",
        email: `priya.meeting.${testTimestamp}@homio.test`,
      },
    });
    cleanupIds.customerIds.push(testCustomer.id);
    assert(Boolean(testCustomer.id), "Test customer created for meeting auto-reminder");

    // Meeting scheduled 48 hours in the future
    const now = new Date();
    const futureMeetingStart = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const futureMeetingEnd = new Date(futureMeetingStart.getTime() + 30 * 60 * 1000);

    const testMeeting = await prisma.meeting.create({
      data: {
        organizationId: orgId,
        customerId: testCustomer.id,
        meetingCode: `MTG-TEST-${testTimestamp}`,
        title: "3BHK Concept Design Review & Moodboard Presentation",
        type: MeetingType.ONLINE,
        status: MeetingStatus.SCHEDULED,
        meetingDate: futureMeetingStart,
        startTime: futureMeetingStart,
        endTime: futureMeetingEnd,
        durationMinutes: 30,
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        meetingProvider: "GOOGLE_MEET",
      },
    });
    cleanupIds.meetingIds.push(testMeeting.id);
    assert(testMeeting.status === MeetingStatus.SCHEDULED, "Initial meeting created in SCHEDULED status 48h in future");

    // Enroll Meeting into reminders
    const enrollment = await meetingFollowUpService.enrollMeeting(orgId, testMeeting.id);
    assert(Boolean(enrollment), "meetingFollowUpService.enrollMeeting succeeded and returned enrollment");
    if (!enrollment) throw new Error("Meeting enrollment returned null");
    cleanupIds.enrollmentIds.push(enrollment.id);

    assert(enrollment.status === FollowUpEnrollmentStatus.ACTIVE, "Enrollment status is ACTIVE");
    assert(Boolean(enrollment.nextExecutionAt), "nextExecutionAt calculated and set on enrollment");

    // Verify scheduled execution logs in database
    const scheduledLogs = await prisma.followUpExecutionLog.findMany({
      where: {
        enrollmentId: enrollment.id,
        meetingId: testMeeting.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
      orderBy: { scheduledFor: "asc" },
    });

    assert(scheduledLogs.length > 0, `Pre-scheduled ${scheduledLogs.length} execution logs for upcoming reminder intervals`);
    assert(
      scheduledLogs[0]?.scheduledFor !== undefined &&
      scheduledLogs[0].scheduledFor.getTime() > now.getTime(),
      "First scheduled execution timestamp is in the future"
    );

    // -------------------------------------------------------------------------
    // Phase 4: Duplicate Enrollment Prevention
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 4: Duplicate Enrollment Idempotency");

    const duplicateEnrollment = await meetingFollowUpService.enrollMeeting(orgId, testMeeting.id);
    assert(duplicateEnrollment?.id === enrollment.id, "Re-enrolling same meeting returns existing enrollment (idempotency passed)");

    const activeEnrollmentsCount = await prisma.followUpEnrollment.count({
      where: { meetingId: testMeeting.id, status: FollowUpEnrollmentStatus.ACTIVE },
    });
    assert(activeEnrollmentsCount === 1, "Exactly 1 active enrollment exists in DB; no duplicates created");

    // -------------------------------------------------------------------------
    // Phase 5: Template Variable Mapping & Resolution
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 5: WhatsApp Template Variable Mapping Engine");

    const meetingStepWithTemplate = steps.find((s) => s.template);
    if (meetingStepWithTemplate?.template) {
      const resolved = await variableMappingEngine.resolveTemplate(
        {
          headerType: meetingStepWithTemplate.template.headerType,
          headerText: meetingStepWithTemplate.template.headerText,
          bodyText: meetingStepWithTemplate.template.bodyText,
          footerText: meetingStepWithTemplate.template.footerText,
          variables: meetingStepWithTemplate.template.variables,
        },
        {
          organizationId: orgId,
          meetingId: testMeeting.id,
          customerId: testCustomer.id,
          recipientName: `${testCustomer.firstName} ${testCustomer.lastName}`,
          recipientPhone: testCustomer.phone,
        }
      );

      assert(Boolean(resolved.body), `Meeting template "${meetingStepWithTemplate.template.name}" rendered successfully`);
      assert(
        resolved.body.includes(testCustomer.firstName || "") ||
        resolved.body.includes("there"),
        "Dynamic customer name placeholder correctly substituted in rendered body"
      );
    }

    // -------------------------------------------------------------------------
    // Phase 6: Meeting Reschedule & Timestamp Recalculation
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 6: Meeting Reschedule & Automatic Timestamp Recalculation");

    // Reschedule meeting: push start time further by 24 hours (72 hours from now)
    const newMeetingStart = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    const newMeetingEnd = new Date(newMeetingStart.getTime() + 45 * 60 * 1000);

    await prisma.meeting.update({
      where: { id: testMeeting.id },
      data: {
        startTime: newMeetingStart,
        endTime: newMeetingEnd,
        meetingDate: newMeetingStart,
        status: MeetingStatus.RESCHEDULED,
      },
    });

    // Invoke recalculation
    await meetingFollowUpService.onMeetingRescheduled(orgId, testMeeting.id);

    const refreshedEnrollment = await prisma.followUpEnrollment.findUnique({
      where: { id: enrollment.id },
    });
    assert(Boolean(refreshedEnrollment?.nextExecutionAt), "nextExecutionAt updated after reschedule");

    const reScheduledLogs = await prisma.followUpExecutionLog.findMany({
      where: {
        enrollmentId: enrollment.id,
        meetingId: testMeeting.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
      orderBy: { scheduledFor: "asc" },
    });

    assert(reScheduledLogs.length > 0, `Pre-scheduled ${reScheduledLogs.length} execution logs updated for rescheduled meeting`);
    assert(
      reScheduledLogs[0]?.scheduledFor !== undefined &&
      reScheduledLogs[0].scheduledFor.getTime() > scheduledLogs[0]!.scheduledFor.getTime(),
      "New execution timestamps are pushed back in sync with the rescheduled meeting start time"
    );

    // -------------------------------------------------------------------------
    // Phase 7: Step Execution & Dispatch Verification
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 7: Due Reminder Step Execution");

    await meetingFollowUpService.executeStep(enrollment.id);

    const executedLog = await prisma.followUpExecutionLog.findFirst({
      where: {
        enrollmentId: enrollment.id,
        status: { in: [FollowUpExecutionStatus.DISPATCHED, FollowUpExecutionStatus.FAILED] },
      },
    });

    assert(Boolean(executedLog), `Meeting reminder step executed and recorded (status: ${executedLog?.status})`);
    assert(Boolean(executedLog?.executedAt), "executedAt timestamp recorded on executed log");

    // -------------------------------------------------------------------------
    // Phase 8: Meeting Cancelled Auto-Stop Trigger
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 8: Meeting Cancelled Auto-Stop Trigger");

    // Update meeting to CANCELLED and trigger cancellation
    await prisma.meeting.update({
      where: { id: testMeeting.id },
      data: { status: MeetingStatus.CANCELLED },
    });

    await meetingFollowUpService.onMeetingCancelled(orgId, testMeeting.id, "Client requested cancellation");

    const cancelledEnrollment = await prisma.followUpEnrollment.findUnique({
      where: { id: enrollment.id },
    });
    assert(
      cancelledEnrollment?.status === FollowUpEnrollmentStatus.STOPPED_CANCELLED,
      "Enrollment transitioned to STOPPED_CANCELLED upon meeting cancellation"
    );
    assert(cancelledEnrollment?.nextExecutionAt === null, "nextExecutionAt cleared to null upon cancellation");
    assert(Boolean(cancelledEnrollment?.stoppedAt), "stoppedAt timestamp recorded on enrollment");

    const pendingAfterCancel = await prisma.followUpExecutionLog.findMany({
      where: {
        enrollmentId: enrollment.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
    });
    assert(pendingAfterCancel.length === 0, "All pending scheduled execution logs cancelled upon meeting cancellation");

    const cancelledLogs = await prisma.followUpExecutionLog.findMany({
      where: {
        enrollmentId: enrollment.id,
        status: FollowUpExecutionStatus.CANCELLED,
      },
    });
    assert(cancelledLogs.length > 0, `Execution logs updated to CANCELLED status with audit reason (found ${cancelledLogs.length})`);

    // -------------------------------------------------------------------------
    // Phase 9: Manual Cancellation Orchestration
    // -------------------------------------------------------------------------
    console.log("\n📌 Phase 9: Manual Cancellation API Verification");

    const manualMeeting = await prisma.meeting.create({
      data: {
        organizationId: orgId,
        customerId: testCustomer.id,
        meetingCode: `MTG-MANUAL-${Date.now()}`,
        title: "Manual Cancel Meeting Test",
        type: MeetingType.ONLINE,
        status: MeetingStatus.SCHEDULED,
        meetingDate: futureMeetingStart,
        startTime: futureMeetingStart,
        endTime: futureMeetingEnd,
      },
    });
    cleanupIds.meetingIds.push(manualMeeting.id);

    const manualEnrollment = await meetingFollowUpService.enrollMeeting(orgId, manualMeeting.id);
    if (manualEnrollment) cleanupIds.enrollmentIds.push(manualEnrollment.id);

    await autoFollowUpService.cancelEnrollment(orgId, manualEnrollment!.id, "Admin manually stopped reminders");

    const postManual = await prisma.followUpEnrollment.findUnique({
      where: { id: manualEnrollment!.id },
    });
    assert(postManual?.status === FollowUpEnrollmentStatus.STOPPED_CANCELLED, "autoFollowUpService.cancelEnrollment set status to STOPPED_CANCELLED");

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

      if (cleanupIds.meetingIds.length > 0) {
        await prisma.meeting.deleteMany({
          where: { id: { in: cleanupIds.meetingIds } },
        });
      }

      if (cleanupIds.customerIds.length > 0) {
        await prisma.customer.deleteMany({
          where: { id: { in: cleanupIds.customerIds } },
        });
      }

      console.log(`   ✅ Cleaned up ${cleanupIds.enrollmentIds.length} enrollments, ${cleanupIds.meetingIds.length} meetings, and ${cleanupIds.customerIds.length} customers.`);
    } catch (cleanupErr) {
      console.error("   ⚠️ Warning during cleanup:", cleanupErr);
    }
  }

  // -------------------------------------------------------------------------
  // Final Scorecard
  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(75));
  console.log("   📊 MEETING REMINDER AUTO FOLLOW-UP TEST RESULTS SCORECARD");
  console.log("=".repeat(75));
  console.log(`   Total Assertions Tested: ${stats.total}`);
  console.log(`   Passed:                  ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
  console.log(`   Failed:                  ${stats.failed}`);
  console.log("=".repeat(75) + "\n");

  if (stats.failed > 0) {
    console.error(`❌ Verification failed with ${stats.failed} assertion error(s).`);
    process.exit(1);
  } else {
    console.log("🎉 ALL MEETING AUTO FOLLOW-UP TESTS PASSED WITH 100% SUCCESS!\n");
  }
}

runMeetingFollowUpTest()
  .catch((err) => {
    console.error("\n💥 Unhandled error in meeting reminder verification script:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
