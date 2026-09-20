import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateMeetingInput,
  UpdateMeetingInput,
  GetMeetingsQueryInput,
  GetMeetingCalendarQueryInput,
  AddMeetingAttendeeInput,
  UpdateMeetingAttendeeInput,
} from "../validators/meeting.validator.js";

export class MeetingRepository {
  /**
   * Create a new Meeting with optional initial attendees
   */
  async create(
    organizationId: string,
    data: CreateMeetingInput & {
      meetingCode: string;
      createdById?: string | null;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      attendees,
      locationCoordinates,
      customFields,
      tags,
      meetingDate,
      startTime,
      endTime,
      remindAt,
      ...directFields
    } = data;

    return db.meeting.create({
      data: {
        ...directFields,
        organizationId,
        meetingDate: new Date(meetingDate),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        remindAt: remindAt ? new Date(remindAt) : null,
        tags: tags || [],
        locationCoordinates: locationCoordinates
          ? (locationCoordinates as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.JsonNull,
        ...(attendees && attendees.length > 0
          ? {
              attendees: {
                create: attendees.map((att) => ({
                  organizationId,
                  employeeId: att.employeeId || null,
                  userId: att.userId || null,
                  name: att.name,
                  email: att.email || null,
                  phone: att.phone || null,
                  role: att.role || "ATTENDEE",
                  isCustomer: att.isCustomer || false,
                  notes: att.notes || null,
                })),
              },
            }
          : {}),
      },
      include: {
        organizer: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            workEmail: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            customerType: true,
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            email: true,
          },
        },
        attendees: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                designation: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find single meeting by ID with attendees and documents
   */
  async findById(id: string, organizationId: string) {
    return prisma.meeting.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        organizer: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            workEmail: true,
            workPhone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
            propertyAddress: true,
            propertyCity: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            customerType: true,
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            email: true,
          },
        },
        attendees: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                designation: true,
                workEmail: true,
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find all meetings with pagination, filters, and search
   */
  async findAll(organizationId: string, query: GetMeetingsQueryInput) {
    const {
      page,
      limit,
      search,
      type,
      status,
      leadId,
      customerId,
      projectId,
      organizerId,
      employeeId,
      fromDate,
      toDate,
      startDate,
      endDate,
      fromStartTime,
      toStartTime,
      sortBy,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    const effectiveFrom = startDate || fromDate || fromStartTime;
    const effectiveTo = endDate || toDate || toStartTime;
    const effectiveEmployeeId = employeeId || organizerId;

    const where: Prisma.MeetingWhereInput = {
      organizationId,
      isDeleted: false,
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(leadId ? { leadId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(effectiveEmployeeId
        ? {
            OR: [
              { organizerId: effectiveEmployeeId },
              {
                attendees: {
                  some: {
                    employeeId: effectiveEmployeeId,
                  },
                },
              },
            ],
          }
        : {}),
      ...(effectiveFrom || effectiveTo
        ? {
            startTime: {
              ...(effectiveFrom ? { gte: new Date(effectiveFrom) } : {}),
              ...(effectiveTo ? { lte: new Date(effectiveTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { meetingCode: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { agenda: { contains: search, mode: "insensitive" } },
              { locationName: { contains: search, mode: "insensitive" } },
              {
                attendees: {
                  some: {
                    OR: [
                      { name: { contains: search, mode: "insensitive" } },
                      { email: { contains: search, mode: "insensitive" } },
                      { phone: { contains: search } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.meeting.count({ where }),
      prisma.meeting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          organizer: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
              status: true,
            },
          },
          customer: {
            select: {
              id: true,
              customerCode: true,
              customerType: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
              email: true,
            },
          },
          _count: {
            select: {
              attendees: true,
              documents: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Calendar view query (date range timeline)
   */
  async getCalendar(organizationId: string, query: GetMeetingCalendarQueryInput) {
    const { fromDate, toDate, startDate, endDate, organizerId, employeeId, leadId, customerId, projectId } = query;

    const effectiveFrom = startDate || fromDate;
    const effectiveTo = endDate || toDate;
    const effectiveEmployeeId = employeeId || organizerId;

    return prisma.meeting.findMany({
      where: {
        organizationId,
        isDeleted: false,
        ...(effectiveFrom || effectiveTo
          ? {
              startTime: {
                ...(effectiveFrom ? { gte: new Date(effectiveFrom) } : {}),
                ...(effectiveTo ? { lte: new Date(effectiveTo) } : {}),
              },
            }
          : {}),
        ...(effectiveEmployeeId
          ? {
              OR: [
                { organizerId: effectiveEmployeeId },
                {
                  attendees: {
                    some: {
                      employeeId: effectiveEmployeeId,
                    },
                  },
                },
              ],
            }
          : {}),
        ...(leadId ? { leadId } : {}),
        ...(customerId ? { customerId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { startTime: "asc" },
      include: {
        organizer: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        attendees: {
          select: {
            id: true,
            name: true,
            role: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Update meeting record
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateMeetingInput & {
      status?: any;
      cancellationReason?: string | null;
      rescheduledFromId?: string | null;
      notes?: string | null;
      minutesOfMeeting?: string;
      outcomeNotes?: string | null;
      recordingUrl?: string | null;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { meetingDate, startTime, endTime, remindAt, locationCoordinates, customFields, attendees, ...directFields } = data;

    if (attendees !== undefined) {
      await db.meetingAttendee.deleteMany({
        where: { meetingId: id },
      });

      if (attendees.length > 0) {
        await db.meetingAttendee.createMany({
          data: attendees.map((att) => ({
            organizationId,
            meetingId: id,
            employeeId: att.employeeId || null,
            userId: att.userId || null,
            name: att.name,
            email: att.email || null,
            phone: att.phone || null,
            role: att.role || "ATTENDEE",
            isCustomer: att.isCustomer || false,
            notes: att.notes || null,
          })),
        });
      }
    }

    return db.meeting.update({
      where: { id },
      data: {
        ...directFields,
        ...(meetingDate !== undefined ? { meetingDate: new Date(meetingDate) } : {}),
        ...(startTime !== undefined ? { startTime: new Date(startTime) } : {}),
        ...(endTime !== undefined ? { endTime: new Date(endTime) } : {}),
        ...(remindAt !== undefined ? { remindAt: remindAt ? new Date(remindAt) : null } : {}),
        ...(locationCoordinates !== undefined
          ? { locationCoordinates: locationCoordinates ? (locationCoordinates as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
        ...(customFields !== undefined
          ? { customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
      },
      include: {
        organizer: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        lead: { select: { id: true, leadCode: true, title: true } },
        customer: { select: { id: true, customerCode: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Soft delete meeting
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.meeting.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Generate sequential meeting code (e.g. MTG-2026-0001)
   */
  async generateMeetingCode(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    const currentYear = new Date().getFullYear();
    const count = await db.meeting.count({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`),
        },
      },
    });

    return `MTG-${currentYear}-${String(count + 1).padStart(4, "0")}`;
  }

  /**
   * Attendee Operations
   */
  async addAttendee(organizationId: string, meetingId: string, data: AddMeetingAttendeeInput) {
    return prisma.meetingAttendee.create({
      data: {
        organizationId,
        meetingId,
        employeeId: data.employeeId || null,
        userId: data.userId || null,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        role: data.role || "ATTENDEE",
        isCustomer: data.isCustomer || false,
        notes: data.notes || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async updateAttendee(organizationId: string, meetingId: string, attendeeId: string, data: UpdateMeetingAttendeeInput) {
    return prisma.meetingAttendee.update({
      where: { id: attendeeId },
      data,
    });
  }

  async deleteAttendee(organizationId: string, meetingId: string, attendeeId: string) {
    return prisma.meetingAttendee.delete({
      where: { id: attendeeId },
    });
  }

  /**
   * Document Operations
   */
  async createDocument(data: {
    organizationId: string;
    meetingId: string;
    name: string;
    fileUrl: Prisma.InputJsonValue;
    uploadedById?: string | null;
  }) {
    return prisma.meetingDocument.create({
      data: {
        organizationId: data.organizationId,
        meetingId: data.meetingId,
        name: data.name,
        fileUrl: data.fileUrl,
        uploadedById: data.uploadedById || null,
      },
    });
  }

  async deleteDocument(id: string, organizationId: string) {
    return prisma.meetingDocument.delete({
      where: { id },
    });
  }
}

export const meetingRepo = new MeetingRepository();
