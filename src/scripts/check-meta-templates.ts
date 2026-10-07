import { whatsAppIntegrationRepo } from "../module/integration/repos/whatsapp-integration.repo.js";
import { metaWhatsAppService } from "../module/communication/services/meta-whatsapp.service.js";

const ORG_ID = "05c35313-038c-4cc3-aed8-304a702fbf55";

async function main() {
  const integration = await whatsAppIntegrationRepo.findByOrganizationId(ORG_ID);
  console.log("Integration found:", Boolean(integration));
  if (!integration) {
    console.log("No WhatsApp integration found for org:", ORG_ID);
    return;
  }

  console.log("AccountId (WABA ID):", integration.accountId);
  console.log("PhoneNumberId:", integration.phoneNumberId);

  if (integration.accountId && integration.accessToken) {
    try {
      const metaTemplates = await metaWhatsAppService.listTemplatesFromMeta(
        integration.accountId,
        integration.accessToken,
        { limit: 100 }
      );
      console.log("\n--- Live Templates on Meta WABA ---");
      console.log("Total Count:", metaTemplates.data?.length || 0);
      for (const t of metaTemplates.data || []) {
        console.log(`- [${t.status}] ${t.name} (${t.language}) [Category: ${t.category}] ID: ${t.id}`);
      }
    } catch (err: any) {
      console.error("Meta API error:", err.message, err.response?.data || "");
    }
  }
}

main().catch(console.error);
