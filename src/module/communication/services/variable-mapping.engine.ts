import { prisma } from "../../../lib/prisma.js";
import {
  CrmMappingEntity,
  WhatsAppHeaderType,
  WhatsAppVariableComponent,
  type WhatsAppTemplateVariable,
} from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";

export interface MappableField {
  key: string;
  label: string;
  type: "STRING" | "NUMBER" | "DATE" | "CURRENCY" | "URL";
  sampleValue: string;
  description: string;
}

export interface EntityVariableDictionary {
  entity: CrmMappingEntity;
  label: string;
  description: string;
  fields: MappableField[];
}

/**
 * Enterprise Variable Dictionary Whitelist for Homio CRM
 * Only explicitly listed, safe, user-facing attributes are allowed.
 */
export const CRM_VARIABLE_DICTIONARY: EntityVariableDictionary[] = [
  {
    entity: CrmMappingEntity.LEAD,
    label: "Lead / Prospect",
    description: "Prospective customer details and inquiry metadata",
    fields: [
      { key: "fullName", label: "Full Name", type: "STRING", sampleValue: "Amit Kumar", description: "Lead's full legal name" },
      { key: "firstName", label: "First Name", type: "STRING", sampleValue: "Amit", description: "Lead's extracted first name" },
      { key: "phone", label: "Phone Number", type: "STRING", sampleValue: "+91 9876543210", description: "Primary mobile contact" },
      { key: "email", label: "Email Address", type: "STRING", sampleValue: "amit@example.com", description: "Primary email address" },
      { key: "propertyName", label: "Property / Project Name", type: "STRING", sampleValue: "Skyline Villa 402", description: "Target residential or commercial unit" },
      { key: "propertyCity", label: "Property City", type: "STRING", sampleValue: "Mumbai", description: "City where the property is located" },
      { key: "propertyAddress", label: "Property Address", type: "STRING", sampleValue: "Flat 402, Skyline Towers, Worli", description: "Complete property site location" },
      { key: "propertySizeSqft", label: "Property Size (Sq. Ft.)", type: "NUMBER", sampleValue: "1850", description: "Carpet or built-up area in sqft" },
      { key: "budgetInLakhs", label: "Budget (Lakhs)", type: "NUMBER", sampleValue: "25", description: "Estimated project budget in Lakhs" },
      { key: "stage", label: "Pipeline Stage", type: "STRING", sampleValue: "Site Visit Scheduled", description: "Current lead progression stage" },
    ],
  },
  {
    entity: CrmMappingEntity.CUSTOMER,
    label: "Customer / Client Account",
    description: "Onboarded client and account details",
    fields: [
      { key: "name", label: "Client Full Name", type: "STRING", sampleValue: "Rajesh Sharma", description: "Client account name" },
      { key: "customerCode", label: "Client Code", type: "STRING", sampleValue: "CUST-1049", description: "Unique CRM customer reference code" },
      { key: "primaryPhone", label: "Primary Phone", type: "STRING", sampleValue: "+91 9820012345", description: "Customer primary mobile" },
      { key: "primaryEmail", label: "Primary Email", type: "STRING", sampleValue: "rajesh@sharma.in", description: "Customer email address" },
      { key: "companyName", label: "Company / Business Name", type: "STRING", sampleValue: "Sharma Enterprises", description: "Commercial enterprise name if applicable" },
      { key: "billingCity", label: "Billing City", type: "STRING", sampleValue: "Bengaluru", description: "Client billing city location" },
    ],
  },
  {
    entity: CrmMappingEntity.PROJECT,
    label: "Project",
    description: "Active interior/construction project details",
    fields: [
      { key: "name", label: "Project Name", type: "STRING", sampleValue: "Emerald Heights Penthouse", description: "Title of the project contract" },
      { key: "code", label: "Project Code", type: "STRING", sampleValue: "PRJ-9042", description: "Unique project tracking identifier" },
      { key: "currentStage", label: "Current Stage", type: "STRING", sampleValue: "Modular Woodwork & Electrical", description: "Active construction / interior phase" },
      { key: "siteAddress", label: "Site Address", type: "STRING", sampleValue: "Flat 12B, Emerald Heights, Golf Links", description: "Physical site location" },
      { key: "city", label: "Site City", type: "STRING", sampleValue: "Gurugram", description: "City of the project site" },
      { key: "startDate", label: "Start Date", type: "DATE", sampleValue: "15 Oct 2026", description: "Execution commencement date" },
      { key: "targetHandoverDate", label: "Target Handover Date", type: "DATE", sampleValue: "30 Dec 2026", description: "Committed project completion date" },
    ],
  },
  {
    entity: CrmMappingEntity.QUOTATION,
    label: "Quotation / BOQ Proposal",
    description: "Estimates, commercials, and proposal links",
    fields: [
      { key: "quotationNumber", label: "Quotation Number", type: "STRING", sampleValue: "QUO-2026-0891", description: "Official quotation reference code" },
      { key: "grandTotal", label: "Grand Total Amount", type: "CURRENCY", sampleValue: "₹18,50,000", description: "Final payable amount with taxes" },
      { key: "discountAmount", label: "Discount Amount", type: "CURRENCY", sampleValue: "₹50,000", description: "Special approved discount" },
      { key: "validUntilDate", label: "Expiry Date", type: "DATE", sampleValue: "20 Oct 2026", description: "Quotation validity expiry date" },
      { key: "publicViewUrl", label: "Proposal Public Link", type: "URL", sampleValue: "https://homio.in/q/QUO-0891", description: "Client web-view link" },
    ],
  },
  {
    entity: CrmMappingEntity.MEETING,
    label: "Meeting / Site Consultation",
    description: "Scheduled client appointments and briefings",
    fields: [
      { key: "title", label: "Meeting Title", type: "STRING", sampleValue: "Design Walkthrough & Material Review", description: "Title of the consultation" },
      { key: "scheduledDate", label: "Scheduled Date", type: "STRING", sampleValue: "Tomorrow, 4:00 PM", description: "Human-readable scheduled date and time" },
      { key: "location", label: "Location / Venue", type: "STRING", sampleValue: "Homio Design Studio, Indiranagar", description: "Physical or virtual meeting location" },
      { key: "meetingUrl", label: "Video Call URL", type: "URL", sampleValue: "https://meet.google.com/abc-defg-hij", description: "Virtual meeting video link" },
    ],
  },
  {
    entity: CrmMappingEntity.ORGANIZATION,
    label: "Organization Branding",
    description: "Tenant company branding and support contacts",
    fields: [
      { key: "name", label: "Organization Name", type: "STRING", sampleValue: "Homio Design Studio", description: "Business brand name" },
      { key: "supportPhone", label: "Support Phone", type: "STRING", sampleValue: "+91 80 4000 1100", description: "Official helpline phone" },
      { key: "supportEmail", label: "Support Email", type: "STRING", sampleValue: "support@homio.in", description: "Official client care email" },
      { key: "websiteUrl", label: "Website URL", type: "URL", sampleValue: "https://homio.in", description: "Official website domain" },
    ],
  },
  {
    entity: CrmMappingEntity.ASSIGNED_EMPLOYEE,
    label: "Assigned Employee / Designer",
    description: "Account manager, project lead, or site engineer",
    fields: [
      { key: "fullName", label: "Employee Name", type: "STRING", sampleValue: "Vikram Malhotra", description: "Full name of the assigned executive" },
      { key: "designation", label: "Designation", type: "STRING", sampleValue: "Principal Interior Architect", description: "Employee job title" },
      { key: "phone", label: "Direct Phone", type: "STRING", sampleValue: "+91 9988776655", description: "Direct office mobile" },
      { key: "email", label: "Direct Email", type: "STRING", sampleValue: "vikram@homio.in", description: "Employee corporate email" },
    ],
  },
  {
    entity: CrmMappingEntity.CUSTOM_STATIC,
    label: "Custom / Static Text",
    description: "Fixed text provided directly or overridden at send time",
    fields: [
      { key: "staticValue", label: "Static Text", type: "STRING", sampleValue: "Festive Season Discount", description: "Static value defined in template" },
    ],
  },
];

export interface VariableResolutionContext {
  organizationId: string;
  leadId?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  quotationId?: string | null;
  meetingId?: string | null;
  employeeId?: string | null;
  recipientPhone?: string | null;
  recipientName?: string | null;
  customOverrides?: Record<string, string>;
}

export interface RenderedTemplateResult {
  headerType?: WhatsAppHeaderType;
  header: string | null;
  headerMedia?: unknown;
  body: string;
  footer: string | null;
  buttons: Array<{ type?: string; text?: string; url?: string; [key: string]: unknown }>;
  variables: Array<{
    parameter: string;
    value: string;
    resolved: boolean;
  }>;
}

/**
 * Safely extracts a dynamic property value from an entity record as a string
 */
function extractFieldValue(record: unknown, field: string): string | null {
  if (record && typeof record === "object" && field in record) {
    const raw = (record as Record<string, unknown>)[field];
    return raw !== undefined && raw !== null ? String(raw) : null;
  }
  return null;
}

/**
 * Enterprise Variable Mapping Engine
 */
export class VariableMappingEngine {
  /**
   * Retrieve full CRM Variable Dictionary
   */
  getVariableDictionary(): { entities: EntityVariableDictionary[] } {
    return { entities: CRM_VARIABLE_DICTIONARY };
  }

  /**
   * Validate that a given entity and field are whitelisted
   */
  validateMapping(mappingEntity?: CrmMappingEntity | null, mappingField?: string | null): void {
    if (!mappingEntity) return;

    const dict = CRM_VARIABLE_DICTIONARY.find((e) => e.entity === mappingEntity);
    if (!dict) {
      throw new ErrorResponse(`Invalid mapping entity: "${mappingEntity}"`, statusCode.Bad_Request);
    }

    if (mappingField) {
      const fieldValid = dict.fields.some((f) => f.key === mappingField);
      if (!fieldValid) {
        throw new ErrorResponse(
          `Field "${mappingField}" is not allowed for entity "${mappingEntity}". Allowed fields: ${dict.fields.map((f) => f.key).join(", ")}`,
          statusCode.Bad_Request
        );
      }
    }
  }

  /**
   * Resolve template variables against database records (Read-Only Preview & Message Dispatch)
   */
  async resolveTemplate(
    template: {
      headerType?: WhatsAppHeaderType;
      headerText?: string | null;
      headerMedia?: unknown;
      bodyText: string;
      footerText?: string | null;
      buttons?: unknown;
      variables?: WhatsAppTemplateVariable[];
    },
    context: VariableResolutionContext
  ): Promise<RenderedTemplateResult> {
    // 1. Collect all template variables (merge DB variables with text-detected placeholders)
    const dbVariables = template.variables || [];
    const textParams = new Set<string>();
    const matchesHeader: string[] = (template.headerText || "").match(/\{\{\d+\}\}/g) || [];
    const matchesBody: string[] = (template.bodyText || "").match(/\{\{\d+\}\}/g) || [];
    matchesHeader.forEach((m: string) => textParams.add(m));
    matchesBody.forEach((m: string) => textParams.add(m));

    const allVariables: WhatsAppTemplateVariable[] = [...dbVariables];
    for (const param of textParams) {
      if (!allVariables.some((v) => v.parameter === param)) {
        const isHeader = matchesHeader.includes(param);
        const pos = parseInt(param.replace(/[^0-9]/g, ""), 10) || 1;
        allVariables.push({
          id: `virtual-${param}`,
          templateId: "",
          component: isHeader ? WhatsAppVariableComponent.HEADER : WhatsAppVariableComponent.BODY,
          position: pos,
          parameter: param,
          mappingEntity: null,
          mappingField: null,
          fallbackValue: null,
          label: null,
          isRequired: true,
          isMapped: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    const resolvedValues: Record<string, string> = {};
    const variableMeta: Array<{ parameter: string; value: string; resolved: boolean }> = [];

    // 2. Parallel fetch of contextual DB records with relations
    const [org, leadInit, customerInit, projectInit, quotationInit, meetingInit, employeeInit] =
      await Promise.all([
        prisma.organization.findUnique({ where: { id: context.organizationId } }),
        context.leadId
          ? prisma.lead.findUnique({
              where: { id: context.leadId },
              include: { customer: true, assignedTo: true },
            })
          : null,
        context.customerId
          ? prisma.customer.findUnique({
              where: { id: context.customerId },
              include: {
                leads: {
                  where: { isDeleted: false },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  include: { customer: true, assignedTo: true },
                },
                projects: {
                  where: { isDeleted: false },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  include: { site: true, schedule: true },
                },
              },
            })
          : null,
        context.projectId
          ? prisma.project.findUnique({
              where: { id: context.projectId },
              include: {
                site: true,
                schedule: true,
                customer: true,
                lead: { include: { customer: true, assignedTo: true } },
              },
            })
          : null,
        context.quotationId
          ? prisma.quotation.findUnique({
              where: { id: context.quotationId },
              include: {
                customer: true,
                lead: { include: { customer: true, assignedTo: true } },
              },
            })
          : null,
        context.meetingId
          ? prisma.meeting.findUnique({
              where: { id: context.meetingId },
              include: {
                customer: true,
                lead: { include: { customer: true, assignedTo: true } },
                organizer: true,
              },
            })
          : null,
        context.employeeId
          ? prisma.employee.findUnique({ where: { id: context.employeeId } })
          : null,
      ]);

    // 3. Bidirectional interlinking: initialize records with fallback chain
    let lead =
      leadInit ||
      customerInit?.leads?.[0] ||
      projectInit?.lead ||
      quotationInit?.lead ||
      meetingInit?.lead ||
      null;

    let customer =
      customerInit ||
      leadInit?.customer ||
      projectInit?.customer ||
      quotationInit?.customer ||
      meetingInit?.customer ||
      lead?.customer ||
      null;

    let project = projectInit || customerInit?.projects?.[0] || null;
    let quotation = quotationInit;
    let meeting = meetingInit;
    let employee =
      employeeInit ||
      leadInit?.assignedTo ||
      projectInit?.lead?.assignedTo ||
      quotationInit?.lead?.assignedTo ||
      meetingInit?.organizer ||
      lead?.assignedTo ||
      null;

    // 4. Phone-based intelligent lookup if customer/lead still missing
    if (!customer && !lead && context.recipientPhone) {
      const cleanDigits = context.recipientPhone.replace(/[^\d]/g, "");
      const last10 = cleanDigits.slice(-10);
      const matchedCustomer = await prisma.customer.findFirst({
        where: {
          organizationId: context.organizationId,
          OR: [
            { phone: context.recipientPhone },
            { phone: cleanDigits },
            { phone: { contains: last10 } },
            { alternatePhone: { contains: last10 } },
          ],
        },
        include: {
          leads: {
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { customer: true, assignedTo: true },
          },
          projects: {
            where: { isDeleted: false },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { site: true, schedule: true },
          },
        },
      });
      if (matchedCustomer) {
        customer = matchedCustomer;
        if (!lead && matchedCustomer.leads?.[0]) lead = matchedCustomer.leads[0];
        if (!project && matchedCustomer.projects?.[0]) project = matchedCustomer.projects[0];
      }
    }

    // Helper: unified customer name & contacts with cross-entity fallbacks
    const resolvedCustomerName =
      customer?.displayName ||
      [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
      lead?.customer?.displayName ||
      [lead?.customer?.firstName, lead?.customer?.lastName].filter(Boolean).join(" ") ||
      context.recipientName ||
      null;

    const resolvedCustomerFirstName =
      customer?.firstName ||
      lead?.customer?.firstName ||
      customer?.displayName?.split(" ")[0] ||
      lead?.customer?.displayName?.split(" ")[0] ||
      context.recipientName?.split(" ")[0] ||
      null;

    const resolvedPhone = customer?.phone || lead?.customer?.phone || context.recipientPhone || null;
    const resolvedEmail = customer?.email || lead?.customer?.email || null;

    // 5. Resolve each template variable
    for (const v of allVariables) {
      const { parameter, mappingEntity, mappingField, fallbackValue } = v;

      // 5a. Check custom overrides first
      if (
        context.customOverrides &&
        context.customOverrides[parameter] !== undefined &&
        context.customOverrides[parameter].trim() !== ""
      ) {
        const overrideVal = context.customOverrides[parameter].trim();
        resolvedValues[parameter] = overrideVal;
        variableMeta.push({ parameter, value: overrideVal, resolved: true });
        continue;
      }

      let val: string | null | undefined = null;
      let isResolved = false;

      // 5b. Resolve by CRM Mapping Entity
      if (mappingEntity && mappingField) {
        switch (mappingEntity) {
          case CrmMappingEntity.LEAD: {
            if (mappingField === "fullName") {
              val = resolvedCustomerName || lead?.title;
            } else if (mappingField === "firstName") {
              val = resolvedCustomerFirstName || lead?.title;
            } else if (mappingField === "phone") {
              val = resolvedPhone;
            } else if (mappingField === "email") {
              val = resolvedEmail;
            } else if (mappingField === "propertyName") {
              val = lead?.propertyName || project?.name;
            } else if (mappingField === "propertyCity") {
              val = lead?.propertyCity || project?.site?.city || customer?.billingCity;
            } else if (mappingField === "propertyAddress") {
              val = lead?.propertyAddress || project?.site?.address || customer?.billingAddress;
            } else if (mappingField === "propertySizeSqft") {
              val = lead?.propertySizeSqft?.toString();
            } else if (mappingField === "budgetInLakhs") {
              val =
                lead?.budgetInLakh?.toString() ||
                (lead?.estimatedBudget ? (Number(lead.estimatedBudget) / 100000).toString() : null);
            } else if (mappingField === "stage") {
              val = lead?.status;
            } else if (lead) {
              val = extractFieldValue(lead, mappingField);
            }
            if (val) isResolved = true;
            break;
          }
          case CrmMappingEntity.CUSTOMER: {
            if (mappingField === "name") {
              val = resolvedCustomerName;
            } else if (mappingField === "customerCode") {
              val = customer?.customerCode;
            } else if (mappingField === "primaryPhone") {
              val = resolvedPhone;
            } else if (mappingField === "primaryEmail") {
              val = resolvedEmail;
            } else if (mappingField === "companyName") {
              val = customer?.companyName;
            } else if (mappingField === "billingCity") {
              val = customer?.billingCity || lead?.propertyCity;
            } else if (customer) {
              val = extractFieldValue(customer, mappingField);
            }
            if (val) isResolved = true;
            break;
          }
          case CrmMappingEntity.PROJECT: {
            if (mappingField === "name") {
              val = project?.name || lead?.propertyName || lead?.title;
            } else if (mappingField === "code") {
              val = project?.projectCode;
            } else if (mappingField === "currentStage") {
              val = project?.currentStage;
            } else if (mappingField === "siteAddress") {
              val = project?.site?.address || lead?.propertyAddress;
            } else if (mappingField === "city") {
              val = project?.site?.city || lead?.propertyCity;
            } else if (mappingField === "startDate" && project?.schedule?.plannedStartDate) {
              val = new Date(project.schedule.plannedStartDate).toLocaleDateString("en-IN", {
                dateStyle: "medium",
              });
            } else if (
              mappingField === "targetHandoverDate" &&
              (project?.schedule?.siteHandoverDate || project?.schedule?.plannedEndDate)
            ) {
              const targetDate = project.schedule.siteHandoverDate || project.schedule.plannedEndDate;
              val = new Date(targetDate!).toLocaleDateString("en-IN", { dateStyle: "medium" });
            } else if (project) {
              val = extractFieldValue(project, mappingField);
            }
            if (val) isResolved = true;
            break;
          }
          case CrmMappingEntity.QUOTATION: {
            if (quotation) {
              if (mappingField === "quotationNumber") {
                val = quotation.quoteNumber;
              } else if (mappingField === "grandTotal" && quotation.grandTotal) {
                val = `₹${Number(quotation.grandTotal).toLocaleString("en-IN")}`;
              } else if (mappingField === "discountAmount" && quotation.discountAmount) {
                val = `₹${Number(quotation.discountAmount).toLocaleString("en-IN")}`;
              } else if (
                mappingField === "validUntilDate" &&
                (quotation.discountExpiryDate || quotation.submissionDate)
              ) {
                const expiry = quotation.discountExpiryDate || quotation.submissionDate;
                val = new Date(expiry!).toLocaleDateString("en-IN", { dateStyle: "medium" });
              } else {
                val = extractFieldValue(quotation, mappingField);
              }
              if (val) isResolved = true;
            }
            break;
          }
          case CrmMappingEntity.MEETING: {
            if (meeting) {
              if (mappingField === "title") {
                val = meeting.title;
              } else if (mappingField === "scheduledDate" && meeting.startTime) {
                val = new Date(meeting.startTime).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });
              } else if (mappingField === "location") {
                val = meeting.locationName || meeting.locationAddress;
              } else if (mappingField === "meetingUrl") {
                val = meeting.meetingUrl;
              } else {
                val = extractFieldValue(meeting, mappingField);
              }
              if (val) isResolved = true;
            }
            break;
          }
          case CrmMappingEntity.ORGANIZATION: {
            if (org) {
              if (mappingField === "name") val = org.name;
              else if (mappingField === "supportPhone") val = org.phone;
              else if (mappingField === "supportEmail") val = org.email;
              else if (mappingField === "websiteUrl") val = org.website;
              else val = extractFieldValue(org, mappingField);
              if (val) isResolved = true;
            }
            break;
          }
          case CrmMappingEntity.ASSIGNED_EMPLOYEE: {
            if (employee) {
              if (mappingField === "fullName") {
                val =
                  employee.displayName ||
                  `${employee.firstName} ${employee.lastName || ""}`.trim();
              } else if (mappingField === "designation") {
                val = employee.designation;
              } else if (mappingField === "phone") {
                val = employee.workPhone || employee.personalPhone;
              } else if (mappingField === "email") {
                val = employee.workEmail || employee.personalEmail;
              } else {
                val = extractFieldValue(employee, mappingField);
              }
              if (val) isResolved = true;
            }
            break;
          }
          case CrmMappingEntity.CUSTOM_STATIC: {
            val = fallbackValue || "";
            isResolved = Boolean(val);
            break;
          }
        }
      }

      // 5c. Smart heuristic for unmapped variables (e.g. {{1}} in "Hi {{1}}, ...")
      if (!isResolved) {
        const isGreeting =
          (v.position === 1 || v.parameter === "{{1}}") &&
          (/(?:hi|hello|hey|dear)\s+\{\{1\}\}/i.test(template.bodyText || "") || v.position === 1);
        if (isGreeting && (resolvedCustomerName || resolvedCustomerFirstName)) {
          val = resolvedCustomerName || resolvedCustomerFirstName;
          isResolved = true;
        }
      }

      // 5d. Safe fallback if record attribute was empty or unresolved
      if (!val || val.trim() === "") {
        if (fallbackValue && fallbackValue.trim() !== "") {
          val = fallbackValue.trim();
        } else {
          const dictEntity = CRM_VARIABLE_DICTIONARY.find((e) => e.entity === mappingEntity);
          const dictField = dictEntity?.fields.find((f) => f.key === mappingField);
          if (dictField?.sampleValue) {
            val = dictField.sampleValue;
          } else if (v.position === 1 || v.parameter === "{{1}}") {
            val = resolvedCustomerName || context.recipientName || "there";
          } else {
            val = "details";
          }
        }
      }

      // 5e. ABSOLUTE SAFEGUARD: Never allow raw parameter text (e.g. "{{1}}") or empty/null to be dispatched
      if (!val || val.trim() === "" || val === parameter || (typeof val === "string" && /^\{\{\d+\}\}$/.test(val))) {
        val =
          fallbackValue ||
          (v.position === 1 ? resolvedCustomerName || context.recipientName || "there" : "details");
      }

      const safeFinalVal: string = val || "details";
      resolvedValues[parameter] = safeFinalVal;
      variableMeta.push({ parameter, value: safeFinalVal, resolved: isResolved });
    }

    // 6. String substitution on Header
    let finalHeader = template.headerText || null;
    if (finalHeader) {
      for (const [param, val] of Object.entries(resolvedValues)) {
        finalHeader = finalHeader.split(param).join(val);
      }
    }

    // 7. String substitution on Body
    let finalBody = template.bodyText;
    for (const [param, val] of Object.entries(resolvedValues)) {
      finalBody = finalBody.split(param).join(val);
    }

    // 8. String substitution on Button URLs
    const finalButtons = Array.isArray(template.buttons)
      ? template.buttons.map((btn) => {
          const btnRecord = btn as Record<string, unknown>;
          let updatedUrl = typeof btnRecord?.url === "string" ? btnRecord.url : undefined;
          if (updatedUrl) {
            for (const [param, val] of Object.entries(resolvedValues)) {
              updatedUrl = updatedUrl.split(param).join(encodeURIComponent(val));
            }
          }
          return { ...btnRecord, ...(updatedUrl !== undefined ? { url: updatedUrl } : {}) };
        })
      : [];

    return {
      headerType: template.headerType,
      header: finalHeader,
      headerMedia: template.headerMedia || null,
      body: finalBody,
      footer: template.footerText || null,
      buttons: finalButtons,
      variables: variableMeta,
    };
  }
}

export const variableMappingEngine = new VariableMappingEngine();
