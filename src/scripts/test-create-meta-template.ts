import { whatsAppIntegrationRepo } from "../module/integration/repos/whatsapp-integration.repo.js";
import { metaWhatsAppService } from "../module/communication/services/meta-whatsapp.service.js";
import { prisma } from "../lib/prisma.js";
import { WhatsAppTemplateStatus } from "../types/types.js";

const ORG_ID = "05c35313-038c-4cc3-aed8-304a702fbf55";

async function main() {
  const integration = await whatsAppIntegrationRepo.findByOrganizationId(ORG_ID);
  if (!integration || !integration.accountId || !integration.accessToken) {
    console.error("WhatsApp Integration not found!");
    return;
  }

  console.log("Account ID:", integration.accountId);

  // Template to create on Meta
  const payload = {
    name: "meeting_reminder_15min_before",
    category: "UTILITY",
    language: "en_US",
    components: [
      {
        type: "BODY",
        text: "Hi {{1}}, we are starting {{2}}! Your {{3}} begins at {{4}}. Location: {{5}}. See you soon!",
        example: {
          body_text: [["John", "in 15 minutes", "Design Consultation", "10:00 PM", "Online"]],
        },
      },
    ],
  };

  try {
    console.log(`Submitting template "${payload.name}" to Meta...`);
    const result = await metaWhatsAppService.createTemplate(
      integration.accountId,
      integration.accessToken,
      payload as any
    );
    console.log("Meta Response:", result);

    if (result?.id) {
      await prisma.whatsAppMessageTemplate.updateMany({
        where: {
          organizationId: ORG_ID,
          name: payload.name,
        },
        data: {
          wabaTemplateId: result.id,
          status: (result.status as any) || WhatsAppTemplateStatus.APPROVED,
        },
      });
      console.log(`Updated local DB template with Meta WABA ID: ${result.id}`);
    }
  } catch (err: any) {
    console.error("Failed to create on Meta:", err.message, err.response?.data || "");
  }
}

main().catch(console.error);
