import { describe, it, expect } from "bun:test";
import {
  createMeetingSchema,
  updateMeetingSchema,
  updateMeetingStatusSchema,
  rescheduleMeetingSchema,
  updateMeetingMomSchema,
  addMeetingAttendeeSchema,
  updateMeetingAttendeeSchema,
  getMeetingsQuerySchema,
  getMeetingCalendarQuerySchema,
  uploadMeetingDocumentSchema,
} from "../../src/module/leads-crm/validators/meeting.validator";
import {
  MOCK_LEAD_ID,
  MOCK_CUSTOMER_ID,
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_EMPLOYEE_ID_2,
  MOCK_MEETING_ID,
  MOCK_ATTENDEE_ID,
  sampleOnlineMeetingPayload,
  sampleSiteVisitMeetingPayload,
} from "./fixtures/crm.fixtures";

describe("Meetings API Quality Test Suite (Areas 1 - 5)", () => {
  // =========================================================================
  // Area 1: Meeting Lifecycle & State Transitions
  // =========================================================================
  describe("Area 1: Meeting Lifecycle & State Transitions", () => {
    it("should accept valid meeting status transitions (SCHEDULED -> IN_PROGRESS -> COMPLETED)", () => {
      const scheduledRes = updateMeetingStatusSchema.safeParse({
        params: { id: MOCK_MEETING_ID },
        body: { status: "SCHEDULED" },
      });
      expect(scheduledRes.success).toBe(true);

      const inProgressRes = updateMeetingStatusSchema.safeParse({
        params: { id: MOCK_MEETING_ID },
        body: { status: "IN_PROGRESS" },
      });
      expect(inProgressRes.success).toBe(true);

      const completedRes = updateMeetingStatusSchema.safeParse({
        params: { id: MOCK_MEETING_ID },
        body: { status: "COMPLETED" },
      });
      expect(completedRes.success).toBe(true);
      if (completedRes.success) {
        expect(completedRes.data.body.status).toBe("COMPLETED");
      }
    });

    it("should validate meeting cancellation with mandatory reason", () => {
      const cancelRes = updateMeetingStatusSchema.safeParse({
        params: { id: MOCK_MEETING_ID },
        body: {
          status: "CANCELLED",
          cancellationReason: "Client had an unexpected family emergency.",
        },
      });
      expect(cancelRes.success).toBe(true);
      if (cancelRes.success) {
        expect(cancelRes.data.body.status).toBe("CANCELLED");
        expect(cancelRes.data.body.cancellationReason).toBe(
          "Client had an unexpected family emergency."
        );
      }
    });

    it("should validate meeting rescheduling with new date-times and reason", () => {
      const reschedulePayload = {
        params: { id: MOCK_MEETING_ID },
        body: {
          meetingDate: "2026-09-30",
          startTime: "2026-09-30T11:00:00.000Z",
          endTime: "2026-09-30T12:00:00.000Z",
          reason: "Architect unavailable due to site milestone",
        },
      };

      const result = rescheduleMeetingSchema.safeParse(reschedulePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.meetingDate).toBe("2026-09-30");
        expect(result.data.body.reason).toBe(
          "Architect unavailable due to site milestone"
        );
      }
    });

    it("should reject invalid status names", () => {
      const invalidStatus = updateMeetingStatusSchema.safeParse({
        params: { id: MOCK_MEETING_ID },
        body: { status: "UNKNOWN_STATUS_TYPE" },
      });
      expect(invalidStatus.success).toBe(false);
    });

    it("should record NO_SHOW status for absent clients", () => {
      const noShowRes = updateMeetingStatusSchema.safeParse({
        params: { id: MOCK_MEETING_ID },
        body: { status: "NO_SHOW", outcomeNotes: "Client did not join online call after 15 mins." },
      });
      expect(noShowRes.success).toBe(true);
      if (noShowRes.success) {
        expect(noShowRes.data.body.status).toBe("NO_SHOW");
      }
    });
  });

  // =========================================================================
  // Area 2: Meeting Polymorphic Association & Types
  // =========================================================================
  describe("Area 2: Meeting Polymorphic Association & Types", () => {
    it("should successfully validate an ONLINE Google Meet meeting linked to a Lead", () => {
      const result = createMeetingSchema.safeParse({
        body: sampleOnlineMeetingPayload,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.type).toBe("ONLINE");
        expect(result.data.body.meetingProvider).toBe("GOOGLE_MEET");
        expect(result.data.body.leadId).toBe(MOCK_LEAD_ID);
        expect(result.data.body.attendees?.length).toBe(2);
      }
    });

    it("should successfully validate a SITE_VISIT meeting linked to a Customer with GPS coords", () => {
      const result = createMeetingSchema.safeParse({
        body: sampleSiteVisitMeetingPayload,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.type).toBe("SITE_VISIT");
        expect(result.data.body.customerId).toBe(MOCK_CUSTOMER_ID);
        expect(result.data.body.locationCoordinates?.lat).toBe(12.9352);
        expect(result.data.body.locationCoordinates?.lng).toBe(77.6944);
        expect(result.data.body.locationCity).toBe("Bengaluru");
      }
    });

    it("should validate meeting linked to a Project", () => {
      const projectMeeting = createMeetingSchema.safeParse({
        body: {
          title: "Project Kickoff & Milestone 1 Review",
          type: "OFFLINE",
          meetingDate: "2026-10-01",
          startTime: "2026-10-01T10:00:00.000Z",
          endTime: "2026-10-01T11:00:00.000Z",
          projectId: MOCK_PROJECT_ID,
          locationName: "Homio Design Studio, Indiranagar",
        },
      });
      expect(projectMeeting.success).toBe(true);
      if (projectMeeting.success) {
        expect(projectMeeting.data.body.projectId).toBe(MOCK_PROJECT_ID);
        expect(projectMeeting.data.body.type).toBe("OFFLINE");
      }
    });

    it("should reject invalid URL format for online meeting URL", () => {
      const invalidUrlRes = createMeetingSchema.safeParse({
        body: {
          ...sampleOnlineMeetingPayload,
          meetingUrl: "not-a-valid-http-url",
        },
      });
      expect(invalidUrlRes.success).toBe(false);
    });
  });

  // =========================================================================
  // Area 3: Meeting Attendee & RSVP Management
  // =========================================================================
  describe("Area 3: Meeting Attendee & RSVP Management", () => {
    it("should validate adding a new internal employee attendee", () => {
      const addAttendeeRes = addMeetingAttendeeSchema.safeParse({
        params: { id: MOCK_MEETING_ID },
        body: {
          employeeId: MOCK_EMPLOYEE_ID_2,
          name: "Priya Nair",
          email: "priya.nair@homio.in",
          role: "HOST",
        },
      });
      expect(addAttendeeRes.success).toBe(true);
      if (addAttendeeRes.success) {
        expect(addAttendeeRes.data.body.employeeId).toBe(MOCK_EMPLOYEE_ID_2);
        expect(addAttendeeRes.data.body.role).toBe("HOST");
      }
    });

    it("should validate adding an external client attendee", () => {
      const addGuestRes = addMeetingAttendeeSchema.safeParse({
        params: { id: MOCK_MEETING_ID },
        body: {
          name: "Vikram Malhotra",
          email: "vikram@malhotra.org",
          phone: "+919123456780",
          role: "ATTENDEE",
          notes: "Key decision maker for living room modular wall unit",
        },
      });
      expect(addGuestRes.success).toBe(true);
      if (addGuestRes.success) {
        expect(addGuestRes.data.body.name).toBe("Vikram Malhotra");
        expect(addGuestRes.data.body.role).toBe("ATTENDEE");
      }
    });

    it("should validate updating attendee RSVP status to ACCEPTED or DECLINED", () => {
      const updateRsvpRes = updateMeetingAttendeeSchema.safeParse({
        params: { id: MOCK_MEETING_ID, attendeeId: MOCK_ATTENDEE_ID },
        body: {
          status: "ACCEPTED",
          role: "HOST",
        },
      });
      expect(updateRsvpRes.success).toBe(true);
      if (updateRsvpRes.success) {
        expect(updateRsvpRes.data.body.status).toBe("ACCEPTED");
      }

      const declineRes = updateMeetingAttendeeSchema.safeParse({
        params: { id: MOCK_MEETING_ID, attendeeId: MOCK_ATTENDEE_ID },
        body: {
          status: "DECLINED",
        },
      });
      expect(declineRes.success).toBe(true);
      if (declineRes.success) {
        expect(declineRes.data.body.status).toBe("DECLINED");
      }
    });
  });

  // =========================================================================
  // Area 4: Minutes of Meeting (MOM) & Document Attachments
  // =========================================================================
  describe("Area 4: Minutes of Meeting (MOM) & Document Attachments", () => {
    it("should validate updating Minutes of Meeting (MOM) and outcome notes", () => {
      const momPayload = {
        params: { id: MOCK_MEETING_ID },
        body: {
          minutesOfMeeting:
            "1. Client approved 3D concept for kitchen.\n2. Requested quote revision for Italian marble flooring.\n3. Next site visit fixed for Saturday.",
          outcomeNotes: "Strong interest; quotation sent by EOD.",
          recordingUrl: "https://storage.homio.in/recordings/mtg-2026-001.mp4",
        },
      };

      const result = updateMeetingMomSchema.safeParse(momPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.recordingUrl).toBe(
          "https://storage.homio.in/recordings/mtg-2026-001.mp4"
        );
        expect(result.data.body.minutesOfMeeting).toContain("Italian marble flooring");
      }
    });

    it("should validate meeting document upload name schema", () => {
      const docUploadPayload = {
        params: { id: MOCK_MEETING_ID },
        body: {
          name: "Living Room Structural Beam Inspection.jpg",
        },
      };

      const result = uploadMeetingDocumentSchema.safeParse(docUploadPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("Living Room Structural Beam Inspection.jpg");
      }
    });
  });

  // =========================================================================
  // Area 5: Meeting Calendar & Paginated List Queries
  // =========================================================================
  describe("Area 5: Meeting Calendar & Paginated List Queries", () => {
    it("should validate calendar query date ranges", () => {
      const calendarQuery = {
        query: {
          fromDate: "2026-09-01T00:00:00.000Z",
          toDate: "2026-09-30T23:59:59.999Z",
          leadId: MOCK_LEAD_ID,
        },
      };

      const result = getMeetingCalendarQuerySchema.safeParse(calendarQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.fromDate).toBe("2026-09-01T00:00:00.000Z");
        expect(result.data.query.toDate).toBe("2026-09-30T23:59:59.999Z");
        expect(result.data.query.leadId).toBe(MOCK_LEAD_ID);
      }
    });

    it("should validate paginated list query with search and filters", () => {
      const listQuery = {
        query: {
          page: "2",
          limit: "15",
          search: "Sharma",
          leadId: MOCK_LEAD_ID,
          type: "ONLINE",
          sortBy: "meetingDate",
          sortOrder: "desc",
        },
      };

      const result = getMeetingsQuerySchema.safeParse(listQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(2);
        expect(result.data.query.limit).toBe(15);
        expect(result.data.query.search).toBe("Sharma");
        expect(result.data.query.leadId).toBe(MOCK_LEAD_ID);
        expect(result.data.query.sortBy).toBe("meetingDate");
        expect(result.data.query.sortOrder).toBe("desc");
      }
    });

    it("should apply default page and limit for empty list query", () => {
      const result = getMeetingsQuerySchema.safeParse({ query: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.limit).toBe(10);
        expect(result.data.query.sortBy).toBe("startTime");
        expect(result.data.query.sortOrder).toBe("asc");
      }
    });

    it("should reject malformed meeting UUID parameter", () => {
      const result = updateMeetingStatusSchema.safeParse({
        params: { id: "invalid-not-a-uuid" },
        body: { status: "COMPLETED" },
      });
      expect(result.success).toBe(false);
    });

    it("should reject malformed attendee UUID parameter", () => {
      const result = updateMeetingAttendeeSchema.safeParse({
        params: { id: MOCK_MEETING_ID, attendeeId: "not-a-uuid" },
        body: { status: "ACCEPTED" },
      });
      expect(result.success).toBe(false);
    });
  });
});
