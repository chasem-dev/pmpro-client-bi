import { auth, currentUser } from "@clerk/nextjs/server";

export interface AppUser {
  userId: string;
  email: string;
  orgId: string | null;
  /** True when the user holds org:admin in their active Clerk organization. */
  isProjectAdmin: boolean;
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

  return {
    userId,
    email: email.toLowerCase(),
    orgId: orgId ?? null,
    isProjectAdmin: orgId ? has({ role: "org:admin" }) : false,
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
