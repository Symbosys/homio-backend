import { prisma } from "../../../lib/prisma.js";
import type { User } from "../../../types/types.js";

/**
 * Service for resolving or auto-provisioning global Client User entities
 * across multi-tenant project creations and lead promotions.
 */
export class UserProvisioningService {
  /**
   * Resolves an existing User (by Phone or Email) or provisions a new global User with userType USER.
   * Ensures that projects across multiple organizations are unified under the same global User identity.
   *
   * @param input - Client contact and identity details
   * @returns Resolved or created global User entity
   */
  async resolveOrCreateClientUser(input: {
    phone?: string | null;
    email?: string | null;
    firstName: string;
    lastName?: string | null;
  }): Promise<User> {
    const rawPhoneDigits = input.phone ? input.phone.replace(/\D/g, "") : "";
    const cleanPhone = rawPhoneDigits.length >= 10 ? rawPhoneDigits.slice(-10) : (rawPhoneDigits || null);
    const cleanEmail = input.email?.trim().toLowerCase();

    let user: User | null = null;

    // 1. Primary Lookup by Phone
    if (cleanPhone) {
      user = await prisma.user.findFirst({
        where: {
          phone: cleanPhone,
          isDeleted: false,
        },
      });
    }

    // 2. Secondary Lookup by Email (if not matched by phone)
    if (!user && cleanEmail) {
      user = await prisma.user.findFirst({
        where: {
          email: cleanEmail,
          isDeleted: false,
        },
      });
    }

    // 3. If User already exists, return existing user
    if (user) {
      return user;
    }

    // 4. Fallback email if no email provided (since email is unique on User)
    const sanitizedPhone = cleanPhone ? cleanPhone.replace(/[^0-9]/g, "") : null;
    const newEmail = cleanEmail || (sanitizedPhone ? `${sanitizedPhone}@client.homiocrm.com` : `client_${Date.now()}@client.homiocrm.com`);

    // Ensure generated email is unique
    let finalEmail = newEmail;
    const emailConflict = await prisma.user.findUnique({
      where: { email: finalEmail },
      select: { id: true },
    });
    if (emailConflict) {
      finalEmail = `${Date.now()}_${newEmail}`;
    }

    // 5. Create new global User with userType = USER
    const newUser = await prisma.user.create({
      data: {
        firstName: input.firstName?.trim() || "Client",
        lastName: input.lastName?.trim() || null,
        phone: cleanPhone || null,
        email: finalEmail,
        userType: "USER",
        status: "ACTIVE",
        organizationId: null, // Global independent client identity
        phoneVerifiedAt: cleanPhone ? new Date() : null,
      },
    });

    return newUser;
  }
}

export const userProvisioningService = new UserProvisioningService();
