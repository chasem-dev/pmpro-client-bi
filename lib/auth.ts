import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin";

export interface AppUser {
  userId: string;
  email: string;
  /** Active Clerk organization, when the session has one selected. */
  orgId: string | null;
  /** Every Clerk organization the user belongs to (active org first). */
  orgIds: string[];
  /** Organizations where the user holds the org:admin role. */
  adminOrgIds: string[];
  /** True when the user holds org:admin in any of their organizations. */
  isProjectAdmin: boolean;
  /** True for global admins (lib/admin.ts) who may access any project. */
  isGlobalAdmin: boolean;
}

export async function requireAppUser(): Promise<AppUser> {
  const { userId, orgId, has } = await auth();
  if (!userId) {
    throw new AuthError("Unauthorized", 401);
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress;

  if (!email) {
    throw new AuthError("No email address on account", 400);
  }

  // The app has no organization switcher, so sessions usually have no active
  // organization and auth().orgId is null. Roles must then come from the
  // user's memberships rather than the session claims.
  let orgIds: string[];
  let adminOrgIds: string[];
  if (orgId) {
    orgIds = [orgId];
    adminOrgIds = has({ role: "org:admin" }) ? [orgId] : [];
  } else {
    const clerk = await clerkClient();
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId,
      limit: 100,
    });
    orgIds = memberships.data.map((m) => m.organization.id);
    adminOrgIds = memberships.data
      .filter((m) => m.role === "org:admin")
      .map((m) => m.organization.id);
  }

  return {
    userId,
    email: email.toLowerCase(),
    orgId: orgId ?? null,
    orgIds,
    adminOrgIds,
    isProjectAdmin: adminOrgIds.length > 0,
    isGlobalAdmin: isAdminUser(userId),
  };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
