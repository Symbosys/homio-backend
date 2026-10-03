import { axiosClient } from "../../../lib/axios.js";
import { statusCode } from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";

export interface MetaTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "DOCUMENT" | "VIDEO" | "LOCATION";
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE" | "FLOW" | "OTP" | string;
    text?: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface MetaTemplateItem {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: MetaTemplateComponent[];
  quality_score?: {
    score?: string;
  };
  rejected_reason?: string;
  last_updated_time?: string;
}

/**
 * Dedicated Meta Graph API Client for WhatsApp Message Templates
 * Handles token authentication, endpoint dispatch, rate limits, and error sanitization.
 */
export class MetaWhatsAppService {
  private readonly graphApiVersion = "v21.0";
  private readonly baseUrl = "https://graph.facebook.com";

  /**
   * Fetch a single WhatsApp template by name directly from Meta Graph API
   */
  async fetchTemplateByName(
    accountId: string,
    accessToken: string,
    templateName: string
  ): Promise<MetaTemplateItem | null> {
    const url = `${this.baseUrl}/${this.graphApiVersion}/${accountId}/message_templates`;

    try {
      const response = await axiosClient.get<{
        data: MetaTemplateItem[];
        paging?: any;
      }>(url, {
        params: {
          name: templateName,
          fields: "id,name,status,category,language,components,quality_score,rejected_reason,last_updated_time",
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000,
      });

      const matched = response.data?.data?.find((t) => t.name === templateName);
      return matched || null;
    } catch (error: any) {
      this.handleMetaError(error, `Failed to fetch template "${templateName}" from Meta`);
      return null;
    }
  }

  /**
   * Create a new message template on Meta Graph API
   */
  async createTemplate(
    accountId: string,
    accessToken: string,
    payload: {
      name: string;
      category: string;
      language: string;
      components: MetaTemplateComponent[];
    }
  ): Promise<{ id: string; status: string }> {
    const url = `${this.baseUrl}/${this.graphApiVersion}/${accountId}/message_templates`;

    try {
      const response = await axiosClient.post<{ id: string; status: string }>(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 25000,
      });

      return response.data;
    } catch (error: any) {
      this.handleMetaError(error, `Failed to submit template "${payload.name}" to Meta`);
    }
  }

  /**
   * Delete a WhatsApp template from Meta Graph API (Idempotent: ignores 404 / already deleted)
   */
  async deleteTemplateByName(
    accountId: string,
    accessToken: string,
    templateName: string
  ): Promise<{ success: boolean; alreadyDeleted: boolean }> {
    const url = `${this.baseUrl}/${this.graphApiVersion}/${accountId}/message_templates`;

    try {
      await axiosClient.delete(url, {
        params: { name: templateName },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000,
      });

      return { success: true, alreadyDeleted: false };
    } catch (error: any) {
      // If Meta returns 404 or indicates template does not exist, treat as idempotent success
      const metaCode = error?.response?.data?.error?.code;
      const metaStatus = error?.response?.status;
      if (metaStatus === 404 || metaCode === 100 || error?.response?.data?.error?.error_subcode === 2388043) {
        return { success: true, alreadyDeleted: true };
      }

      this.handleMetaError(error, `Failed to delete template "${templateName}" on Meta`);
      return { success: false, alreadyDeleted: false };
    }
  }

  /**
   * Update template components on Meta Graph API
   */
  async updateTemplateComponents(
    wabaTemplateId: string,
    accessToken: string,
    components: MetaTemplateComponent[]
  ): Promise<boolean> {
    const url = `${this.baseUrl}/${this.graphApiVersion}/${wabaTemplateId}`;

    try {
      await axiosClient.post(
        url,
        { components },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 20000,
        }
      );
      return true;
    } catch (error: any) {
      this.handleMetaError(error, `Failed to update template components on Meta`);
      return false;
    }
  }

  /**
   * Centralized Meta error sanitization & translation
   * Never leaks access tokens or sensitive API keys
   */
  private handleMetaError(error: any, contextMsg: string): never {
    const status = error?.response?.status;
    const metaError = error?.response?.data?.error;
    const metaMsg = metaError?.message || metaError?.error_user_msg || error?.message || "Unknown error";

    if (status === 401 || metaError?.type === "OAuthException") {
      throw new ErrorResponse(
        `Meta Authentication Failure: Invalid or expired WhatsApp Cloud API Access Token. (${metaMsg})`,
        statusCode.Unauthorized
      );
    }

    if (status === 403) {
      throw new ErrorResponse(
        `Meta Permission Denied: Your WhatsApp Business Account lacks required permissions. (${metaMsg})`,
        statusCode.Forbidden
      );
    }

    if (status === 429 || metaError?.code === 80007 || metaError?.code === 613) {
      throw new ErrorResponse(
        `Meta Rate Limit Exceeded: Too many template requests to WhatsApp Cloud API. Please try again shortly.`,
        statusCode.Too_Many_Requests
      );
    }

    if (status === 404) {
      throw new ErrorResponse(
        `Template or WhatsApp Business Account not found on Meta. (${metaMsg})`,
        statusCode.Not_Found
      );
    }

    throw new ErrorResponse(
      `${contextMsg}: ${metaMsg}`,
      status >= 400 && status < 500 ? statusCode.Bad_Request : statusCode.Internal_Server_Error
    );
  }
}

export const metaWhatsAppService = new MetaWhatsAppService();
