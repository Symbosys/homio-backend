/**
 * CRM Test Fixtures & Mock Factory for Meetings & Tasks APIs
 */

export const MOCK_ORGANIZATION_ID_1 = "11111111-1111-4111-8111-111111111111";
export const MOCK_ORGANIZATION_ID_2 = "22222222-2222-4222-8222-222222222222";

export const MOCK_USER_ID = "33333333-3333-4333-8333-333333333333";
export const MOCK_EMPLOYEE_ID_1 = "44444444-4444-4444-8444-444444444444";
export const MOCK_EMPLOYEE_ID_2 = "55555555-5555-4555-8555-555555555555";
export const MOCK_EMPLOYEE_ID_3 = "66666666-6666-4666-8666-666666666666";

export const MOCK_LEAD_ID = "77777777-7777-4777-8777-777777777777";
export const MOCK_CUSTOMER_ID = "88888888-8888-4888-8888-888888888888";
export const MOCK_PROJECT_ID = "99999999-9999-4999-8999-999999999999";

export const MOCK_MEETING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const MOCK_ATTENDEE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const MOCK_DOCUMENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

export const MOCK_TASK_ID_1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const MOCK_TASK_ID_2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const MOCK_CHECKLIST_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
export const MOCK_ACTIVITY_ID = "12121212-1212-4212-8212-121212121212";

export const sampleOnlineMeetingPayload = {
  title: "Interior Design Consultation with Mr. Sharma",
  description: "Discuss 3BHK layout, master bedroom woodwork, and lighting options.",
  agenda: "1. Floor plan walkthrough\n2. Material preferences\n3. Budget estimate",
  type: "ONLINE" as const,
  status: "SCHEDULED" as const,
  meetingDate: "2026-09-25",
  startTime: "2026-09-25T10:00:00.000Z",
  endTime: "2026-09-25T11:00:00.000Z",
  durationMinutes: 60,
  meetingUrl: "https://meet.google.com/xyz-abcd-efg",
  meetingProvider: "GOOGLE_MEET",
  meetingId: "xyz-abcd-efg",
  leadId: MOCK_LEAD_ID,
  organizerId: MOCK_EMPLOYEE_ID_1,
  attendees: [
    {
      employeeId: MOCK_EMPLOYEE_ID_1,
      name: "Rohit Verma (Lead Architect)",
      email: "rohit.verma@homio.in",
      role: "HOST" as const,
    },
    {
      name: "Anil Sharma",
      email: "anil.sharma@example.com",
      phone: "+919876543210",
      role: "ATTENDEE" as const,
      isCustomer: false,
    },
  ],
};

export const sampleSiteVisitMeetingPayload = {
  title: "On-site Measurement & Structural Inspection",
  description: "Verify actual site slab heights and duct routing.",
  type: "SITE_VISIT" as const,
  status: "SCHEDULED" as const,
  meetingDate: "2026-09-28",
  startTime: "2026-09-28T14:30:00.000Z",
  endTime: "2026-09-28T16:00:00.000Z",
  durationMinutes: 90,
  locationName: "Sobha Dream Acres, Tower 4, Flat 1204",
  locationAddress: "Panathur Main Road, Balagere",
  locationCity: "Bengaluru",
  locationPincode: "560087",
  locationMapUrl: "https://maps.google.com/?q=12.9352,77.6944",
  locationCoordinates: { lat: 12.9352, lng: 77.6944 },
  customerId: MOCK_CUSTOMER_ID,
  organizerId: MOCK_EMPLOYEE_ID_2,
};

export const sampleTaskPayload = {
  title: "Draft 3D Kitchen Elevation & Modular Cabinet Specs",
  description: "Prepare render with acrylic finish and Hettich soft-close hardware.",
  type: "DESIGN_DRAFT" as const,
  priority: "HIGH" as const,
  status: "TODO" as const,
  startDate: "2026-09-20",
  dueDate: "2026-09-24",
  estimatedHours: 16,
  assignedToId: MOCK_EMPLOYEE_ID_1,
  leadId: MOCK_LEAD_ID,
  assignees: [
    {
      employeeId: MOCK_EMPLOYEE_ID_1,
      isPrimary: true,
    },
    {
      employeeId: MOCK_EMPLOYEE_ID_2,
      isPrimary: false,
    },
  ],
  checklistItems: [
    { title: "Export CAD layout", sortOrder: 1 },
    { title: "Apply quartz countertop textures", sortOrder: 2 },
    { title: "Generate photorealistic 4K render", sortOrder: 3 },
  ],
  tags: ["Kitchen", "3D-Render", "High-Priority"],
};
