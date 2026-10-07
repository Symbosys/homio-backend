import { prisma } from "../lib/prisma.js";
import { whatsAppIntegrationRepo } from "../module/integration/repos/whatsapp-integration.repo.js";
import { metaWhatsAppService } from "../module/communication/services/meta-whatsapp.service.js";
import {
  WhatsAppTemplateStatus,
  WhatsAppTemplateCategory,
  WhatsAppHeaderType,
  FollowUpConfigType,
  FollowUpIntervalUnit,
  CommunicationChannel,
} from "../types/types.js";

const ORG_ID = "05c35313-038c-4cc3-aed8-304a702fbf55";

async function main() {
  console.log(`\n======================================================`);
  console.log(`Syncing & Assigning Live Approved Templates`);
  console.log(`Organization ID: ${ORG_ID}`);
  console.log(`======================================================\n`);

  const integration = await whatsAppIntegrationRepo.findByOrganizationId(ORG_ID);
  if (!integration || !integration.accountId || !integration.accessToken) {
    console.error("WhatsApp Integration not found!");
    return;
  }

  // 1. Fetch live templates from Meta
  const metaResult = await metaWhatsAppService.listTemplatesFromMeta(
    integration.accountId,
    integration.accessToken,
    { limit: 100 }
  );

  const metaTemplates = metaResult.data || [];
  console.log(`Found ${metaTemplates.length} total templates on Meta WABA.`);

  const approvedMetaTemplates = metaTemplates.filter((t) => t.status === "APPROVED");
  console.log(`\n--- Live APPROVED Templates on Meta ---`);
  for (const t of approvedMetaTemplates) {
    console.log(`✅ [APPROVED] ${t.name} (${t.language}) [Category: ${t.category}] ID: ${t.id}`);
  }

  // 2. Ensure each approved Meta template is synced/upserted in our database
  const dbApprovedTemplates: Record<string, string> = {};

  for (const metaT of approvedMetaTemplates) {
    const existing = await prisma.whatsAppMessageTemplate.findFirst({
      where: {
        organizationId: ORG_ID,
        name: metaT.name,
        language: metaT.language,
      },
    });

    const bodyComponent = metaT.components?.find((c: any) => c.type === "BODY");
    const headerComponent = metaT.components?.find((c: any) => c.type === "HEADER");

    let headerType: WhatsAppHeaderType = WhatsAppHeaderType.NONE;
    if (headerComponent) {
      if (headerComponent.format === "TEXT") headerType = WhatsAppHeaderType.TEXT;
      else if (headerComponent.format === "IMAGE") headerType = WhatsAppHeaderType.IMAGE;
      else if (headerComponent.format === "DOCUMENT") headerType = WhatsAppHeaderType.DOCUMENT;
      else if (headerComponent.format === "VIDEO") headerType = WhatsAppHeaderType.VIDEO;
    }

    let category: WhatsAppTemplateCategory = WhatsAppTemplateCategory.MARKETING;
    if (metaT.category === "UTILITY") category = WhatsAppTemplateCategory.UTILITY;
    else if (metaT.category === "AUTHENTICATION") category = WhatsAppTemplateCategory.AUTHENTICATION;

    let dbRecord;
    if (existing) {
      dbRecord = await prisma.whatsAppMessageTemplate.update({
        where: { id: existing.id },
        data: {
          wabaTemplateId: metaT.id,
          status: WhatsAppTemplateStatus.APPROVED,
          category,
          isEnabled: true,
          headerType,
          headerText: headerComponent?.text || null,
          bodyText: bodyComponent?.text || existing.bodyText || metaT.name,
          metaRawPayload: metaT as any,
          lastSyncedAt: new Date(),
        },
      });
    } else {
      dbRecord = await prisma.whatsAppMessageTemplate.create({
        data: {
          organizationId: ORG_ID,
          name: metaT.name,
          language: metaT.language || "en_US",
          wabaTemplateId: metaT.id,
          status: WhatsAppTemplateStatus.APPROVED,
          category,
          isEnabled: true,
          headerType,
          headerText: headerComponent?.text || null,
          bodyText: bodyComponent?.text || metaT.name,
          metaRawPayload: metaT as any,
          lastSyncedAt: new Date(),
        },
      });
    }

    dbApprovedTemplates[metaT.name] = dbRecord.id;
    console.log(`Synced DB Template: ${metaT.name} -> DB ID: ${dbRecord.id}`);
  }

  // 3. Fallback approved template resolution:
  // If we have hello_world, jaspers_market_order_confirmation_v1, jaspers_market_plain_text_v1
  const defaultUtilityTemplateId =
    dbApprovedTemplates["hello_world"] ||
    dbApprovedTemplates["jaspers_market_order_confirmation_v1"] ||
    Object.values(dbApprovedTemplates)[0];

  const defaultMarketingTemplateId =
    dbApprovedTemplates["jaspers_market_plain_text_v1"] ||
    dbApprovedTemplates["jaspers_market_image_cta_v1"] ||
    defaultUtilityTemplateId;

  console.log(`\nUsing Default Approved Utility Template: ID ${defaultUtilityTemplateId}`);
  console.log(`Using Default Approved Marketing Template: ID ${defaultMarketingTemplateId}`);

  // 4. Update Meeting Follow-Up config steps with live APPROVED templates
  let meetingConfig = await prisma.orgFollowUpConfig.findFirst({
    where: {
      organizationId: ORG_ID,
      type: FollowUpConfigType.MEETING_REMINDER,
    },
  });

  if (!meetingConfig) {
    meetingConfig = await prisma.orgFollowUpConfig.create({
      data: {
        organizationId: ORG_ID,
        type: FollowUpConfigType.MEETING_REMINDER,
        name: "Consultation & Site Visit Multi-Interval Reminders",
        description: "Automated reminders dispatched 1 day, 1 hour, 45 mins, 30 mins, and 15 mins before client meetings.",
        isActive: true,
        isDefault: true,
      },
    });
  }

  await prisma.meetingFollowUpStep.deleteMany({
    where: { configId: meetingConfig.id },
  });

  const meetingStepsToCreate = [
    {
      stepOrder: 1,
      intervalUnit: FollowUpIntervalUnit.DAYS_BEFORE,
      intervalValue: 1,
      channel: CommunicationChannel.WHATSAPP,
      templateId: defaultUtilityTemplateId,
      dynamicTimeVariableFormat: "in {count} days",
      isActive: true,
    },
    {
      stepOrder: 2,
      intervalUnit: FollowUpIntervalUnit.HOURS_BEFORE,
      intervalValue: 1,
      channel: CommunicationChannel.WHATSAPP,
      templateId: defaultUtilityTemplateId,
      dynamicTimeVariableFormat: "in {count} hour",
      isActive: true,
    },
    {
      stepOrder: 3,
      intervalUnit: FollowUpIntervalUnit.MINUTES_BEFORE,
      intervalValue: 45,
      channel: CommunicationChannel.WHATSAPP,
      templateId: defaultUtilityTemplateId,
      dynamicTimeVariableFormat: "in {count} minutes",
      isActive: true,
    },
    {
      stepOrder: 4,
      intervalUnit: FollowUpIntervalUnit.MINUTES_BEFORE,
      intervalValue: 30,
      channel: CommunicationChannel.WHATSAPP,
      templateId: defaultUtilityTemplateId,
      dynamicTimeVariableFormat: "in {count} minutes",
      isActive: true,
    },
    {
      stepOrder: 5,
      intervalUnit: FollowUpIntervalUnit.MINUTES_BEFORE,
      intervalValue: 15,
      channel: CommunicationChannel.WHATSAPP,
      templateId: defaultUtilityTemplateId,
      dynamicTimeVariableFormat: "in {count} minutes",
      isActive: true,
    },
  ];

  for (const step of meetingStepsToCreate) {
    await prisma.meetingFollowUpStep.create({
      data: {
        configId: meetingConfig.id,
        organizationId: ORG_ID,
        stepOrder: step.stepOrder,
        intervalUnit: step.intervalUnit,
        intervalValue: step.intervalValue,
        channel: step.channel,
        templateId: step.templateId,
        dynamicTimeVariableFormat: step.dynamicTimeVariableFormat,
        isActive: step.isActive,
      },
    });
  }
  console.log(`\n✅ Meeting Follow-Up config updated with APPROVED template: (1d, 1h, 45m, 30m, 15m)`);

  // 5. Update Lead Follow-Up config steps with live APPROVED marketing template
  let leadConfig = await prisma.orgFollowUpConfig.findFirst({
    where: {
      organizationId: ORG_ID,
      type: FollowUpConfigType.LEAD_NO_RESPONSE,
    },
  });

  if (!leadConfig) {
    leadConfig = await prisma.orgFollowUpConfig.create({
      data: {
        organizationId: ORG_ID,
        type: FollowUpConfigType.LEAD_NO_RESPONSE,
        name: "Standard 7-Day Lead Nurturing Sequence",
        description: "Automated WhatsApp follow-up sequence on Day 1, Day 3, Day 4, and Day 7 (Final).",
        preferredSendTime: "10:00",
        isActive: true,
        isDefault: true,
      },
    });
  }

  await prisma.leadFollowUpStep.deleteMany({
    where: { configId: leadConfig.id },
  });

  const leadStepsToCreate = [
    {
      stepOrder: 1,
      dayOffset: 1,
      channel: CommunicationChannel.WHATSAPP,
      templateId: defaultMarketingTemplateId,
      isFinalStep: false,
      isActive: true,
    },
    {
      stepOrder: 2,
      dayOffset: 3,
      channel: CommunicationChannel.WHATSAPP,
      templateId: defaultMarketingTemplateId,
      isFinalStep: false,
      isActive: true,
    },
    {
      stepOrder: 3,
      dayOffset: 4,
      channel: CommunicationChannel.WHATSAPP,
      templateId: defaultMarketingTemplateId,
      isFinalStep: false,
      isActive: true,
    },
    {
      stepOrder: 4,
      dayOffset: 7,
      channel: CommunicationChannel.WHATSAPP,
      templateId: defaultMarketingTemplateId,
      isFinalStep: true,
      isActive: true,
    },
  ];

  for (const step of leadStepsToCreate) {
    await prisma.leadFollowUpStep.create({
      data: {
        configId: leadConfig.id,
        organizationId: ORG_ID,
        stepOrder: step.stepOrder,
        dayOffset: step.dayOffset,
        channel: step.channel,
        templateId: step.templateId,
        isFinalStep: step.isFinalStep,
        isActive: step.isActive,
      },
    });
  }
  console.log(`✅ Lead Follow-Up config updated with APPROVED template: (Day 1, 3, 4, 7)`);

  console.log(`\n======================================================`);
  console.log(`🎉 Live Approved Templates Successfully Configured!`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
