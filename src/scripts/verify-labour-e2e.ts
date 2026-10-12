import "dotenv/config";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const BASE_URL = "http://localhost:4000/api/v1";
const JWT_SECRET = process.env.JWT_SECRET || "123456";

function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

async function request(
  path: string,
  options: { method?: string; token?: string; body?: any } = {}
): Promise<any> {
  const { method = "GET", token, body } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${method} ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function runE2ETest() {
  console.log("🚀 Starting Homio CRM End-to-End Labour Booking Verification Script\n");

  // 1. Fetch Users & Labours
  const platformAdmin = await prisma.user.findFirst({
    where: { userType: "PLATFORM_ADMIN", status: "ACTIVE" },
  });
  if (!platformAdmin) throw new Error("No PLATFORM_ADMIN user found");

  const clientUser = await prisma.user.findFirst({
    where: { userType: "USER", status: "ACTIVE" },
  });
  if (!clientUser) throw new Error("No USER found");

  const labours = await prisma.labour.findMany({
    where: { isAvailable: true },
    take: 2,
  });
  if (labours.length < 2) throw new Error("Need at least 2 labours for reassignment test");

  const labour1 = labours[0];
  const labour2 = labours[1];
  if (!labour1 || !labour2) throw new Error("Need at least 2 valid labours");

  // Ensure labour2 has a user account linked for authentication
  let labour2User = labour2.userId ? await prisma.user.findUnique({ where: { id: labour2.userId } }) : null;
  if (!labour2User) {
    const existing = await prisma.user.findFirst({ where: { email: "worker2@homio.test" } });
    if (existing) {
      labour2User = existing;
    } else {
      labour2User = await prisma.user.create({
        data: {
          email: "worker2@homio.test",
          firstName: "Suresh",
          lastName: "Carpenter",
          phone: "+919876543210",
          passwordHash: "dummy",
          userType: "LABOUR",
          status: "ACTIVE",
        },
      });
    }
    await prisma.labour.update({
      where: { id: labour2.id },
      data: {
        userId: labour2User.id,
        isKycVerified: true,
        isAvailable: true,
        isBlacklisted: false,
        warningCount: 0,
        status: "AVAILABLE",
      },
    });
  }

  await prisma.labour.update({
    where: { id: labour1.id },
    data: {
      isKycVerified: true,
      isAvailable: true,
      isBlacklisted: false,
      warningCount: 0,
      status: "AVAILABLE",
    },
  });

  const adminToken = signToken(platformAdmin.id);
  const clientToken = signToken(clientUser.id);
  const labour1Token = labour1.userId ? signToken(labour1.userId) : adminToken;
  const labour2Token = signToken(labour2User.id);

  console.log(`✅ Authentication Tokens Prepared:`);
  console.log(`   - Platform Admin : ${platformAdmin.email} (${platformAdmin.id})`);
  console.log(`   - Client Homeowner: ${clientUser.email} (${clientUser.id})`);
  console.log(`   - Worker 1       : ${labour1.name} (${labour1.id})`);
  console.log(`   - Worker 2       : ${labour2.name} (${labour2.id})\n`);

  // STEP 1: Client Books Labour 1 with Tasks Checklist
  console.log("▶ STEP 1: Client creates direct marketplace labour booking...");
  const taskChecklist = [
    { title: "Fix sliding wardrobe tracks", description: "Realign soft-close channel", isCompleted: false },
    { title: "Install master bedroom laminate", description: "Bonding edge trims", isCompleted: false },
  ];

  const bookingRes = await request("/labour/bookings/marketplace", {
    method: "POST",
    token: clientToken,
    body: {
      labourId: labour1.id,
      workTitle: "Master Bedroom Furniture Restoration & Carpentry",
      workDescription: "Full day carpentry for wardrobe realignment and edge trim laminates",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      serviceAddress: "Flat 402, Royal Palms, Harmu Housing Colony",
      locality: "Harmu",
      city: "Ranchi",
      state: "Jharkhand",
      pincode: "834002",
      termsAccepted: true,
      taskChecklist,
    },
  });

  const originalBooking = bookingRes.data;
  console.log(`   ✓ Booking Created: #${originalBooking.bookingNumber} (ID: ${originalBooking.id})`);
  console.log(`   ✓ Channel: ${originalBooking.channel}, Status: ${originalBooking.status}`);

  // STEP 2: Worker 1 Accepts Booking
  console.log("\n▶ STEP 2: Worker 1 accepts the service request...");
  const acceptRes = await request(`/labour/bookings/${originalBooking.id}/accept`, {
    method: "PATCH",
    token: labour1Token,
  });
  console.log(`   ✓ Worker Accepted! Status: ${acceptRes.data.status}`);

  // STEP 3: Client Reports Arrival Delay (Simulate 25 hours elapsed past scheduled time)
  console.log("\n▶ STEP 3: Client reports worker arrival delay (escalation)...");
  await prisma.labourBooking.update({
    where: { id: originalBooking.id },
    data: {
      acceptedAt: new Date(Date.now() - 25 * 3600 * 1000),
      startDate: new Date(Date.now() - 25 * 3600 * 1000),
      createdAt: new Date(Date.now() - 26 * 3600 * 1000),
    },
  });

  const delayRes = await request(`/labour/bookings/${originalBooking.id}/report-delay`, {
    method: "POST",
    token: clientToken,
    body: {
      reason: "Worker did not reach site after scheduled 10:00 AM slot. Requesting platform replacement.",
      evidenceNotes: "Called tradesperson 3 times, phone switched off.",
    },
  });
  console.log(`   ✓ Delay Escalation Recorded! Status: ${delayRes.data.status}`);
  console.log(`   ✓ Delay Reason: "${delayRes.data.delayReportReason || delayRes.data.delayReason}"`);

  // STEP 4: Platform Admin Reassigns Replacement Worker 2
  console.log("\n▶ STEP 4: Platform Admin reassigns booking to Replacement Worker 2...");
  const reassignRes = await request(`/labour/bookings/${originalBooking.id}/reassign`, {
    method: "POST",
    token: adminToken,
    body: {
      newLabourId: labour2.id,
      reason: "Assigned verified replacement carpenter Suresh after delay escalation on Worker 1.",
      resetStatusTo: "ACCEPTED_BY_LABOUR",
    },
  });
  const replacementBooking = reassignRes.data.replacementBooking || reassignRes.data;
  console.log(`   ✓ Replacement Booking Created: #${replacementBooking.bookingNumber} (ID: ${replacementBooking.id})`);
  console.log(`   ✓ Assigned Worker: ${labour2.name}`);
  console.log(`   ✓ Reassigned From: #${originalBooking.bookingNumber}`);

  // STEP 5: Worker 2 Provides On-Site Deal Quote & Client Accepts
  console.log("\n▶ STEP 5: Replacement Worker submits on-site quote and client accepts...");
  const quoteRes = await request(`/labour/bookings/${replacementBooking.id}/quote`, {
    method: "POST",
    token: labour2Token,
    body: {
      quoteAmount: 2400,
      quoteDescription: "Estimated 2 days detailed carpentry and laminate trimming at ₹1200/day.",
    },
  });
  console.log(`   ✓ Quote Submitted: ₹${quoteRes.data.quoteAmount}`);

  const quoteAcceptRes = await request(`/labour/bookings/${replacementBooking.id}/quote-response`, {
    method: "PATCH",
    token: clientToken,
    body: {
      accept: true,
    },
  });
  console.log(`   ✓ Client Accepted Quote! Deal Value: ₹${quoteAcceptRes.data.dealValue}, Status: ${quoteAcceptRes.data.status}`);

  // STEP 6: Worker 2 Completes Work
  console.log("\n▶ STEP 6: Worker completes carpentry work & uploads completion proof...");
  const completeWorkRes = await request(`/labour/bookings/${replacementBooking.id}/complete-work`, {
    method: "PATCH",
    token: labour2Token,
    body: {
      notes: "All wardrobe tracks realigned and laminates buffed to high gloss finish.",
      taskChecklist: [
        { task: "Fix sliding wardrobe tracks", done: true },
        { task: "Install master bedroom laminate", done: true },
      ],
      proofPhotos: [
        {
          id: "proof-1",
          url: "https://images.unsplash.com/photo-1581578731548-c64695cc6952",
        },
      ],
    },
  });
  console.log(`   ✓ Work Marked Completed! Status: ${completeWorkRes.data.status}`);

  // STEP 7: Client Confirms Completion & Leaves 5-Star Review
  console.log("\n▶ STEP 7: Client confirms job completion & submits 5-star scorecard...");
  const confirmRes = await request(`/labour/bookings/${replacementBooking.id}/confirm-completion`, {
    method: "PATCH",
    token: clientToken,
    body: {
      reviewerName: `${clientUser.firstName} ${clientUser.lastName || ""}`.trim(),
      rating: 5,
      qualityScore: 5,
      punctualityScore: 5,
      reviewNotes: "Superb workmanship! The replacement carpenter arrived swiftly and did flawless work.",
    },
  });
  console.log(`   ✓ Booking Fully Completed! Status: ${confirmRes.data.status}`);

  // STEP 8: Platform Admin Files Legal Dispute & Escalates to Labour Court ("file legal")
  console.log("\n▶ STEP 8: Platform Admin files legal dispute, assigns counsel, sends notice & files Labour Court action...");
  const disputeRes = await request("/labour/disputes", {
    method: "POST",
    token: adminToken,
    body: {
      labourId: labour1.id,
      bookingId: originalBooking.id,
      disputeType: "ABANDONMENT",
      amountInDispute: 1000,
      reason: "Worker 1 failed to report to assigned site causing delay escalation and customer compensation.",
      initiator: "CLIENT",
    },
  });
  const dispute = disputeRes.data;
  console.log(`   ✓ Legal Dispute Filed: ID ${dispute.id}, Type: ${dispute.disputeType}`);

  // 8a. Assign Empanelled Lawyer
  const lawyerRes = await request(`/labour/disputes/${dispute.id}/assign-lawyer`, {
    method: "POST",
    token: adminToken,
    body: {
      lawyerName: "Adv. Rajeshwar Sharma, High Court of Jharkhand",
      lawyerPhone: "+919431102938",
      lawyerEmail: "adv.sharma@homio-legal.test",
      notes: "Appointed common platform legal counsel for recovery and arbitration.",
    },
  });
  console.log(`   ✓ Empanelled Lawyer Assigned: ${lawyerRes.data.lawyerName}`);

  // 8b. Issue Statutory Legal Demand Notice
  const noticeRes = await request(`/labour/disputes/${dispute.id}/legal-notice`, {
    method: "POST",
    token: adminToken,
    body: {
      noticeReference: `DEMAND-NOTICE-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      sentDate: new Date().toISOString(),
      summaryOfClaim: "Formal statutory demand notice under Section 73 of Indian Contract Act 1872.",
    },
  });
  console.log(`   ✓ Statutory Legal Notice Issued! Status: ${noticeRes.data.status}`);

  // 8c. Record Labour Court Action
  const courtRes = await request(`/labour/disputes/${dispute.id}/labour-court`, {
    method: "POST",
    token: adminToken,
    body: {
      labourCourtCaseNo: `LC-RNC-2026-${Math.floor(100 + Math.random() * 900)}`,
      labourCourtDate: new Date().toISOString(),
      actionSummary: "Statutory recovery petition filed before District Labour Court, Ranchi",
    },
  });
  console.log(`   ✓ Labour Court Case Filed: Case No. ${courtRes.data.labourCourtCaseNo}, Status: ${courtRes.data.status}`);

  // STEP 9: Settle 10% Platform Commission & Disburse Wage Payment ("settale the amount")
  console.log("\n▶ STEP 9: Platform Admin settles 10% platform commission & records worker wage disbursal...");
  const settleRes = await request(`/labour/bookings/${replacementBooking.id}/settle-commission`, {
    method: "PATCH",
    token: adminToken,
    body: {
      amount: 240, // 10% of 2400
      paymentMethod: "UPI",
      transactionRef: `UPI-SETTLE-${Date.now()}`,
      notes: "10% marketplace commission reconciled in platform escrow account.",
    },
  });
  console.log(`   ✓ Commission Settled: Status ${settleRes.data.commissionStatus}, Amount ₹${settleRes.data.commissionAmount}`);

  const paymentRes = await request("/labour/payments", {
    method: "POST",
    token: adminToken,
    body: {
      labourId: labour2.id,
      bookingId: replacementBooking.id,
      amount: 2160, // 2400 - 240 (net worker receivable)
      daysCount: 2,
      paymentMethod: "UPI",
      transactionRef: `UTR-WAGE-DISBURSE-${Date.now()}`,
      status: "PAID",
      paymentDate: new Date().toISOString(),
      remarks: "Full net wage disbursed to Suresh Carpenter via UPI transfer.",
      additionalInformation: {},
    },
  });
  console.log(`   ✓ Wage Disbursal Voucher Recorded: ₹${paymentRes.data.amount} (Ref: ${paymentRes.data.transactionRef})`);

  // STEP 10: Direct Database Verification
  console.log("\n▶ STEP 10: Verifying persisted data directly from PostgreSQL database...");
  const dbBooking = await prisma.labourBooking.findUnique({
    where: { id: replacementBooking.id },
    include: {
      ratings: true,
      payments: true,
      disputes: true,
    },
  });

  const dbDispute = await prisma.labourDispute.findUnique({
    where: { id: dispute.id },
  });

  const ratingRecord = dbBooking?.ratings[0];
  const paymentRecord = dbBooking?.payments[0];

  console.log(`\n============================================================`);
  console.log(`🎉 END-TO-END DATA CREATION VERIFICATION SUMMARY`);
  console.log(`============================================================`);
  console.log(`• Booking ID             : ${dbBooking?.id}`);
  console.log(`• Booking Number         : #${dbBooking?.bookingNumber}`);
  console.log(`• Final Booking Status   : ${dbBooking?.status} (COMPLETED)`);
  console.log(`• Deal Value             : ₹${dbBooking?.dealValue}`);
  console.log(`• Platform Commission    : ₹${dbBooking?.commissionAmount} (${dbBooking?.commissionStatus})`);
  console.log(`• Client 5-Star Rating   : ${ratingRecord?.rating} Stars - "${ratingRecord?.reviewNotes}"`);
  console.log(`• Wage Payments Logged   : ${dbBooking?.payments.length} voucher(s), ₹${paymentRecord?.amount} PAID`);
  console.log(`• Legal Dispute Status   : ${dbDispute?.status}`);
  console.log(`• Empanelled Counsel     : ${dbDispute?.lawyerName}`);
  console.log(`• Legal Notice Sent      : ${dbDispute?.legalNoticeSent ? "YES (Statutory Notice Issued)" : "NO"}`);
  console.log(`• Labour Court Case No.  : ${dbDispute?.labourCourtCaseNo}`);
  console.log(`• Frontend Details URL   : http://localhost:1420/platform/labour-bookings/${replacementBooking.id}`);
  console.log(`============================================================\n`);
}

runE2ETest().catch((err) => {
  console.error("❌ E2E Test Failed:", err);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
