import { auth, currentUser } from "@clerk/nextjs/server";

export interface AppUser {
  userId: string;
  email: string;
  orgId: string | null;
}

export async function requireAppUser(): Promise<AppUser> {
  const { userId, orgId } = await auth();
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
