import { describe, it, expect, afterAll } from "bun:test";
import { prisma } from "../../src/lib/prisma.js";
import { DesignExpertService } from "../../src/module/design-expert/services/design-expert.service.js";
import { DesignExpertStatus } from "../../src/types/types.js";

describe("Design Expert - CRUD & Profile Management Tests", () => {
  const service = new DesignExpertService();
  const createdExpertIds: string[] = [];

  afterAll(async () => {
    if (createdExpertIds.length > 0) {
      await prisma.designExpertAvailability.deleteMany({
        where: { expertId: { in: createdExpertIds } },
      }).catch(() => {});

      await prisma.designExpertBooking.deleteMany({
        where: { expertId: { in: createdExpertIds } },
      }).catch(() => {});

      await prisma.designExpert.deleteMany({
        where: { id: { in: createdExpertIds } },
      }).catch(() => {});
    }
  });

  it("should create a new design expert with complete profile, fee, and status", async () => {
    const expert = await service.createExpert({
      name: "Ar. Priya Nair",
      title: "Senior Architectural Consultant",
      qualification: "M.Arch - School of Planning & Architecture",
      experienceYears: 10,
      specialties: ["Luxury Living", "Minimalist Modern", "Vastu Compliant"],
      languages: ["English", "Hindi", "Malayalam"],
      bio: "Award-winning residential architect specializing in contemporary Indian homes.",
      phone: "+919876543210",
      email: `priya_${Date.now()}@example.com`,
      defaultMeetingUrl: "https://meet.google.com/test-meet-link",
      consultationFee: 1499.0,
      slotDurationMinutes: 30,
      status: DesignExpertStatus.ACTIVE,
      additionalInformation: {
        awardName: "Top Interior Designer 2025",
        city: "Bengaluru",
      },
    });

    expect(expert).toBeDefined();
    expect(expert.id).toBeDefined();
    expect(expert.name).toBe("Ar. Priya Nair");
    expect(expert.status).toBe(DesignExpertStatus.ACTIVE);
    expect(Number(expert.consultationFee)).toBe(1499.0);
    expect(expert.slotDurationMinutes).toBe(30);
    expect(expert.specialties).toContain("Luxury Living");

    createdExpertIds.push(expert.id);
  });

  it("should retrieve single design expert by ID", async () => {
    const expertId = createdExpertIds[0]!;
    const expert = await service.getExpertById(expertId);

    expect(expert.id).toBe(expertId);
    expect(expert.name).toBe("Ar. Priya Nair");
    expect(expert.title).toBe("Senior Architectural Consultant");
  });

  it("should list design experts with pagination metadata", async () => {
    const result = await service.getExperts({
      page: 1,
      limit: 5,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.pagination).toBeDefined();
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(5);
    expect(result.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it("should filter design experts by specialty and status", async () => {
    const result = await service.getExperts({
      page: 1,
      limit: 10,
      specialty: "Luxury Living",
      status: DesignExpertStatus.ACTIVE,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    const found = result.items.find((item) => item.id === createdExpertIds[0]);
    expect(found).toBeDefined();
    expect(found?.specialties).toContain("Luxury Living");
  });

  it("should partially update design expert profile (Rule 5: Dirty payload)", async () => {
    const expertId = createdExpertIds[0]!;
    const updated = await service.updateExpert(expertId, {
      consultationFee: 1999.0,
      status: DesignExpertStatus.ON_LEAVE,
    });

    expect(Number(updated.consultationFee)).toBe(1999.0);
    expect(updated.status).toBe(DesignExpertStatus.ON_LEAVE);
    // Ensure untouched fields remain intact
    expect(updated.name).toBe("Ar. Priya Nair");
  });

  it("should soft delete a design expert and exclude from public listings", async () => {
    const expertId = createdExpertIds[0]!;
    const deleted = await service.deleteExpert(expertId);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedAt).toBeDefined();

    // Verify it is excluded from findExperts listing
    const result = await service.getExperts({
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const isPresent = result.items.some((item) => item.id === expertId);
    expect(isPresent).toBe(false);
  });
});
