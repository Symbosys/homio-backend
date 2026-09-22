/**
 * Procurement & Operations Test Fixtures
 * Standard mock data for multi-tenant B2B SaaS procurement testing
 */

export const MOCK_ORG_ID_1 = "11111111-1111-4111-8111-111111111111";
export const MOCK_ORG_ID_2 = "99999999-9999-4999-8999-999999999999";

export const MOCK_PROJECT_ID_1 = "22222222-2222-4222-8222-222222222222";
export const MOCK_PROJECT_ID_2 = "33333333-3333-4333-8333-333333333333";

export const MOCK_USER_ID_1 = "44444444-4444-4444-8444-444444444444";
export const MOCK_USER_ID_2 = "55555555-5555-4555-8555-555555555555";

export const MOCK_VENDOR_ID_1 = "66666666-6666-4666-8666-666666666666";
export const MOCK_VENDOR_ID_2 = "77777777-7777-4777-8777-777777777777";

export const MOCK_MATERIAL_PRODUCT_ID_1 = "88888888-8888-4888-8888-888888888888";
export const MOCK_MATERIAL_PRODUCT_ID_2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export const MOCK_MATERIAL_REQUEST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const MOCK_MATERIAL_REQUEST_ITEM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

export const MOCK_VENDOR_RFQ_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const MOCK_VENDOR_RFQ_ITEM_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const MOCK_VENDOR_RFQ_INVITE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

export const MOCK_VENDOR_QUOTATION_ID = "12121212-1212-4212-8212-121212121212";
export const MOCK_VENDOR_QUOTATION_ITEM_ID = "23232323-2323-4323-8323-232323232323";

export const MOCK_MATERIAL_DISPATCH_ID = "34343434-3434-4334-8434-343434343434";
export const MOCK_MATERIAL_DISPATCH_ITEM_ID = "45454545-4545-4445-8545-454545454545";

export const validMaterialRequestPayload = {
  projectId: MOCK_PROJECT_ID_1,
  title: "Phase 2 Electrical Fittings & Concealed Conduits",
  description: "Required for master bedroom and modular kitchen wiring run.",
  priority: "HIGH" as const,
  requiredBy: "2026-10-15",
  deliveryLocation: "Tower B, Flat 1402, Highline Residency",
  remarks: "Ensure fire-retardant (FRLS) grade only.",
  additionalInformation: {
    contractorName: "Apex MEP Solutions",
    supervisorPhone: "+91-9876543210",
  },
  items: [
    {
      materialProductId: MOCK_MATERIAL_PRODUCT_ID_1,
      materialName: "Finolex 2.5 sq mm FRLS Copper Wire (Red)",
      specification: "IS:694 certified, 1100V grade, 90m coil",
      quantity: 10,
      unit: "COIL",
      estimatedUnitPrice: 2450.0,
      remarks: "Batch test certificate needed",
    },
    {
      materialName: "Anchor Roma 6-Module Metal Concealed Gang Box",
      specification: "GI Sheet metal with brass earthing point",
      quantity: 25,
      unit: "PCS",
      estimatedUnitPrice: 180.0,
    },
  ],
};

export const validVendorRfqPayload = {
  projectId: MOCK_PROJECT_ID_1,
  materialRequestId: MOCK_MATERIAL_REQUEST_ID,
  title: "RFQ for Living Room Italian Marble & Adhesive",
  description: "Competitive quotation requested for 20mm Dyna Classic marble slabs.",
  status: "PUBLISHED" as const,
  submissionDeadline: "2026-10-20T18:00:00.000Z",
  targetDeliveryDate: "2026-11-01",
  termsAndConditions: "Payment: 30% advance against PI, 70% upon site delivery and inspection.",
  deliveryAddress: "Villa 12, Emerald Hills, Sector 65, Gurugram",
  additionalInformation: {
    tenderCategory: "Civil Finishes",
    inspectionRequired: true,
  },
  items: [
    {
      materialProductId: MOCK_MATERIAL_PRODUCT_ID_2,
      materialName: "Dyna Classic Italian Marble 20mm Polish Slab",
      specification: "First choice book-matched slab, zero cracks or fill marks",
      quantity: 1200,
      unit: "SQFT",
      targetUnitPrice: 420.0,
    },
  ],
  vendorIds: [MOCK_VENDOR_ID_1, MOCK_VENDOR_ID_2],
};

export const validVendorQuotationPayload = {
  vendorRfqId: MOCK_VENDOR_RFQ_ID,
  vendorId: MOCK_VENDOR_ID_1,
  projectId: MOCK_PROJECT_ID_1,
  quotationNumber: "QT-VEND-2026-0891",
  subtotal: 504000.0,
  taxAmount: 90720.0,
  discountAmount: 14000.0,
  freightCharges: 12000.0,
  netTotal: 592720.0,
  paymentTerms: "30% Advance, 70% on delivery",
  deliveryLeadDays: 7,
  validityDays: 30,
  notes: "Price inclusive of loading at depot. Unloading at site by buyer.",
  additionalInformation: {
    gstNumber: "07AAAAA0000A1Z5",
    vendorQuoteRef: "REF-2026-DYN",
  },
  items: [
    {
      vendorRfqItemId: MOCK_VENDOR_RFQ_ITEM_ID,
      materialProductId: MOCK_MATERIAL_PRODUCT_ID_2,
      materialName: "Dyna Classic Italian Marble 20mm Polish Slab",
      quantity: 1200,
      unit: "SQFT",
      unitPrice: 420.0,
      subtotal: 504000.0,
      taxRate: 18.0,
      taxAmount: 90720.0,
      discountAmount: 14000.0,
      totalPrice: 580720.0,
      brandOffered: "Italian Imported (Brescia Lot)",
      deliveryTimelineDays: 7,
    },
  ],
};

export const validMaterialDispatchPayload = {
  vendorQuotationId: MOCK_VENDOR_QUOTATION_ID,
  vendorRfqId: MOCK_VENDOR_RFQ_ID,
  vendorId: MOCK_VENDOR_ID_1,
  projectId: MOCK_PROJECT_ID_1,
  carrierName: "Delhivery Surface Freight",
  trackingNumber: "DEL-8877665544",
  vehicleNumber: "HR-26-DD-4501",
  driverName: "Ram Singh",
  driverPhone: "+91-9811223344",
  ewayBillNumber: "EWB-109283746501",
  dispatchDate: "2026-10-25T09:30:00.000Z",
  estimatedDeliveryDate: "2026-10-26T17:00:00.000Z",
  dispatchNotes: "Vehicle contains 3 wooden crates of Italian Marble slabs.",
  additionalInformation: {
    gatePassRequired: true,
    unloadingCraneBooked: true,
  },
  items: [
    {
      vendorQuotationItemId: MOCK_VENDOR_QUOTATION_ITEM_ID,
      materialProductId: MOCK_MATERIAL_PRODUCT_ID_2,
      materialName: "Dyna Classic Italian Marble 20mm Polish Slab",
      unit: "SQFT",
      dispatchedQuantity: 1200,
      remarks: "Batch #IT-2026-09",
    },
  ],
};
