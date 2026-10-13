import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { LabourDisputeService } from "../../src/module/labour/services/labour-dispute.service.js";
import { labourDisputeRepo } from "../../src/module/labour/repos/labour-dispute.repo.js";
import { prisma } from "../../src/lib/prisma.js";

describe("Labour Dispute Service - Platform Governance Actions Tests", () => {
  const service = new LabourDisputeService();

  const mockDisputeId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const mockBookingId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  const mockLabourId = "l0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
  const mockClientId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

  const origUserFindUnique = prisma.user.findUnique;
  const origUserUpdate = prisma.user.update;
  const origLabourFindUnique = prisma.labour.findUnique;
  const origLabourUpdate = prisma.labour.update;
  const origBookingFindUnique = prisma.labourBooking.findUnique;
  const origBookingUpdate = prisma.labourBooking.update;

  beforeEach(() => {
    spyOn(labourDisputeRepo, "findById").mockResolvedValue({
      id: mockDisputeId,
      labourId: mockLabourId,
      bookingId: mockBookingId,
      disputeType: "NON_PAYMENT",
      status: "OPEN",
      initiator: "LABOUR",
      reason: "Client refused to pay daily wages after work completed",
      booking: {
        id: mockBookingId,
        clientId: mockClientId,
      },
      additionalInformation: {},
    } as any);

    spyOn(labourDisputeRepo, "update").mockImplementation((id: string, data: any) => {
      return Promise.resolve({
        id,
        ...data,
      } as any);
    });

    prisma.user.findUnique = (async () => ({
      id: mockClientId,
      clientRating: 5.0,
      isBlacklisted: false,
    })) as any;

    prisma.user.update = (async (_args: any) => ({
      id: mockClientId,
      ..._args.data,
    })) as any;

    prisma.labour.findUnique = (async () => ({
      id: mockLabourId,
      averageRating: 4.8,
      warningCount: 0,
      isBlacklisted: false,
      isAvailable: true,
      status: "ACTIVE",
      additionalInformation: {},
    })) as any;

    prisma.labour.update = (async (_args: any) => ({
      id: mockLabourId,
      ..._args.data,
    })) as any;

    prisma.labourBooking.findUnique = (async () => ({
      id: mockBookingId,
      clientId: mockClientId,
      labourId: mockLabourId,
      additionalInformation: {},
    })) as any;

    prisma.labourBooking.update = (async (_args: any) => ({
      id: mockBookingId,
      ..._args.data,
    })) as any;
  });

  afterEach(() => {
    prisma.user.findUnique = origUserFindUnique;
    prisma.user.update = origUserUpdate;
    prisma.labour.findUnique = origLabourFindUnique;
    prisma.labour.update = origLabourUpdate;
    prisma.labourBooking.findUnique = origBookingFindUnique;
    prisma.labourBooking.update = origBookingUpdate;
  });

  it("1. CLIENT_RATING_DOWN: updates client rating and records action on dispute", async () => {
    let updatedUserRating: number | undefined;
    prisma.user.update = (async (args: any) => {
      updatedUserRating = args.data.clientRating;
      return { id: mockClientId, clientRating: args.data.clientRating };
    }) as any;

    const result = await service.takeDisputeAction(
      mockDisputeId,
      {
        action: "CLIENT_RATING_DOWN",
        clientRating: 3.5,
        notes: "Unpaid dues default reported and validated",
      },
      "admin-user-uuid"
    );

    expect(result.actionTaken).toBe("CLIENT_RATING_DOWN");
    expect(updatedUserRating).toBe(3.5);
    const actionDetails = (result.additionalInformation as any)?.actionDetails;
    expect(actionDetails?.action).toBe("CLIENT_RATING_DOWN");
    expect(actionDetails?.newRating).toBe(3.5);
    expect(actionDetails?.previousRating).toBe(5.0);
  });

  it("2. CLIENT_BLACKLISTED: blacklists client user and records reason", async () => {
    let blacklistedUser: any;
    prisma.user.update = (async (args: any) => {
      blacklistedUser = args.data;
      return { id: mockClientId, ...args.data };
    }) as any;

    const result = await service.takeDisputeAction(
      mockDisputeId,
      {
        action: "CLIENT_BLACKLISTED",
        blacklistReason: "Repeated non-payment default and abuse of dispute mediation",
      },
      "admin-user-uuid"
    );

    expect(result.actionTaken).toBe("CLIENT_BLACKLISTED");
    expect(blacklistedUser?.isBlacklisted).toBe(true);
    expect(blacklistedUser?.blacklistReason).toContain("Repeated non-payment default");
    expect(blacklistedUser?.blacklistedAt).toBeDefined();
    expect((result.additionalInformation as any)?.actionDetails?.action).toBe("CLIENT_BLACKLISTED");
  });

  it("3. LABOUR_WARNED: increments worker warning count and attaches warning to booking", async () => {
    let updatedLabour: any;
    prisma.labour.update = (async (args: any) => {
      updatedLabour = args.data;
      return { id: mockLabourId, ...args.data };
    }) as any;

    let updatedBooking: any;
    prisma.labourBooking.update = (async (args: any) => {
      updatedBooking = args.data;
      return { id: mockBookingId, ...args.data };
    }) as any;

    const result = await service.takeDisputeAction(
      mockDisputeId,
      {
        action: "LABOUR_WARNED",
        warningMessage: "Warning: Unacceptable conduct on client job site.",
      },
      "admin-user-uuid"
    );

    expect(result.actionTaken).toBe("LABOUR_WARNED");
    expect(updatedLabour?.warningCount).toBe(1);
    expect((updatedBooking?.additionalInformation as any)?.labourWarning?.message).toContain("Unacceptable conduct");
    expect((result.additionalInformation as any)?.actionDetails?.action).toBe("LABOUR_WARNED");
    expect((result.additionalInformation as any)?.actionDetails?.warningCount).toBe(1);
  });

  it("4. LABOUR_BLACKLISTED: marks worker profile as blacklisted and unavailable", async () => {
    let updatedLabour: any;
    prisma.labour.update = (async (args: any) => {
      updatedLabour = args.data;
      return { id: mockLabourId, ...args.data };
    }) as any;

    const result = await service.takeDisputeAction(
      mockDisputeId,
      {
        action: "LABOUR_BLACKLISTED",
        blacklistReason: "Severe safety violation and unauthorized property damage",
      },
      "admin-user-uuid"
    );

    expect(result.actionTaken).toBe("LABOUR_BLACKLISTED");
    expect(updatedLabour?.isBlacklisted).toBe(true);
    expect(updatedLabour?.isAvailable).toBe(false);
    expect(updatedLabour?.status).toBe("BLACKLISTED");
    expect(updatedLabour?.blacklistReason).toContain("Severe safety violation");
    expect((result.additionalInformation as any)?.actionDetails?.action).toBe("LABOUR_BLACKLISTED");
  });

  it("5. LABOUR_RATING_DOWN: penalizes labour average rating", async () => {
    let updatedLabour: any;
    prisma.labour.update = (async (args: any) => {
      updatedLabour = args.data;
      return { id: mockLabourId, ...args.data };
    }) as any;

    const result = await service.takeDisputeAction(
      mockDisputeId,
      {
        action: "LABOUR_RATING_DOWN",
        ratingDeduction: 1.0,
      },
      "admin-user-uuid"
    );

    expect(result.actionTaken).toBe("LABOUR_RATING_DOWN");
    expect(updatedLabour?.averageRating).toBe(3.8); // 4.8 - 1.0
    expect((result.additionalInformation as any)?.actionDetails?.action).toBe("LABOUR_RATING_DOWN");
    expect((result.additionalInformation as any)?.actionDetails?.previousRating).toBe(4.8);
    expect((result.additionalInformation as any)?.actionDetails?.newRating).toBe(3.8);
  });

  it("6. LEGAL_ACTION: records lawyer assignment, statutory notice, and Labour Court filing", async () => {
    const hearingDate = new Date("2026-11-20T10:00:00.000Z");
    const noticeDate = new Date("2026-10-15T00:00:00.000Z");
    const courtDate = new Date("2026-10-18T00:00:00.000Z");

    const result = await service.takeDisputeAction(
      mockDisputeId,
      {
        action: "LEGAL_ACTION",
        lawyerAssigned: true,
        lawyerName: "K. R. Venkatraman",
        lawyerPhone: "+91 98450 12345",
        lawyerBarCouncilNo: "KAR/1429/2012",
        legalNoticeSent: true,
        legalNoticeDate: noticeDate,
        labourCourtFiled: true,
        labourCourtCaseNo: "LC-BLR-2026-0891",
        labourCourtDate: courtDate,
        hearingDate,
      },
      "admin-user-uuid"
    );

    expect(result.actionTaken).toBe("LEGAL_ACTION");
    expect(result.lawyerAssigned).toBe(true);
    expect(result.lawyerName).toBe("K. R. Venkatraman");
    expect(result.lawyerPhone).toBe("+91 98450 12345");
    expect(result.lawyerBarCouncilNo).toBe("KAR/1429/2012");
    expect(result.legalNoticeSent).toBe(true);
    expect(result.labourCourtFiled).toBe(true);
    expect(result.labourCourtCaseNo).toBe("LC-BLR-2026-0891");
    expect(result.status).toBe("LABOUR_COURT_FILED");
    expect((result.additionalInformation as any)?.actionDetails?.action).toBe("LEGAL_ACTION");
    expect((result.additionalInformation as any)?.actionDetails?.lawyerName).toBe("K. R. Venkatraman");
    expect((result.additionalInformation as any)?.actionDetails?.labourCourtCaseNo).toBe("LC-BLR-2026-0891");
  });
});
