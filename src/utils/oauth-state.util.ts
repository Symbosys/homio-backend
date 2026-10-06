import crypto from "node:crypto";
import { ENV } from "../config/env.js";

/**
 * Payload encoded inside the Google OAuth state parameter to protect against CSRF attacks.
 */
export interface OAuthStatePayload {
  organizationId: string;
  employeeId?: string | null;
  returnUrl?: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Derives a 32-byte secret key from the environment.
 */
function getStateSecretKey(): Buffer {
  const secret = ENV.JWT_SECRET || "homio_secure_oauth_state_secret_2026";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Generates a signed, tamper-proof state parameter with a 10-minute expiry for Google OAuth flow.
 *
 * @param payload - State attributes to sign (organizationId, employeeId, returnUrl)
 * @param ttlMinutes - Expiration time in minutes (default: 10)
 * @returns URL-safe Base64 state string with signature
 */
export function generateOAuthState(
  payload: {
    organizationId: string;
    employeeId?: string | null;
    returnUrl?: string;
  },
  ttlMinutes = 10,
): string {
  const now = Date.now();
  const statePayload: OAuthStatePayload = {
    organizationId: payload.organizationId,
    employeeId: payload.employeeId ?? null,
    returnUrl: payload.returnUrl,
    nonce: crypto.randomBytes(16).toString("hex"),
    issuedAt: now,
    expiresAt: now + ttlMinutes * 60 * 1000,
  };

  const jsonString = JSON.stringify(statePayload);
  const dataBase64 = Buffer.from(jsonString, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", getStateSecretKey())
    .update(dataBase64)
    .digest("base64url");

  return `${dataBase64}.${signature}`;
}

/**
 * Validates and decodes the OAuth state parameter.
 * Verifies HMAC signature, timestamp expiry, and required organization/employee attributes.
 *
 * @param stateString - Raw state received from Google OAuth redirect/callback
 * @returns Validated OAuthStatePayload
 */
export function verifyOAuthState(stateString: string): OAuthStatePayload {
  if (!stateString || typeof stateString !== "string") {
    throw new Error("Missing or invalid OAuth state parameter");
  }

  const parts = stateString.split(".");
  if (parts.length !== 2) {
    throw new Error("Malformed OAuth state parameter");
  }

  const [dataBase64, providedSignature] = parts;
  if (!dataBase64 || !providedSignature) {
    throw new Error("Malformed OAuth state parameter");
  }

  const expectedSignature = crypto
    .createHmac("sha256", getStateSecretKey())
    .update(dataBase64)
    .digest("base64url");

  const expectedBuf = Buffer.from(expectedSignature);
  const providedBuf = Buffer.from(providedSignature);

  // Constant time comparison with length safety
  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    throw new Error("Invalid OAuth state signature - potential CSRF attempt");
  }

  const jsonString = Buffer.from(dataBase64, "base64url").toString("utf8");
  const payload: OAuthStatePayload = JSON.parse(jsonString);

  if (Date.now() > payload.expiresAt) {
    throw new Error("OAuth state has expired. Please initiate Google Calendar connection again.");
  }

  if (!payload.organizationId) {
    throw new Error("Invalid OAuth state: Missing organization ID");
  }

  return payload;
}
