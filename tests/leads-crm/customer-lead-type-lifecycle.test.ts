import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../../src/lib/prisma";
import { leadService } from "../../src/module/leads-crm/services/lead.service";
import { projectService } from "../../src/module/projects/services/project.service";
import { CustomerType } from "../../src/types/types";

describe("Customer Type Lifecycle (LEAD_CUSTOMER vs CLIENT) Integration Tests", () => {
  const TEST_ORG_SLUG = `test_org_${Date.now()}`;
  let organizationId: string;
  let testLeadFunnelId: string;

  beforeAll(async () => {
    // 1. Create a test organization
    const org = await prisma.organization.create({
      data: {
        name: "Customer Type Lifecycle Test Org",
        slug: TEST_ORG_SLUG,
        email: `${TEST_ORG_SLUG}@example.com`,
        phone: "9999900000",
      },
    });
    organizationId = org.id;

    // 2. Create a default lead funnel for the organization
    const funnel = await prisma.leadFunnel.create({
      data: {
        organizationId,
        name: "Standard Lifecycle Funnel",
        slug: `lifecycle-funnel-${Date.now()}`,
        embedSlug: `embed-${Date.now()}`,
      },
    });
    testLeadFunnelId = funnel.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.leadActivity.deleteMany({ where: { organizationId } }).catch(() => {});
    await prisma.leadStageHistory.deleteMany({ where: { organizationId } }).catch(() => {});
    await prisma.project.deleteMany({ where: { organizationId } }).catch(() => {});
    await prisma.lead.deleteMany({ where: { organizationId } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { organizationId } }).catch(() => {});
    await prisma.leadFunnel.deleteMany({ where: { organizationId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => {});
  });

  // =========================================================================
  // 1. Lead Creation -> Customer is created as LEAD_CUSTOMER
  // =========================================================================
  it("should create new customer as LEAD_CUSTOMER when creating a new lead", async () => {
    const uniquePhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const email = `prospect_${Date.now()}@example.com`;

    const lead = await leadService.createLead(organizationId, {
      title: "2BHK Modern Interior Design",
      propertyAddress: "Skyline Residency, Flat 302",
      customer: {
        firstName: "Aarav",
        lastName: "Sharma",
        phone: uniquePhone,
        email,
      },
    });

    expect(lead).toBeDefined();
    expect(lead.customerId).toBeDefined();

    // Verify Customer record in database
    const customer = await prisma.customer.findUnique({
      where: { id: lead.customerId },
    });

    expect(customer).toBeDefined();
    expect(customer?.customerType).toBe(CustomerType.LEAD_CUSTOMER);
    expect(customer?.phone).toBe(uniquePhone);
    expect(customer?.firstName).toBe("Aarav");
  });

  // =========================================================================
  // 2. Existing Customer as CLIENT -> Remains CLIENT upon new Lead
  // =========================================================================
  it("should NOT change customerType if customer already exists as CLIENT when a new lead is created", async () => {
    const existingClientPhone = `92${Math.floor(10000000 + Math.random() * 90000000)}`;
    const clientCode = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create an established paying CLIENT directly
    const clientCustomer = await prisma.customer.create({
      data: {
        organizationId,
        customerCode: clientCode,
        firstName: "Meera",
        lastName: "Patel",
        phone: existingClientPhone,
        email: `meera_${Date.now()}@example.com`,
        customerType: CustomerType.CLIENT,
        convertedAt: new Date("2025-01-01"),
      },
    });

    expect(clientCustomer.customerType).toBe(CustomerType.CLIENT);

    // Now create a new inquiry / lead for the same phone number
    const newLead = await leadService.createLead(organizationId, {
      title: "Villa Extension Renovation",
      customer: {
        firstName: "Meera",
        lastName: "Patel",
        phone: existingClientPhone,
      },
    });

    expect(newLead.customerId).toBe(clientCustomer.id);

    // Verify customer is STILL CLIENT and was not reverted to LEAD_CUSTOMER
    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: clientCustomer.id },
    });

    expect(updatedCustomer?.customerType).toBe(CustomerType.CLIENT);
  });

  // =========================================================================
  // 3. Existing Customer as LEAD_CUSTOMER -> Remains LEAD_CUSTOMER upon another Lead
  // =========================================================================
  it("should keep customerType as LEAD_CUSTOMER if returning prospect submits another lead", async () => {
    const prospectPhone = `93${Math.floor(10000000 + Math.random() * 90000000)}`;

    // 1st lead created
    const lead1 = await leadService.createLead(organizationId, {
      title: "Living Room Design",
      customer: {
        firstName: "Kavita",
        lastName: "Deshmukh",
        phone: prospectPhone,
      },
    });

    const customerAfterLead1 = await prisma.customer.findUnique({
      where: { id: lead1.customerId },
    });
    expect(customerAfterLead1?.customerType).toBe(CustomerType.LEAD_CUSTOMER);

    // 2nd lead created for same prospect
    const lead2 = await leadService.createLead(organizationId, {
      title: "Full Home Woodwork",
      customer: {
        firstName: "Kavita",
        lastName: "Deshmukh",
        phone: prospectPhone,
      },
    });

    expect(lead2.customerId).toBe(lead1.customerId);

    const customerAfterLead2 = await prisma.customer.findUnique({
      where: { id: lead1.customerId },
    });
    expect(customerAfterLead2?.customerType).toBe(CustomerType.LEAD_CUSTOMER);
  });

  // =========================================================================
  // 4. Project Creation (Promote Lead to Project) -> Converts LEAD_CUSTOMER to CLIENT
  // =========================================================================
  it("should promote lead's customer from LEAD_CUSTOMER to CLIENT when creating a project linked to the lead", async () => {
    const uniquePhone = `94${Math.floor(10000000 + Math.random() * 90000000)}`;

    // Create lead -> creates customer as LEAD_CUSTOMER
    const lead = await leadService.createLead(organizationId, {
      title: "3BHK Luxury Interior Project",
      customer: {
        firstName: "Rohan",
        lastName: "Verma",
        phone: uniquePhone,
        email: `rohan_${Date.now()}@example.com`,
      },
    });

    const initialCustomer = await prisma.customer.findUnique({
      where: { id: lead.customerId },
    });
    expect(initialCustomer?.customerType).toBe(CustomerType.LEAD_CUSTOMER);

    // Now promote lead to project
    const project = await projectService.createProject(organizationId, {
      name: "Rohan Verma 3BHK Turnkey Interior",
      customerId: lead.customerId,
      leadId: lead.id,
      site: {
        address: "Prestige Whitefield, Tower 2, Flat 804",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560066",
      },
      commercial: {
        contractAmount: 4500000,
      },
    });

    expect(project).toBeDefined();
    expect(project.customerId).toBe(lead.customerId);

    // Verify Customer has now been promoted to CLIENT
    const promotedCustomer = await prisma.customer.findUnique({
      where: { id: lead.customerId },
    });

    expect(promotedCustomer?.customerType).toBe(CustomerType.CLIENT);
    expect(promotedCustomer?.convertedAt).toBeDefined();

    // Verify Lead is updated to WON with convertedProjectId
    const convertedLead = await prisma.lead.findUnique({
      where: { id: lead.id },
    });

    expect(convertedLead?.status).toBe("WON");
    expect(convertedLead?.convertedProjectId).toBe(project.id);
  });

  // =========================================================================
  // 5. Project Creation for Existing CLIENT -> Customer remains CLIENT
  // =========================================================================
  it("should keep customer as CLIENT when creating a second project for an existing CLIENT", async () => {
    const clientPhone = `95${Math.floor(10000000 + Math.random() * 90000000)}`;

    const client = await prisma.customer.create({
      data: {
        organizationId,
        customerCode: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
        firstName: "Suresh",
        lastName: "Raina",
        phone: clientPhone,
        customerType: CustomerType.CLIENT,
        convertedAt: new Date("2024-06-15"),
      },
    });

    expect(client.customerType).toBe(CustomerType.CLIENT);

    // Create a new project for this client directly
    const project = await projectService.createProject(organizationId, {
      name: "Suresh Commercial Office",
      customerId: client.id,
      site: {
        address: "Indiranagar 100ft Road",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560038",
      },
    });

    expect(project.id).toBeDefined();

    const customerAfterProject = await prisma.customer.findUnique({
      where: { id: client.id },
    });

    expect(customerAfterProject?.customerType).toBe(CustomerType.CLIENT);
  });

  // =========================================================================
  // 6. Lead Conversion API (convertLead) -> Converts LEAD_CUSTOMER to CLIENT
  // =========================================================================
  it("should promote customer to CLIENT when leadService.convertLead is called", async () => {
    const prospectPhone = `96${Math.floor(10000000 + Math.random() * 90000000)}`;

    const lead = await leadService.createLead(organizationId, {
      title: "Duplex Villa Architecture",
      customer: {
        firstName: "Pooja",
        lastName: "Hegde",
        phone: prospectPhone,
      },
    });

    const beforeConversion = await prisma.customer.findUnique({
      where: { id: lead.customerId },
    });
    expect(beforeConversion?.customerType).toBe(CustomerType.LEAD_CUSTOMER);

    // Call convertLead
    await leadService.convertLead(lead.id, organizationId, {
      notes: "Client signed proposal and paid token advance",
      clientPortalAccess: true,
    });

    const afterConversion = await prisma.customer.findUnique({
      where: { id: lead.customerId },
    });

    expect(afterConversion?.customerType).toBe(CustomerType.CLIENT);
    expect(afterConversion?.convertedAt).toBeDefined();
    expect(afterConversion?.portalAccessEnabled).toBe(true);
  });
});
