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
   * Helper: Automatically resolve canonical Meta App ID from access token
   * Self-heals in case the tenant entered a typo or truncated App ID in settings
   */
  async getEffectiveAppId(appId: string | undefined, accessToken: string): Promise<string> {
    try {
      const res = await axiosClient.get(`${this.baseUrl}/${this.graphApiVersion}/app`, {
        params: { access_token: accessToken },
        timeout: 10000,
      });
      if (res.data?.id) {
        return res.data.id;
      }
    } catch {
      // Fallback to configured appId if /app query fails
    }
    return appId || "";
  }

  /**
   * Upload sample media file to Meta Resumable Upload API to obtain header_handle
   * Required when submitting templates with IMAGE, VIDEO, or DOCUMENT headers
   */
  async uploadMediaSampleHandle(
    appId: string,
    accessToken: string,
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string = "sample_media"
  ): Promise<string> {
    try {
      const effectiveAppId = await this.getEffectiveAppId(appId, accessToken);

      // Step 1: Create upload session on Meta App
      const sessionUrl = `${this.baseUrl}/${this.graphApiVersion}/${effectiveAppId}/uploads`;
      const sessionRes = await axiosClient.post(
        sessionUrl,
        null,
        {
          params: {
            file_name: fileName,
            file_length: fileBuffer.length,
            file_type: mimeType,
            access_token: accessToken,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 20000,
        }
      );

      const uploadSessionId = sessionRes.data?.id;
      if (!uploadSessionId) {
        throw new Error("Meta did not return an upload session ID for template sample media");
      }

      // Step 2: Upload raw file buffer to session
      const uploadUrl = `${this.baseUrl}/${this.graphApiVersion}/${uploadSessionId}`;
      const uploadRes = await axiosClient.post(uploadUrl, fileBuffer, {
        headers: {
          Authorization: `OAuth ${accessToken}`,
          file_offset: "0",
          "Content-Type": "application/octet-stream",
        },
        timeout: 45000,
      });

      const handle = uploadRes.data?.h;
      if (!handle) {
        throw new Error("Meta did not return a valid sample handle ('h') for template media");
      }

      return handle;
    } catch (error: any) {
      this.handleMetaError(error, `Failed to upload sample media to Meta`);
    }
  }

  /**
   * Centralized Meta error sanitization & translation
   * Never leaks access tokens or sensitive API keys
   * Note: NEVER return 401 Unauthorized for third-party Meta API errors,
   * because returning 401 causes the frontend client auth interceptor to clear the CRM user session.
   */
  private handleMetaError(error: any, contextMsg: string): never {
    const status = error?.response?.status;
    const metaError = error?.response?.data?.error;
    const metaCode = metaError?.code;
    const details = metaError?.error_data?.details;
    const rawMsg = metaError?.message || metaError?.error_user_msg || error?.message || "Unknown error";
    const metaMsg = details ? `${rawMsg} (${details})` : rawMsg;

    // Meta Token Expiration / Auth error (Code 190, 102 or HTTP 401 from Meta)
    // Map to 400 Bad Request to prevent frontend interceptor from logging out the CRM user!
    if (metaCode === 190 || metaCode === 102 || (status === 401 && metaCode !== 100)) {
      throw new ErrorResponse(
        `Meta WhatsApp Authentication Error: Invalid or expired WhatsApp Cloud API Access Token. Please verify credentials in Settings > WhatsApp Integration. (${metaMsg})`,
        statusCode.Bad_Request
      );
    }

    if (status === 403 || metaCode === 200) {
      throw new ErrorResponse(
        `Meta Permission Denied: Your WhatsApp Business Account lacks required permissions. (${metaMsg})`,
        statusCode.Forbidden
      );
    }

    if (status === 429 || metaCode === 80007 || metaCode === 613) {
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

    // Invalid parameters / validation (Code 100 etc.)
    throw new ErrorResponse(
      `${contextMsg}: ${metaMsg}`,
      statusCode.Bad_Request
    );
  }
}

export const metaWhatsAppService = new MetaWhatsAppService();
