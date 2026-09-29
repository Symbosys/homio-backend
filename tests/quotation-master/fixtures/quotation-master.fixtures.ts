import { QuotationItemCategory, RateCardTierType, PdfPageImagePosition } from "../../../src/types/types.js";

export const MOCK_ORGANIZATION_ID_1 = "a1111111-1111-4111-8111-111111111111";
export const MOCK_ORGANIZATION_ID_2 = "b2222222-2222-4222-8222-222222222222";

export const MOCK_ITEM_ID_1 = "c3333333-3333-4333-8333-333333333333";
export const MOCK_ITEM_ID_2 = "c4444444-4444-4444-8444-444444444444";

export const MOCK_RATE_CARD_ID_1 = "d5555555-5555-4555-8555-555555555555";
export const MOCK_RATE_CARD_ID_2 = "d6666666-6666-4666-8666-666666666666";

export const MOCK_TERMS_ID_1 = "e7777777-7777-4777-8777-777777777777";
export const MOCK_TERMS_ID_2 = "e8888888-8888-4888-8888-888888888888";

export const MOCK_PDF_ASSET_ID_1 = "f9999999-9999-4999-8999-999999999999";
export const MOCK_PDF_ASSET_ID_2 = "faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export const mockImage1 = {
  id: "img-cloud-01",
  url: "https://storage.homio.app/images/sample1.webp",
  bytes: 1048576,
  format: "webp",
  provider: "CLOUDINARY" as const,
};

export const mockImage2 = {
  id: "img-cloud-02",
  url: "https://storage.homio.app/images/sample2.webp",
  bytes: 2048576,
  format: "webp",
  provider: "CLOUDINARY" as const,
};

export const mockItemRecord = {
  id: MOCK_ITEM_ID_1,
  organizationId: MOCK_ORGANIZATION_ID_1,
  sku: "CRP-WDR-SLD-01",
  name: "Full Height Sliding Wardrobe with Loft",
  category: QuotationItemCategory.CARPENTRY,
  subcategory: "Standard",
  technicalSpecs: "18mm BWR Ply with 1mm Merino Laminate, Hafele soft-close hardware",
  description: "Bespoke carpentry storage with internal drawers",
  uom: "sqft",
  unitCost: 1850.0,
  targetMargin: 30.0,
  imageUrl: mockImage1,
  galleryImages: [mockImage2],
  approvedBrands: ["Greenply", "CenturyPly", "Hafele"],
  tags: ["wardrobe", "storage", "premium"],
  isActive: true,
  isDeleted: false,
  deletedAt: null,
  additionalInformation: { warrantyYears: 10 },
  createdAt: new Date("2026-01-01T10:00:00Z"),
  updatedAt: new Date("2026-01-01T10:00:00Z"),
};

export const mockRateCardRecord = {
  id: MOCK_RATE_CARD_ID_1,
  organizationId: MOCK_ORGANIZATION_ID_1,
  name: "Obsidian Luxury Residential Tier",
  code: "RC-LUXURY-01",
  tierType: RateCardTierType.LUXURY,
  description: "High-spec markup tier for villa and penthouse turnkey projects",
  defaultMarkupPercent: 35.0,
  categoryMarkups: {
    CIVIL: 20.0,
    CARPENTRY: 35.0,
    MODULAR_KITCHEN: 40.0,
  },
  applicableCategories: [
    QuotationItemCategory.CIVIL,
    QuotationItemCategory.CARPENTRY,
    QuotationItemCategory.MODULAR_KITCHEN,
  ],
  isDefault: true,
  isActive: true,
  sortOrder: 0,
  isDeleted: false,
  deletedAt: null,
  additionalInformation: { designerTier: "Principal" },
  createdAt: new Date("2026-01-01T10:00:00Z"),
  updatedAt: new Date("2026-01-01T10:00:00Z"),
};

export const mockTermsTemplateRecord = {
  id: MOCK_TERMS_ID_1,
  organizationId: MOCK_ORGANIZATION_ID_1,
  name: "Standard Turnkey Interior Terms & 10-Yr Hafele Warranty",
  code: "TC-TURNKEY-01",
  description: "Standard residential sign-off terms with warranty clause",
  termsAndConditions: "1. All dimensions verified on site. 2. Variations billed pro-rata.",
  warrantyClauses: "10-year warranty on modular cabinetry hardware.",
  paymentTermsNote: "Stage payments must be cleared prior to phase commencement.",
  clientSignoffNote: "Approved and accepted by Client.",
  isDefault: true,
  isActive: true,
  isDeleted: false,
  deletedAt: null,
  additionalInformation: { legalJurisdiction: "Mumbai" },
  createdAt: new Date("2026-01-01T10:00:00Z"),
  updatedAt: new Date("2026-01-01T10:00:00Z"),
};

export const mockPdfAssetRecord = {
  id: MOCK_PDF_ASSET_ID_1,
  organizationId: MOCK_ORGANIZATION_ID_1,
  title: "Modern Minimalist Cover Page",
  position: PdfPageImagePosition.FRONT,
  sortOrder: 0,
  pageTag: "COVER",
  image: mockImage1,
  isActive: true,
  isDefault: true,
  isDeleted: false,
  deletedAt: null,
  additionalInformation: { theme: "Dark" },
  createdAt: new Date("2026-01-01T10:00:00Z"),
  updatedAt: new Date("2026-01-01T10:00:00Z"),
};
