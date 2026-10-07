import { whatsAppIntegrationRepo } from "../module/integration/repos/whatsapp-integration.repo.js";
import { metaWhatsAppService } from "../module/communication/services/meta-whatsapp.service.js";
import { prisma } from "../lib/prisma.js";
import { WhatsAppTemplateStatus } from "../types/types.js";

const ORG_ID = "05c35313-038c-4cc3-aed8-304a702fbf55";

const META_TEMPLATES_TO_SUBMIT = [
  // 1. Lead Auto Follow-Up Templates (MARKETING)
  {
    name: "lead_followup_day1_checkin",
    category: "MARKETING",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hello {{1}}, thank you for reaching out to Homio Design Studio! We noticed you were exploring interior design solutions for your space. Would you like to schedule a free 1-on-1 design consultation call today?",
        example: {
          body_text: [["John"]],
        },
      },
    ],
  },
  {
    name: "lead_followup_day3_portfolio",
    category: "MARKETING",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hi {{1}}, just checking in! We wanted to share some of our recently delivered 2BHK and 3BHK luxury interior transformations. Shall we book a quick 15-minute consultation to discuss your vision?",
        example: {
          body_text: [["John"]],
        },
      },
    ],
  },
  {
    name: "lead_followup_day4_offer",
    category: "MARKETING",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hello {{1}}, we know choosing the right interior partner is a big decision! We are offering a complimentary 3D visual walkthrough for your project. Reply to this message to schedule a call.",
        example: {
          body_text: [["John"]],
        },
      },
    ],
  },
  {
    name: "lead_followup_day7_final",
    category: "MARKETING",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hi {{1}}, we haven't heard back regarding your interior inquiry. We will pause our follow-ups for now. Feel free to message us back anytime whenever you're ready! Wishing you all the best!",
        example: {
          body_text: [["John"]],
        },
      },
    ],
  },

  // 2. Meeting Auto Follow-Up / Reminder Templates (UTILITY)
  {
    name: "meeting_reminder_1day_before",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hello {{1}}, this is a friendly reminder that your {{2}} with Homio is scheduled for {{3}} at {{4}} ({{5}}). Our consultant {{6}} is looking forward to meeting you.",
        example: {
          body_text: [["John", "Design Consultation", "Oct 15", "10:00 AM", "tomorrow", "Sarah"]],
        },
      },
    ],
  },
  {
    name: "meeting_reminder_1hour_before",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hi {{1}}, your {{2}} is coming up {{3}} at {{4}}. Please have your floor plans handy if you'd like us to review them. See you soon!",
        example: {
          body_text: [["John", "Consultation", "in 1 hour", "10:00 AM"]],
        },
      },
    ],
  },
  {
    name: "meeting_reminder_45min_before",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hi {{1}}, quick reminder: Your {{2}} with Homio is starting {{3}} (at {{4}}). Our consultant is getting the portfolio ready. See you soon!",
        example: {
          body_text: [["John", "Consultation", "in 45 minutes", "10:00 AM"]],
        },
      },
    ],
  },
  {
    name: "meeting_reminder_30min_before",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hello {{1}}, just 30 minutes to go! Your {{2}} is starting {{3}} at {{4}}. Meeting Location / Link: {{5}}. See you shortly!",
        example: {
          body_text: [["John", "Meeting", "in 30 minutes", "10:00 AM", "https://meet.google.com/xyz"]],
        },
      },
    ],
  },
  {
    name: "meeting_reminder_15min_before",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hi {{1}}, we are starting {{2}}! Your {{3}} begins at {{4}}. Location / Meeting Link: {{5}}. See you in a few minutes!",
        example: {
          body_text: [["John", "in 15 minutes", "Design Meeting", "10:00 AM", "https://meet.google.com/xyz"]],
        },
      },
    ],
  },
];

async function main() {
  console.log(`\n======================================================`);
  console.log(`Submitting All Templates Directly to Meta Graph API`);
  console.log(`Organization ID: ${ORG_ID}`);
  console.log(`======================================================\n`);

  const integration = await whatsAppIntegrationRepo.findByOrganizationId(ORG_ID);
  if (!integration || !integration.accountId || !integration.accessToken) {
    console.error("WhatsApp Integration not found or missing credentials!");
    return;
  }

  // Get current templates on Meta
  const metaList = await metaWhatsAppService.listTemplatesFromMeta(
    integration.accountId,
    integration.accessToken,
    { limit: 100 }
  );

  const existingMetaNames = new Set((metaList.data || []).map((t) => t.name));
  console.log(`Found ${existingMetaNames.size} existing templates on Meta WABA.`);

  for (const tmpl of META_TEMPLATES_TO_SUBMIT) {
    let wabaTemplateId: string | null = null;
    let metaStatus = "PENDING";

    if (existingMetaNames.has(tmpl.name)) {
      const match = (metaList.data || []).find((t) => t.name === tmpl.name);
      wabaTemplateId = match?.id || null;
      metaStatus = match?.status || "PENDING";
      console.log(`ℹ️ Template "${tmpl.name}" already exists on Meta (Status: ${metaStatus}, ID: ${wabaTemplateId})`);
    } else {
      try {
        console.log(`🚀 Submitting new template to Meta: "${tmpl.name}" (${tmpl.category})...`);
        const res = await metaWhatsAppService.createTemplate(
          integration.accountId,
          integration.accessToken,
          tmpl as any
        );
        wabaTemplateId = res.id;
        metaStatus = res.status || "PENDING";
        console.log(`✅ Successfully submitted to Meta! ID: ${wabaTemplateId}, Status: ${metaStatus}`);
      } catch (err: any) {
        console.error(`❌ Failed to submit "${tmpl.name}" to Meta:`, err.message, err.response?.data || "");
      }
    }

    // Map Meta status to Prisma enum
    let statusEnum: WhatsAppTemplateStatus = WhatsAppTemplateStatus.PENDING_APPROVAL;
    if (metaStatus === "APPROVED") {
      statusEnum = WhatsAppTemplateStatus.APPROVED;
    } else if (metaStatus === "REJECTED") {
      statusEnum = WhatsAppTemplateStatus.REJECTED;
    }

    if (wabaTemplateId) {
      await prisma.whatsAppMessageTemplate.updateMany({
        where: {
          organizationId: ORG_ID,
          name: tmpl.name,
        },
        data: {
          wabaTemplateId,
          status: statusEnum,
          category: tmpl.category as any,
          bodyText: tmpl.components.find((c) => c.type === "BODY")?.text || "",
        },
      });
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 All Templates Processed with Meta Cloud API!`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
