import { prisma } from "../lib/prisma.js";
import {
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
  WhatsAppHeaderType,
  CrmMappingEntity,
  WhatsAppVariableComponent,
  CommunicationChannel,
  FollowUpConfigType,
  FollowUpIntervalUnit,
} from "../types/types.js";

const TARGET_ORG_ID = "05c35313-038c-4cc3-aed8-304a702fbf55";

/**
 * Seed script to create WhatsApp Message Templates and configure
 * Auto Follow-Up & Meeting Reminders (15m, 30m, 45m, 1h, 1d) for the target organization.
 */
async function main() {
  console.log(`\n======================================================`);
  console.log(`Starting Auto Follow-Up & Reminder Seed Script`);
  console.log(`Target Organization ID: ${TARGET_ORG_ID}`);
  console.log(`======================================================\n`);

  // 1. Verify Organization exists
  const org = await prisma.organization.findUnique({
    where: { id: TARGET_ORG_ID },
  });

  if (!org) {
    console.error(`❌ Organization with ID ${TARGET_ORG_ID} not found in database!`);
    process.exit(1);
  }

  console.log(`✅ Found Organization: "${org.name}" (Slug: ${org.slug})\n`);

  // ==========================================
  // 2. TEMPLATE DEFINITIONS
  // ==========================================
  const templatesToSeed = [
    // --- LEAD AUTO FOLLOW-UP TEMPLATES ---
    {
      name: "lead_followup_day1_checkin",
      category: WhatsAppTemplateCategory.MARKETING,
      status: WhatsAppTemplateStatus.APPROVED,
      language: "en_US",
      headerType: WhatsAppHeaderType.TEXT,
      headerText: "Interior Design Consultation",
      bodyText:
        "Hello {{1}},\n\nThank you for reaching out to Homio Design Studio! We noticed you were exploring interior design solutions for your space. Our expert designers have curated preliminary moodboards and budget estimates for you.\n\nWould you like to schedule a free 1-on-1 design consultation call today?",
      footerText: "Homio Design Team",
      variables: [
        {
          position: 1,
          parameter: "{{1}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.LEAD,
          mappingField: "firstName",
          fallbackValue: "there",
          label: "Lead First Name",
        },
      ],
    },
    {
      name: "lead_followup_day3_portfolio",
      category: WhatsAppTemplateCategory.MARKETING,
      status: WhatsAppTemplateStatus.APPROVED,
      language: "en_US",
      headerType: WhatsAppHeaderType.TEXT,
      headerText: "Recent Completed Projects",
      bodyText:
        "Hi {{1}},\n\nJust checking in! We wanted to share some of our recently delivered 2BHK and 3BHK luxury interior transformations in your city.\n\nTake a look at how we maximized space and aesthetic value within client budgets. Our team is ready to provide a customized 3D floor plan layout for your property.\n\nShall we book a quick 15-minute consultation to discuss your vision?",
      footerText: "Homio Design Studio",
      variables: [
        {
          position: 1,
          parameter: "{{1}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.LEAD,
          mappingField: "firstName",
          fallbackValue: "there",
          label: "Lead First Name",
        },
      ],
    },
    {
      name: "lead_followup_day4_offer",
      category: WhatsAppTemplateCategory.MARKETING,
      status: WhatsAppTemplateStatus.APPROVED,
      language: "en_US",
      headerType: WhatsAppHeaderType.TEXT,
      headerText: "Exclusive Design Consultation Offer",
      bodyText:
        "Hello {{1}},\n\nWe know choosing the right interior partner is a big decision! To help you take the first step, we're offering a complimentary 3D visual walkthrough and detailed itemized cost estimation for your project.\n\nReply to this message or schedule a call with our senior architect whenever you're ready.",
      footerText: "Homio Interiors",
      variables: [
        {
          position: 1,
          parameter: "{{1}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.LEAD,
          mappingField: "firstName",
          fallbackValue: "there",
          label: "Lead First Name",
        },
      ],
    },
    {
      name: "lead_followup_day7_final",
      category: WhatsAppTemplateCategory.MARKETING,
      status: WhatsAppTemplateStatus.APPROVED,
      language: "en_US",
      headerType: WhatsAppHeaderType.TEXT,
      headerText: "Final Check-In from Homio",
      bodyText:
        "Hi {{1}},\n\nWe haven't heard back from you regarding your interior design inquiry. We understand you might be busy or exploring other timelines.\n\nWe will pause our follow-ups for now so we don't crowd your inbox. Feel free to message us back anytime whenever you want to restart your interior project!\n\nWishing you all the best!",
      footerText: "Homio Design Studio",
      variables: [
        {
          position: 1,
          parameter: "{{1}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.LEAD,
          mappingField: "firstName",
          fallbackValue: "there",
          label: "Lead First Name",
        },
      ],
    },

    // --- MEETING AUTO FOLLOW-UP / REMINDER TEMPLATES ---
    {
      name: "meeting_reminder_1day_before",
      category: WhatsAppTemplateCategory.UTILITY,
      status: WhatsAppTemplateStatus.APPROVED,
      language: "en_US",
      headerType: WhatsAppHeaderType.TEXT,
      headerText: "Upcoming Consultation Reminder",
      bodyText:
        "Hello {{1}},\n\nThis is a friendly reminder that your {{2}} with Homio Design Studio is scheduled for {{3}} at {{4}} ({{5}}).\n\nOur design consultant {{6}} is looking forward to discussing your interior concepts and spatial layout.\n\nIf you need to reschedule or have any questions beforehand, simply reply to this message!",
      footerText: "Homio Design Team",
      variables: [
        {
          position: 1,
          parameter: "{{1}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOMER,
          mappingField: "firstName",
          fallbackValue: "Valued Client",
          label: "Client First Name",
        },
        {
          position: 2,
          parameter: "{{2}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "title",
          fallbackValue: "Design Consultation",
          label: "Meeting Title",
        },
        {
          position: 3,
          parameter: "{{3}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "scheduledDate",
          fallbackValue: "your scheduled date",
          label: "Meeting Date",
        },
        {
          position: 4,
          parameter: "{{4}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "scheduledTime",
          fallbackValue: "your scheduled time",
          label: "Meeting Time",
        },
        {
          position: 5,
          parameter: "{{5}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOM_STATIC,
          mappingField: "time_to_meeting",
          fallbackValue: "tomorrow",
          label: "Time to Meeting (Relative)",
        },
        {
          position: 6,
          parameter: "{{6}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.ASSIGNED_EMPLOYEE,
          mappingField: "name",
          fallbackValue: "our team",
          label: "Assigned Consultant",
        },
      ],
    },
    {
      name: "meeting_reminder_1hour_before",
      category: WhatsAppTemplateCategory.UTILITY,
      status: WhatsAppTemplateStatus.APPROVED,
      language: "en_US",
      headerType: WhatsAppHeaderType.TEXT,
      headerText: "Meeting Starting in 1 Hour",
      bodyText:
        "Hi {{1}},\n\nYour {{2}} is coming up {{3}} at {{4}}.\n\nPlease ensure you have your floor plans or room photos handy if you'd like us to review them during the session.\n\nSee you soon!",
      footerText: "Homio Design Studio",
      variables: [
        {
          position: 1,
          parameter: "{{1}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOMER,
          mappingField: "firstName",
          fallbackValue: "there",
          label: "Client First Name",
        },
        {
          position: 2,
          parameter: "{{2}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "title",
          fallbackValue: "Consultation",
          label: "Meeting Title",
        },
        {
          position: 3,
          parameter: "{{3}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOM_STATIC,
          mappingField: "time_to_meeting",
          fallbackValue: "in 1 hour",
          label: "Time to Meeting (Relative)",
        },
        {
          position: 4,
          parameter: "{{4}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "scheduledTime",
          fallbackValue: "your appointment time",
          label: "Meeting Time",
        },
      ],
    },
    {
      name: "meeting_reminder_45min_before",
      category: WhatsAppTemplateCategory.UTILITY,
      status: WhatsAppTemplateStatus.APPROVED,
      language: "en_US",
      headerType: WhatsAppHeaderType.TEXT,
      headerText: "Meeting Starting in 45 Minutes",
      bodyText:
        "Hi {{1}},\n\nQuick reminder: Your {{2}} with Homio is starting {{3}} (at {{4}}).\n\nOur consultant is getting the project portfolio ready for your session. Let us know if you have any trouble joining!",
      footerText: "Homio Design Studio",
      variables: [
        {
          position: 1,
          parameter: "{{1}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOMER,
          mappingField: "firstName",
          fallbackValue: "there",
          label: "Client First Name",
        },
        {
          position: 2,
          parameter: "{{2}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "title",
          fallbackValue: "Consultation",
          label: "Meeting Title",
        },
        {
          position: 3,
          parameter: "{{3}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOM_STATIC,
          mappingField: "time_to_meeting",
          fallbackValue: "in 45 minutes",
          label: "Time to Meeting (Relative)",
        },
        {
          position: 4,
          parameter: "{{4}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "scheduledTime",
          fallbackValue: "the scheduled time",
          label: "Meeting Time",
        },
      ],
    },
    {
      name: "meeting_reminder_30min_before",
      category: WhatsAppTemplateCategory.UTILITY,
      status: WhatsAppTemplateStatus.APPROVED,
      language: "en_US",
      headerType: WhatsAppHeaderType.TEXT,
      headerText: "Meeting Starting in 30 Minutes",
      bodyText:
        "Hello {{1}},\n\nJust 30 minutes to go! Your {{2}} is starting {{3}} at {{4}}.\n\nMeeting Location / Link: {{5}}\n\nWe look forward to meeting with you!",
      footerText: "Homio Design Studio",
      variables: [
        {
          position: 1,
          parameter: "{{1}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOMER,
          mappingField: "firstName",
          fallbackValue: "there",
          label: "Client First Name",
        },
        {
          position: 2,
          parameter: "{{2}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "title",
          fallbackValue: "Meeting",
          label: "Meeting Title",
        },
        {
          position: 3,
          parameter: "{{3}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOM_STATIC,
          mappingField: "time_to_meeting",
          fallbackValue: "in 30 minutes",
          label: "Time to Meeting (Relative)",
        },
        {
          position: 4,
          parameter: "{{4}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "scheduledTime",
          fallbackValue: "scheduled time",
          label: "Meeting Time",
        },
        {
          position: 5,
          parameter: "{{5}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "location",
          fallbackValue: "Online / Office",
          label: "Location or Link",
        },
      ],
    },
    {
      name: "meeting_reminder_15min_before",
      category: WhatsAppTemplateCategory.UTILITY,
      status: WhatsAppTemplateStatus.APPROVED,
      language: "en_US",
      headerType: WhatsAppHeaderType.TEXT,
      headerText: "Meeting Starting in 15 Minutes",
      bodyText:
        "Hi {{1}},\n\nWe are starting {{2}}! Your {{3}} begins at {{4}}.\n\nLocation / Meeting Link: {{5}}\n\nSee you in a few minutes!",
      footerText: "Homio Design Studio",
      variables: [
        {
          position: 1,
          parameter: "{{1}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOMER,
          mappingField: "firstName",
          fallbackValue: "there",
          label: "Client First Name",
        },
        {
          position: 2,
          parameter: "{{2}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.CUSTOM_STATIC,
          mappingField: "time_to_meeting",
          fallbackValue: "in 15 minutes",
          label: "Time to Meeting (Relative)",
        },
        {
          position: 3,
          parameter: "{{3}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "title",
          fallbackValue: "Meeting",
          label: "Meeting Title",
        },
        {
          position: 4,
          parameter: "{{4}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "scheduledTime",
          fallbackValue: "scheduled time",
          label: "Meeting Time",
        },
        {
          position: 5,
          parameter: "{{5}}",
          component: WhatsAppVariableComponent.BODY,
          mappingEntity: CrmMappingEntity.MEETING,
          mappingField: "location",
          fallbackValue: "Online / Office",
          label: "Location or Link",
        },
      ],
    },
  ];

  // Map to store created template IDs by name
  const createdTemplateIds: Record<string, string> = {};

  for (const tmpl of templatesToSeed) {
    const existing = await prisma.whatsAppMessageTemplate.findUnique({
      where: {
        organizationId_name_language: {
          organizationId: TARGET_ORG_ID,
          name: tmpl.name,
          language: tmpl.language,
        },
      },
    });

    let templateRecord;
    if (existing) {
      console.log(`ℹ️ Updating existing template: ${tmpl.name}`);
      templateRecord = await prisma.whatsAppMessageTemplate.update({
        where: { id: existing.id },
        data: {
          category: tmpl.category,
          status: tmpl.status,
          isEnabled: true,
          headerType: tmpl.headerType,
          headerText: tmpl.headerText,
          bodyText: tmpl.bodyText,
          footerText: tmpl.footerText,
        },
      });

      // Refresh variables
      await prisma.whatsAppTemplateVariable.deleteMany({
        where: { templateId: existing.id },
      });
    } else {
      console.log(`✨ Creating template: ${tmpl.name}`);
      templateRecord = await prisma.whatsAppMessageTemplate.create({
        data: {
          organizationId: TARGET_ORG_ID,
          name: tmpl.name,
          language: tmpl.language,
          category: tmpl.category,
          status: tmpl.status,
          isEnabled: true,
          headerType: tmpl.headerType,
          headerText: tmpl.headerText,
          bodyText: tmpl.bodyText,
          footerText: tmpl.footerText,
        },
      });
    }

    createdTemplateIds[tmpl.name] = templateRecord.id;

    // Create variables
    if (tmpl.variables && tmpl.variables.length > 0) {
      await prisma.whatsAppTemplateVariable.createMany({
        data: tmpl.variables.map((v) => ({
          templateId: templateRecord.id,
          position: v.position,
          parameter: v.parameter,
          component: v.component,
          mappingEntity: v.mappingEntity,
          mappingField: v.mappingField,
          fallbackValue: v.fallbackValue,
          label: v.label,
          isRequired: true,
          isMapped: true,
        })),
      });
    }
  }

  console.log(`\n✅ Successfully seeded all ${templatesToSeed.length} WhatsApp message templates!\n`);

  // ==========================================
  // 3. SEED MEETING AUTO FOLLOW-UP CONFIG
  // ==========================================
  console.log(`Configuring MEETING_REMINDER sequence (1d, 1h, 45m, 30m, 15m)...`);

  let meetingConfig = await prisma.orgFollowUpConfig.findFirst({
    where: {
      organizationId: TARGET_ORG_ID,
      type: FollowUpConfigType.MEETING_REMINDER,
    },
  });

  if (!meetingConfig) {
    meetingConfig = await prisma.orgFollowUpConfig.create({
      data: {
        organizationId: TARGET_ORG_ID,
        type: FollowUpConfigType.MEETING_REMINDER,
        name: "Consultation & Site Visit Multi-Interval Reminders",
        description: "Automated reminders dispatched 1 day, 1 hour, 45 mins, 30 mins, and 15 mins before client meetings.",
        isActive: true,
        isDefault: true,
      },
    });
  } else {
    meetingConfig = await prisma.orgFollowUpConfig.update({
      where: { id: meetingConfig.id },
      data: {
        name: "Consultation & Site Visit Multi-Interval Reminders",
        description: "Automated reminders dispatched 1 day, 1 hour, 45 mins, 30 mins, and 15 mins before client meetings.",
        isActive: true,
        isDefault: true,
      },
    });
  }

  // Clear existing steps to recreate clean ordered sequence
  await prisma.meetingFollowUpStep.deleteMany({
    where: { configId: meetingConfig.id },
  });

  const meetingStepsData = [
    {
      stepOrder: 1,
      intervalUnit: FollowUpIntervalUnit.DAYS_BEFORE,
      intervalValue: 1,
      channel: CommunicationChannel.WHATSAPP,
      templateId: createdTemplateIds["meeting_reminder_1day_before"],
      dynamicTimeVariableFormat: "in {count} days",
      isActive: true,
    },
    {
      stepOrder: 2,
      intervalUnit: FollowUpIntervalUnit.HOURS_BEFORE,
      intervalValue: 1,
      channel: CommunicationChannel.WHATSAPP,
      templateId: createdTemplateIds["meeting_reminder_1hour_before"],
      dynamicTimeVariableFormat: "in {count} hour",
      isActive: true,
    },
    {
      stepOrder: 3,
      intervalUnit: FollowUpIntervalUnit.MINUTES_BEFORE,
      intervalValue: 45,
      channel: CommunicationChannel.WHATSAPP,
      templateId: createdTemplateIds["meeting_reminder_45min_before"],
      dynamicTimeVariableFormat: "in {count} minutes",
      isActive: true,
    },
    {
      stepOrder: 4,
      intervalUnit: FollowUpIntervalUnit.MINUTES_BEFORE,
      intervalValue: 30,
      channel: CommunicationChannel.WHATSAPP,
      templateId: createdTemplateIds["meeting_reminder_30min_before"],
      dynamicTimeVariableFormat: "in {count} minutes",
      isActive: true,
    },
    {
      stepOrder: 5,
      intervalUnit: FollowUpIntervalUnit.MINUTES_BEFORE,
      intervalValue: 15,
      channel: CommunicationChannel.WHATSAPP,
      templateId: createdTemplateIds["meeting_reminder_15min_before"],
      dynamicTimeVariableFormat: "in {count} minutes",
      isActive: true,
    },
  ];

  for (const step of meetingStepsData) {
    await prisma.meetingFollowUpStep.create({
      data: {
        configId: meetingConfig.id,
        organizationId: TARGET_ORG_ID,
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

  console.log(`✅ Seeded ${meetingStepsData.length} Meeting Reminder Steps (1d, 1h, 45m, 30m, 15m)\n`);

  // ==========================================
  // 4. SEED LEAD AUTO FOLLOW-UP CONFIG
  // ==========================================
  console.log(`Configuring LEAD_NO_RESPONSE sequence (Day 1, Day 3, Day 4, Day 7)...`);

  let leadConfig = await prisma.orgFollowUpConfig.findFirst({
    where: {
      organizationId: TARGET_ORG_ID,
      type: FollowUpConfigType.LEAD_NO_RESPONSE,
    },
  });

  if (!leadConfig) {
    leadConfig = await prisma.orgFollowUpConfig.create({
      data: {
        organizationId: TARGET_ORG_ID,
        type: FollowUpConfigType.LEAD_NO_RESPONSE,
        name: "Standard 7-Day Lead Nurturing Sequence",
        description: "Automated WhatsApp follow-up sequence on Day 1, Day 3, Day 4, and Day 7 (Final).",
        preferredSendTime: "10:00",
        isActive: true,
        isDefault: true,
      },
    });
  } else {
    leadConfig = await prisma.orgFollowUpConfig.update({
      where: { id: leadConfig.id },
      data: {
        name: "Standard 7-Day Lead Nurturing Sequence",
        description: "Automated WhatsApp follow-up sequence on Day 1, Day 3, Day 4, and Day 7 (Final).",
        preferredSendTime: "10:00",
        isActive: true,
        isDefault: true,
      },
    });
  }

  // Clear existing steps to recreate clean ordered sequence
  await prisma.leadFollowUpStep.deleteMany({
    where: { configId: leadConfig.id },
  });

  const leadStepsData = [
    {
      stepOrder: 1,
      dayOffset: 1,
      channel: CommunicationChannel.WHATSAPP,
      templateId: createdTemplateIds["lead_followup_day1_checkin"],
      isFinalStep: false,
      isActive: true,
    },
    {
      stepOrder: 2,
      dayOffset: 3,
      channel: CommunicationChannel.WHATSAPP,
      templateId: createdTemplateIds["lead_followup_day3_portfolio"],
      isFinalStep: false,
      isActive: true,
    },
    {
      stepOrder: 3,
      dayOffset: 4,
      channel: CommunicationChannel.WHATSAPP,
      templateId: createdTemplateIds["lead_followup_day4_offer"],
      isFinalStep: false,
      isActive: true,
    },
    {
      stepOrder: 4,
      dayOffset: 7,
      channel: CommunicationChannel.WHATSAPP,
      templateId: createdTemplateIds["lead_followup_day7_final"],
      isFinalStep: true,
      isActive: true,
    },
  ];

  for (const step of leadStepsData) {
    await prisma.leadFollowUpStep.create({
      data: {
        configId: leadConfig.id,
        organizationId: TARGET_ORG_ID,
        stepOrder: step.stepOrder,
        dayOffset: step.dayOffset,
        channel: step.channel,
        templateId: step.templateId,
        isFinalStep: step.isFinalStep,
        isActive: step.isActive,
      },
    });
  }

  console.log(`✅ Seeded ${leadStepsData.length} Lead Follow-Up Steps (Day 1, 3, 4, 7)\n`);

  console.log(`======================================================`);
  console.log(`🎉 Auto Follow-Up & Reminder Seeding Completed Successfully!`);
  console.log(`======================================================\n`);
}

main()
  .catch((e) => {
    console.error("❌ Error executing seed script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
