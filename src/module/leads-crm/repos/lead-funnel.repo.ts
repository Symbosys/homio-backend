import { prisma } from "../../../lib/prisma.js";
import type { Prisma } from "../../../types/types.js";
import type {
  CreateLeadFunnelInput,
  UpdateLeadFunnelInput,
  GetLeadFunnelsQueryInput,
  CreateFunnelStageInput,
  UpdateFunnelStageInput,
  CreateFormFieldInput,
  UpdateFormFieldInput,
  SubmitPublicLeadInput,
} from "../validators/lead-funnel.validator.js";

/**
 * Repository: Lead Funnels, Stages & Dynamic Form Builders
 */
export class LeadFunnelRepo {
  /**
   * Helper: Generate URL-safe slug from title
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /**
   * Find paginated list of funnels for an organization
   */
  async findAll(organizationId: string, query: GetLeadFunnelsQueryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { search, funnelCategory, isActive, page = 1, limit = 50, sortBy = "sortOrder", sortOrder = "asc" } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LeadFunnelWhereInput = {
      organizationId,
      isDeleted: false,
      ...(funnelCategory ? { funnelCategory } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      db.leadFunnel.count({ where }),
      db.leadFunnel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          stages: {
            orderBy: { orderIndex: "asc" },
          },
          formFields: {
            where: { isActive: true },
            orderBy: { orderIndex: "asc" },
          },
          _count: {
            select: {
              leads: { where: { isDeleted: false } },
              stages: true,
              formFields: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Find single funnel by ID
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadFunnel.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        stages: {
          orderBy: { orderIndex: "asc" },
        },
        formFields: {
          orderBy: { orderIndex: "asc" },
        },
        _count: {
          select: {
            leads: { where: { isDeleted: false } },
            stages: true,
            formFields: true,
          },
        },
      },
    });
  }

  /**
   * Public: Find active funnel by public embed slug
   */
  async findByEmbedSlug(embedSlug: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadFunnel.findFirst({
      where: {
        embedSlug,
        isActive: true,
        isDeleted: false,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        description: true,
        funnelCategory: true,
        embedSlug: true,
        color: true,
        stages: {
          where: { isActive: true },
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            name: true,
            orderIndex: true,
            color: true,
          },
        },
        formFields: {
          where: { isActive: true },
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            label: true,
            key: true,
            fieldType: true,
            isRequired: true,
            placeholder: true,
            helpText: true,
            options: true,
            orderIndex: true,
          },
        },
      },
    });
  }

  /**
   * Create a new Lead Funnel
   */
  async create(organizationId: string, data: CreateLeadFunnelInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;

    const slug = data.slug || this.generateSlug(data.name);
    const embedSlug = data.embedSlug || `${this.generateSlug(data.name)}-${Math.random().toString(36).substring(2, 6)}`;

    // If marked default, unset any existing default in this organization
    if (data.isDefault) {
      await db.leadFunnel.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return db.leadFunnel.create({
      data: {
        organizationId,
        name: data.name,
        slug,
        description: data.description,
        funnelCategory: data.funnelCategory,
        embedSlug,
        isDefault: data.isDefault,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        color: data.color,
        additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? undefined,
      },
      include: {
        stages: true,
        formFields: true,
        _count: {
          select: { leads: true, stages: true, formFields: true },
        },
      },
    });
  }

  /**
   * Update an existing Lead Funnel
   */
  async update(id: string, organizationId: string, data: UpdateLeadFunnelInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;

    if (data.isDefault) {
      await db.leadFunnel.updateMany({
        where: { organizationId, id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
    }

    return db.leadFunnel.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.funnelCategory ? { funnelCategory: data.funnelCategory } : {}),
        ...(data.embedSlug ? { embedSlug: data.embedSlug } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.additionalInformation !== undefined ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? undefined } : {}),
      },
      include: {
        stages: { orderBy: { orderIndex: "asc" } },
        formFields: { orderBy: { orderIndex: "asc" } },
        _count: {
          select: { leads: true, stages: true, formFields: true },
        },
      },
    });
  }

  /**
   * Soft delete a Lead Funnel
   */
  async delete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadFunnel.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  // ==========================================
  // STAGES OPERATIONS
  // ==========================================

  /**
   * Add a stage to a funnel
   */
  async addStage(funnelId: string, organizationId: string, data: CreateFunnelStageInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;

    // Determine next orderIndex if not supplied
    let orderIndex = data.orderIndex;
    if (orderIndex === undefined) {
      const maxOrder = await db.leadFunnelStage.aggregate({
        where: { funnelId },
        _max: { orderIndex: true },
      });
      orderIndex = (maxOrder._max.orderIndex ?? 0) + 1;
    }

    const slug = data.slug || this.generateSlug(data.name);

    return db.leadFunnelStage.create({
      data: {
        organizationId,
        funnelId,
        name: data.name,
        slug,
        orderIndex,
        stageType: data.stageType,
        slaTargetDescription: data.slaTargetDescription,
        slaHours: data.slaHours,
        autoTaskEnabled: data.autoTaskEnabled,
        autoTaskTitle: data.autoTaskTitle,
        color: data.color,
        winProbability: data.winProbability,
        isActive: data.isActive,
        additionalInformation: data.additionalInformation ?? undefined,
      },
    });
  }

  /**
   * Update a funnel stage
   */
  async updateStage(stageId: string, funnelId: string, organizationId: string, data: UpdateFunnelStageInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadFunnelStage.update({
      where: { id: stageId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
        ...(data.orderIndex !== undefined ? { orderIndex: data.orderIndex } : {}),
        ...(data.stageType ? { stageType: data.stageType } : {}),
        ...(data.slaTargetDescription !== undefined ? { slaTargetDescription: data.slaTargetDescription } : {}),
        ...(data.slaHours !== undefined ? { slaHours: data.slaHours } : {}),
        ...(data.autoTaskEnabled !== undefined ? { autoTaskEnabled: data.autoTaskEnabled } : {}),
        ...(data.autoTaskTitle !== undefined ? { autoTaskTitle: data.autoTaskTitle } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.winProbability !== undefined ? { winProbability: data.winProbability } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.additionalInformation !== undefined ? { additionalInformation: data.additionalInformation ?? undefined } : {}),
      },
    });
  }

  /**
   * Delete a funnel stage
   */
  async deleteStage(stageId: string, funnelId: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadFunnelStage.delete({
      where: { id: stageId },
    });
  }

  /**
   * Reorder stages
   */
  async reorderStages(funnelId: string, organizationId: string, stages: { id: string; orderIndex: number }[], tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return Promise.all(
      stages.map((s) =>
        db.leadFunnelStage.update({
          where: { id: s.id },
          data: { orderIndex: s.orderIndex },
        })
      )
    );
  }

  // ==========================================
  // DYNAMIC FORM BUILDER OPERATIONS
  // ==========================================

  /**
   * Add a dynamic form field to a funnel
   */
  async addFormField(funnelId: string, organizationId: string, data: CreateFormFieldInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;

    let orderIndex = data.orderIndex;
    if (orderIndex === 0) {
      const maxOrder = await db.leadFunnelFormField.aggregate({
        where: { funnelId },
        _max: { orderIndex: true },
      });
      orderIndex = (maxOrder._max.orderIndex ?? 0) + 1;
    }

    return db.leadFunnelFormField.create({
      data: {
        organizationId,
        funnelId,
        label: data.label,
        key: data.key,
        fieldType: data.fieldType,
        isRequired: data.isRequired,
        placeholder: data.placeholder,
        helpText: data.helpText,
        options: data.options,
        orderIndex,
        isActive: data.isActive,
        additionalInformation: data.additionalInformation ?? undefined,
      },
    });
  }

  /**
   * Update a dynamic form field
   */
  async updateFormField(fieldId: string, funnelId: string, organizationId: string, data: UpdateFormFieldInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadFunnelFormField.update({
      where: { id: fieldId },
      data: {
        ...(data.label ? { label: data.label } : {}),
        ...(data.key ? { key: data.key } : {}),
        ...(data.fieldType ? { fieldType: data.fieldType } : {}),
        ...(data.isRequired !== undefined ? { isRequired: data.isRequired } : {}),
        ...(data.placeholder !== undefined ? { placeholder: data.placeholder } : {}),
        ...(data.helpText !== undefined ? { helpText: data.helpText } : {}),
        ...(data.options !== undefined ? { options: data.options } : {}),
        ...(data.orderIndex !== undefined ? { orderIndex: data.orderIndex } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.additionalInformation !== undefined ? { additionalInformation: data.additionalInformation ?? undefined } : {}),
      },
    });
  }

  /**
   * Delete a dynamic form field
   */
  async deleteFormField(fieldId: string, funnelId: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.leadFunnelFormField.delete({
      where: { id: fieldId },
    });
  }

  /**
   * Reorder dynamic form fields
   */
  async reorderFormFields(funnelId: string, organizationId: string, fields: { id: string; orderIndex: number }[], tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return Promise.all(
      fields.map((f) =>
        db.leadFunnelFormField.update({
          where: { id: f.id },
          data: { orderIndex: f.orderIndex },
        })
      )
    );
  }

  // ==========================================
  // PUBLIC EMBED INTAKE & SEEDING
  // ==========================================

  /**
   * Ingest lead from public embedded form submission
   */
  async submitPublicLead(embedSlug: string, data: SubmitPublicLeadInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;

    const funnel = await db.leadFunnel.findFirst({
      where: { embedSlug, isActive: true, isDeleted: false },
      include: {
        stages: { where: { isActive: true }, orderBy: { orderIndex: "asc" }, take: 1 },
      },
    });

    if (!funnel) {
      throw new Error("Active lead funnel not found for embed code");
    }

    const firstStage = funnel.stages[0];

    // Determine client contact details from submission
    const rawForm = data.formData || {};
    const clientName = data.clientName || rawForm.client_name || rawForm.name || "Web Inquiry";
    const phone = data.phone || rawForm.phone || rawForm.contact_phone || "Not Provided";
    const email = data.email || rawForm.email || null;
    const pincode = rawForm.pincode || null;
    const projectType = rawForm.project_type || "RESIDENTIAL";
    const estimatedBudget = rawForm.budget_lakhs ? Number(rawForm.budget_lakhs) * 100000 : null;

    // Resolve or create Customer entity under this tenant
    let customer = await db.customer.findFirst({
      where: { organizationId: funnel.organizationId, phone },
    });

    if (!customer) {
      const customerCount = await db.customer.count({ where: { organizationId: funnel.organizationId } });
      const customerCode = `CUST-${new Date().getFullYear()}-${String(customerCount + 1).padStart(4, "0")}`;
      customer = await db.customer.create({
        data: {
          organizationId: funnel.organizationId,
          customerCode,
          displayName: clientName,
          firstName: clientName.split(" ")[0] || clientName,
          lastName: clientName.split(" ").slice(1).join(" ") || "",
          phone,
          email,
          billingCity: rawForm.city || null,
          billingState: rawForm.state || null,
          billingPincode: pincode,
        },
      });
    }

    // Generate unique Lead Code
    const leadCount = await db.lead.count({ where: { organizationId: funnel.organizationId } });
    const leadCode = `LEAD-${new Date().getFullYear()}-${String(leadCount + 1).padStart(4, "0")}`;

    // Create Lead record connected to Funnel & Initial Stage
    const lead = await db.lead.create({
      data: {
        organizationId: funnel.organizationId,
        customerId: customer.id,
        leadCode,
        title: `${funnel.name} - ${clientName}`,
        workDescription: data.notes || `Submission from public web embed (${funnel.name})`,
        source: "WEBSITE",
        status: "NEW",
        funnelId: funnel.id,
        funnelStageId: firstStage?.id ?? null,
        formSubmissionData: rawForm,
        propertyPincode: pincode,
        estimatedBudget: estimatedBudget ? Number(estimatedBudget) : undefined,
        budgetInLakh: rawForm.budget_lakhs ? Number(rawForm.budget_lakhs) : undefined,
      },
      include: {
        customer: true,
        funnel: true,
        funnelStage: true,
      },
    });

    return lead;
  }

  /**
   * Seed Default Funnels (Matching client-approved Flutter definitions)
   */
  async seedDefaultFunnels(organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const existing = await db.leadFunnel.count({ where: { organizationId, isDeleted: false } });
    if (existing > 0) return;

    // 1. Interior Client Funnel
    const interiorFunnel = await db.leadFunnel.create({
      data: {
        organizationId,
        name: "Interior Client Funnel",
        slug: "interior-client",
        description: "Standard residential & luxury commercial turnkey client acquisition pipeline.",
        funnelCategory: "CLIENT",
        embedSlug: "interior-client-funnel",
        isDefault: true,
        isActive: true,
        sortOrder: 1,
        color: "#4F46E5",
        stages: {
          create: [
            { organizationId, name: "New Enquiry", slug: "new-enquiry", orderIndex: 1, stageType: "INTAKE", slaTargetDescription: "SLA Target: < 4 hours first response", slaHours: 4, autoTaskEnabled: true, winProbability: 10 },
            { organizationId, name: "Qualified", slug: "qualified", orderIndex: 2, stageType: "QUALIFYING", slaTargetDescription: "Qualification SLA: Pin code & budget verification", slaHours: 24, autoTaskEnabled: true, winProbability: 25 },
            { organizationId, name: "Meeting Done", slug: "meeting-done", orderIndex: 3, stageType: "MEETING_INTERVIEW", slaTargetDescription: "Site measurement & design consultation complete", slaHours: 48, autoTaskEnabled: true, winProbability: 50 },
            { organizationId, name: "Booked Clients", slug: "booked-clients", orderIndex: 4, stageType: "CLOSING_HIRED", slaTargetDescription: "Advance received & project agreement signed", slaHours: 72, autoTaskEnabled: false, winProbability: 100 },
            { organizationId, name: "Not Responding", slug: "not-responding", orderIndex: 5, stageType: "INACTIVE_COLD", slaTargetDescription: "Automated re-engagement follow-up queued", slaHours: 168, autoTaskEnabled: true, winProbability: 5 },
            { organizationId, name: "Not Qualified", slug: "not-qualified", orderIndex: 6, stageType: "DISQUALIFIED", slaTargetDescription: "Non-serviceable location or below budget threshold", winProbability: 0 },
            { organizationId, name: "Not Interested", slug: "not-interested", orderIndex: 7, stageType: "INACTIVE_COLD", slaTargetDescription: "Client declined proposal or chose alternative", winProbability: 0 },
          ],
        },
        formFields: {
          create: [
            { organizationId, label: "Client Full Name", key: "client_name", fieldType: "TEXT", isRequired: true, placeholder: "e.g. Rahul Sharma", orderIndex: 1 },
            { organizationId, label: "Contact Phone", key: "phone", fieldType: "PHONE", isRequired: true, placeholder: "+91 98101 23456", orderIndex: 2 },
            { organizationId, label: "Site Pincode", key: "pincode", fieldType: "TEXT", isRequired: true, placeholder: "122002", helpText: "Used for automatic serviceability qualification", orderIndex: 3 },
            { organizationId, label: "Project Property Type", key: "project_type", fieldType: "DROPDOWN", isRequired: true, placeholder: "Select type", options: ["4BHK Villa", "3BHK Apartment", "Penthouse", "Builder Floor"], orderIndex: 4 },
            { organizationId, label: "Scope of Work", key: "work_type", fieldType: "DROPDOWN", isRequired: true, placeholder: "Select scope", options: ["Full Turnkey", "Woodwork & Modular", "False Ceiling & Paint"], orderIndex: 5 },
            { organizationId, label: "Estimated Budget (₹ Lakhs)", key: "budget_lakhs", fieldType: "CURRENCY", isRequired: true, placeholder: "e.g. 35", helpText: "Minimum ₹20L for turnkey qualification", orderIndex: 6 },
          ],
        },
      },
    });

    // 2. Job Applicant Funnel
    await db.leadFunnel.create({
      data: {
        organizationId,
        name: "Job Applicant Funnel",
        slug: "job-applicant",
        description: "Recruitment funnel for Interior Designers, 3D Visualizers, and Project Managers.",
        funnelCategory: "JOB_APPLICANT",
        embedSlug: "job-applicant-funnel",
        isDefault: false,
        isActive: true,
        sortOrder: 2,
        color: "#059669",
        stages: {
          create: [
            { organizationId, name: "New Applicants", slug: "new-applicants", orderIndex: 1, stageType: "INTAKE", slaTargetDescription: "Resume screening & portfolio check", slaHours: 24, winProbability: 10 },
            { organizationId, name: "Qualified", slug: "candidate-qualified", orderIndex: 2, stageType: "QUALIFYING", slaTargetDescription: "Skills verification & background screening", slaHours: 48, winProbability: 30 },
            { organizationId, name: "Interview Done", slug: "interview-done", orderIndex: 3, stageType: "MEETING_INTERVIEW", slaTargetDescription: "Technical design review & panel interview", slaHours: 72, winProbability: 60 },
            { organizationId, name: "Hired", slug: "hired", orderIndex: 4, stageType: "CLOSING_HIRED", slaTargetDescription: "Offer accepted & onboarded", winProbability: 100 },
            { organizationId, name: "Rejected", slug: "rejected", orderIndex: 5, stageType: "DISQUALIFIED", slaTargetDescription: "Candidate not selected", winProbability: 0 },
            { organizationId, name: "Not Interested", slug: "candidate-not-interested", orderIndex: 6, stageType: "INACTIVE_COLD", slaTargetDescription: "Candidate declined offer", winProbability: 0 },
          ],
        },
        formFields: {
          create: [
            { organizationId, label: "Candidate Name", key: "candidate_name", fieldType: "TEXT", isRequired: true, placeholder: "Full Name", orderIndex: 1 },
            { organizationId, label: "Years of Experience", key: "experience_years", fieldType: "NUMBER", isRequired: true, placeholder: "e.g. 4.5", orderIndex: 2 },
            { organizationId, label: "Core Software Skills", key: "software_skills", fieldType: "DROPDOWN", isRequired: true, placeholder: "Select tool", options: ["3ds Max + Vray", "SketchUp + Enscape", "AutoCAD", "Revit BIM"], orderIndex: 3 },
          ],
        },
      },
    });

    // 3. Vendor / Supplier Funnel
    await db.leadFunnel.create({
      data: {
        organizationId,
        name: "Vendor / Supplier Funnel",
        slug: "vendor-supplier",
        description: "Procurement intake pipeline for Material Suppliers, Trade Contractors, and Millwork Builders.",
        funnelCategory: "VENDOR_SUPPLIER",
        embedSlug: "vendor-supplier-funnel",
        isDefault: false,
        isActive: true,
        sortOrder: 3,
        color: "#D97706",
        stages: {
          create: [
            { organizationId, name: "New Inquiries", slug: "vendor-inquiries", orderIndex: 1, stageType: "INTAKE", slaTargetDescription: "Review catalog & supplier credentials", slaHours: 48, winProbability: 20 },
            { organizationId, name: "Document Verification", slug: "doc-verification", orderIndex: 2, stageType: "QUALIFYING", slaTargetDescription: "GST, MSME & trade license verification", slaHours: 72, winProbability: 50 },
            { organizationId, name: "Sample Audit Done", slug: "sample-audit", orderIndex: 3, stageType: "MEETING_INTERVIEW", slaTargetDescription: "Physical sample batch quality inspection", slaHours: 96, winProbability: 80 },
            { organizationId, name: "Approved Vendor", slug: "approved-vendor", orderIndex: 4, stageType: "CLOSING_HIRED", slaTargetDescription: "Added to active trade contractor registry", winProbability: 100 },
            { organizationId, name: "Blacklisted", slug: "blacklisted", orderIndex: 5, stageType: "DISQUALIFIED", slaTargetDescription: "Disqualified supplier", winProbability: 0 },
          ],
        },
        formFields: {
          create: [
            { organizationId, label: "Vendor Firm Name", key: "firm_name", fieldType: "TEXT", isRequired: true, placeholder: "Company Name", orderIndex: 1 },
            { organizationId, label: "GST Number", key: "gst_number", fieldType: "TEXT", isRequired: true, placeholder: "07AAAAA0000A1Z5", orderIndex: 2 },
            { organizationId, label: "Supply Category", key: "category", fieldType: "DROPDOWN", isRequired: true, placeholder: "Category", options: ["Italian Marble", "Hardware & Hinges", "Plywood & Laminates", "Electricals"], orderIndex: 3 },
          ],
        },
      },
    });

    return interiorFunnel;
  }
}

export const leadFunnelRepo = new LeadFunnelRepo();
