import { meetingRepo } from "../repos/meeting.repo.js";
import { leadRepo } from "../repos/lead.repo.js";
import { customerRepo } from "../repos/customer.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType, Prisma } from "../../../types/types.js";
import type {
  CreateMeetingInput,
  UpdateMeetingInput,
  UpdateMeetingStatusInput,
  RescheduleMeetingInput,
  UpdateMeetingMomInput,
  AddMeetingAttendeeInput,
  UpdateMeetingAttendeeInput,
  UploadMeetingDocumentInput,
  GetMeetingsQueryInput,
  GetMeetingCalendarQueryInput,
} from "../validators/meeting.validator.js";

export class MeetingService {
  /**
   * Schedule a new meeting
   */
  async createMeeting(organizationId: string, input: CreateMeetingInput, createdById?: string | null) {
    if (input.leadId) {
      const lead = await leadRepo.findById(input.leadId, organizationId);
      if (!lead) {
        throw new ErrorResponse("Associated lead not found", statusCode.Not_Found);
      }
    }

    if (input.customerId) {
      const customer = await customerRepo.findById(input.customerId, organizationId);
      if (!customer) {
        throw new ErrorResponse("Associated customer not found", statusCode.Not_Found);
      }
    }

    const meetingCode = await meetingRepo.generateMeetingCode(organizationId);

    return meetingRepo.create(organizationId, {
      ...input,
      meetingCode,
      createdById,
    });
  }

  /**
   * Get paginated meetings
   */
  async getMeetings(organizationId: string, query: GetMeetingsQueryInput) {
    return meetingRepo.findAll(organizationId, query);
  }

  /**
   * Get calendar timeline view
   */
  async getCalendar(organizationId: string, query: GetMeetingCalendarQueryInput) {
    return meetingRepo.getCalendar(organizationId, query);
  }

  /**
   * Get single meeting details
   */
  async getMeetingById(id: string, organizationId: string) {
    const meeting = await meetingRepo.findById(id, organizationId);
    if (!meeting) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }
    return meeting;
  }

  /**
   * Update meeting info
   */
  async updateMeeting(id: string, organizationId: string, input: UpdateMeetingInput) {
    const existing = await meetingRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }

    return meetingRepo.update(id, organizationId, input);
  }

  /**
   * Update meeting status
   */
  async updateMeetingStatus(id: string, organizationId: string, input: UpdateMeetingStatusInput) {
    const existing = await meetingRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }

    return meetingRepo.update(id, organizationId, {
      status: input.status,
      cancellationReason: input.cancellationReason || null,
    });
  }

  /**
   * Reschedule meeting
   */
  async rescheduleMeeting(id: string, organizationId: string, input: RescheduleMeetingInput) {
    const existing = await meetingRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }

    return meetingRepo.update(id, organizationId, {
      meetingDate: input.meetingDate,
      startTime: input.startTime,
      endTime: input.endTime,
      status: "RESCHEDULED",
      rescheduledFromId: existing.id,
      notes: input.reason
        ? `${existing.description || ""}\n[Reschedule Reason]: ${input.reason}`.trim()
        : existing.description,
    });
  }

  /**
   * Update Minutes of Meeting (MOM) & Outcomes
   */
  async updateMeetingMom(id: string, organizationId: string, input: UpdateMeetingMomInput) {
    const existing = await meetingRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }

    return meetingRepo.update(id, organizationId, {
      minutesOfMeeting: input.minutesOfMeeting,
      outcomeNotes: input.outcomeNotes || null,
      recordingUrl: input.recordingUrl || null,
      status: "COMPLETED",
    });
  }

  /**
   * Soft delete meeting
   */
  async deleteMeeting(id: string, organizationId: string) {
    const existing = await meetingRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }

    await meetingRepo.softDelete(id, organizationId);
    return { message: "Meeting deleted successfully" };
  }

  /**
   * Attendee Operations
   */
  async addAttendee(organizationId: string, meetingId: string, input: AddMeetingAttendeeInput) {
    const meeting = await meetingRepo.findById(meetingId, organizationId);
    if (!meeting) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }

    return meetingRepo.addAttendee(organizationId, meetingId, input);
  }

  async updateAttendee(
    organizationId: string,
    meetingId: string,
    attendeeId: string,
    input: UpdateMeetingAttendeeInput
  ) {
    const meeting = await meetingRepo.findById(meetingId, organizationId);
    if (!meeting) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }

    return meetingRepo.updateAttendee(organizationId, meetingId, attendeeId, input);
  }

  async deleteAttendee(organizationId: string, meetingId: string, attendeeId: string) {
    const meeting = await meetingRepo.findById(meetingId, organizationId);
    if (!meeting) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }

    await meetingRepo.deleteAttendee(organizationId, meetingId, attendeeId);
    return { message: "Attendee removed successfully" };
  }

  /**
   * Document Operations
   */
  async uploadDocument(
    organizationId: string,
    meetingId: string,
    input: UploadMeetingDocumentInput,
    file: Express.Multer.File,
    uploadedById?: string | null
  ) {
    const meeting = await meetingRepo.findById(meetingId, organizationId);
    if (!meeting) {
      throw new ErrorResponse("Meeting not found", statusCode.Not_Found);
    }

    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        folder: `homio/organizations/${organizationId}/meetings/${meetingId}/docs`,
        resourceType: "raw",
      }
    );

    const docFile: ImageType = {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };

    return meetingRepo.createDocument({
      organizationId,
      meetingId,
      name: input.name,
      fileUrl: docFile as unknown as Prisma.InputJsonValue,
      uploadedById,
    });
  }

  async deleteDocument(id: string, organizationId: string) {
    await meetingRepo.deleteDocument(id, organizationId);
    return { message: "Document removed successfully" };
  }
}

export const meetingService = new MeetingService();
