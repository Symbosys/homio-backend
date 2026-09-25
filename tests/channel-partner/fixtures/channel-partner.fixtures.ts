export const MOCK_ORGANIZATION_ID_1 = "11111111-1111-4111-8111-111111111111";
export const MOCK_ORGANIZATION_ID_2 = "22222222-2222-4222-8222-222222222222";

export const MOCK_USER_ID = "33333333-3333-4333-8333-333333333333";
export const MOCK_LEAD_ID = "44444444-4444-4444-8444-444444444444";

export const MOCK_PARTNER_ID_1 = "55555555-5555-4555-8555-555555555555";
export const MOCK_PARTNER_ID_2 = "66666666-6666-4666-8666-666666666666";

export const MOCK_PAYOUT_ID_1 = "77777777-7777-4777-8777-777777777777";
export const MOCK_PAYOUT_ID_2 = "88888888-8888-4888-8888-888888888888";

export const mockPartnerRecord = {
  id: MOCK_PARTNER_ID_1,
  organizationId: MOCK_ORGANIZATION_ID_1,
  partnerCode: "CP-1001",
  name: "Amit Patel",
  companyName: "Patel Realty",
  partnerType: "REAL_ESTATE_AGENT",
  phone: "+919876543210",
  alternatePhone: "+919876543211",
  email: "amit.patel@example.com",
  address: "Shop 12, Crystal Plaza",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400053",
  avatarUrl: null,
  defaultCommissionType: "PERCENTAGE",
  defaultCommissionValue: 5.0,
  bankDetails: {
    accountHolderName: "Amit Patel",
    bankName: "HDFC Bank",
    accountNumber: "50100234567890",
    ifscCode: "HDFC0001234",
  },
  panNumber: "ABCDE1234F",
  gstNumber: "27ABCDE1234F1Z5",
  aadhaarNumber: "123456789012",
  kycStatus: "VERIFIED",
  kycDetails: null,
  status: "ACTIVE",
  notes: "Top channel partner for Western suburbs",
  additionalInformation: { tier: "Gold" },
  isDeleted: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

export const mockPayoutRecord = {
  id: MOCK_PAYOUT_ID_1,
  organizationId: MOCK_ORGANIZATION_ID_1,
  channelPartnerId: MOCK_PARTNER_ID_1,
  leadId: MOCK_LEAD_ID,
  amount: 50000.0,
  paymentMode: "UPI",
  transactionReference: "UPI-20260925-998877",
  status: "COMPLETED",
  paymentDate: new Date("2026-09-25T10:00:00Z"),
  remarks: "Advance milestone commission",
  receiptUrl: {
    id: "receipt_123",
    url: "https://storage.example.com/receipts/rec1.pdf",
    format: "pdf",
    provider: "local",
  },
  processedById: MOCK_USER_ID,
  additionalInformation: { approvedByManager: true },
  createdAt: new Date("2026-09-25T10:00:00Z"),
  updatedAt: new Date("2026-09-25T10:00:00Z"),
};
