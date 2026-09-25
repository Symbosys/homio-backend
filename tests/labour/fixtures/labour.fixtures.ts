/**
 * Centralized Test Fixtures for Labour & Service Management Tests
 */

export const MOCK_ORGANIZATION_ID_1 = "11111111-1111-4111-8111-111111111111";
export const MOCK_ORGANIZATION_ID_2 = "22222222-2222-4222-8222-222222222222"; // Tenant 2 for cross-tenant testing

export const MOCK_LABOUR_ID_1 = "a1111111-1111-4111-8111-111111111111";
export const MOCK_LABOUR_ID_2 = "a2222222-2222-4222-8222-222222222222";

export const MOCK_PROJECT_ID_1 = "b1111111-1111-4111-8111-111111111111";
export const MOCK_PROJECT_SITE_ID_1 = "c1111111-1111-4111-8111-111111111111";
export const MOCK_PROJECT_SERVICE_ID_1 = "c2222222-2222-4222-8222-222222222222";
export const MOCK_EMPLOYEE_ID_1 = "c3333333-3333-4333-8333-333333333333";
export const MOCK_BOOKING_ID_1 = "d1111111-1111-4111-8111-111111111111";
export const MOCK_ATTENDANCE_ID_1 = "e1111111-1111-4111-8111-111111111111";
export const MOCK_PAYMENT_ID_1 = "f1111111-1111-4111-8111-111111111111";
export const MOCK_RATING_ID_1 = "a9999999-9999-4999-8999-999999999999";
export const MOCK_DISPUTE_ID_1 = "b9999999-9999-4999-8999-999999999999";

/**
 * Mock GPS Coordinates (Bangalore, India)
 */
export const MOCK_SITE_GPS = {
  lat: 12.9715987,
  lng: 77.5945627,
  punchRadiusMeters: 200,
  isPunchGeofenceStrict: true,
};

// Location inside site perimeter (~30 meters away)
export const MOCK_PUNCH_INSIDE_GPS = {
  lat: 12.9718000,
  lng: 77.5947000,
};

// Location far outside site perimeter (~5.5 km away in Koramangala)
export const MOCK_PUNCH_OUTSIDE_GPS = {
  lat: 12.9352000,
  lng: 77.6245000,
};

/**
 * Mock ImageType Structured Objects (Rule 4)
 */
export const MOCK_IMAGE_OBJECT = {
  id: "homio/labour/profile/worker_001",
  url: "https://storage.homio.in/labour/profile/worker_001.jpg",
  bytes: 245000,
  format: "jpg",
  provider: "AWS_S3" as const,
};

export const MOCK_AADHAAR_DOC = {
  id: "homio/labour/kyc/aadhaar_001",
  url: "https://storage.homio.in/labour/kyc/aadhaar_001.pdf",
  bytes: 450000,
  format: "pdf",
  provider: "AWS_S3" as const,
};

export const MOCK_SELFIE_PHOTO = {
  id: "homio/labour/kyc/selfie_001",
  url: "https://storage.homio.in/labour/kyc/selfie_001.jpg",
  bytes: 180000,
  format: "jpg",
  provider: "CLOUDINARY" as const,
};

export const MOCK_RECEIPT_PHOTO = {
  id: "homio/labour/payments/receipt_001",
  url: "https://storage.homio.in/labour/payments/receipt_001.jpg",
  bytes: 320000,
  format: "jpg",
  provider: "AWS_S3" as const,
};

export const MOCK_EVIDENCE_DOC = {
  id: "homio/labour/disputes/evidence_001",
  url: "https://storage.homio.in/labour/disputes/evidence_001.pdf",
  bytes: 650000,
  format: "pdf",
  provider: "AWS_S3" as const,
};
