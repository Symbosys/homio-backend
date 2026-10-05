import { AxiosError } from "axios";
import { axiosClient } from "../../../lib/axios.js";
import { LlmProvider } from "../../../types/types.js";

/**
 * Failure returned by a provider during a live API key check.
 * The message is already scrubbed of the API key.
 */
export class LlmProviderVerificationError extends Error {
  /**
   * @param httpStatus Provider HTTP status, when the call reached the vendor
   * @param errorCode Stable code stored on the credential row
   * @param message Safe message safe to persist and return
   */
  constructor(
    public readonly httpStatus: number | undefined,
    public readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = "LlmProviderVerificationError";
  }
}

/**
 * Removes the raw key from a provider error before it is stored or returned.
 * @param message Provider or transport error text
 * @param apiKey Raw key that must not leak into logs or the database
 */
function scrubApiKey(message: string, apiKey: string): string {
  const scrubbed = apiKey ? message.split(apiKey).join("[redacted]") : message;
  return scrubbed.slice(0, 500);
}

/**
 * Calls each vendor's model-list endpoint. A 200 response means the key is accepted.
 * The key is sent in a header so it is not placed in the Gemini query string.
 * @param provider Vendor selected by the organization
 * @param apiKey Raw API key stored for that vendor
 */
export async function verifyLlmProviderKey(provider: LlmProvider, apiKey: string): Promise<void> {
  try {
    if (provider === LlmProvider.OPENAI) {
      await axiosClient.get("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
      });
      return;
    }

    if (provider === LlmProvider.GEMINI) {
      await axiosClient.get("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": apiKey },
        timeout: 15000,
      });
      return;
    }

    await axiosClient.get("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      timeout: 15000,
    });
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const data = error.response?.data as { error?: { message?: string; type?: string } } | undefined;
      const rawMessage =
        data?.error?.message ||
        data?.error?.type ||
        error.message ||
        "Provider verification failed";
      throw new LlmProviderVerificationError(
        status,
        status ? `HTTP_${status}` : "NETWORK",
        scrubApiKey(String(rawMessage), apiKey),
      );
    }

    const message = error instanceof Error ? error.message : "Provider verification failed";
    throw new LlmProviderVerificationError(undefined, "NETWORK", scrubApiKey(message, apiKey));
  }
}

/**
 * Replaceable verifier used by the integration service.
 * Tests swap `verify` so provider HTTP calls are not made.
 */
export const llmProviderVerifier = {
  verify: verifyLlmProviderKey,
};
