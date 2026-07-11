import { auditLogs } from "@/lib/db";
import type { AppUser } from "@/lib/auth";

export async function writeAudit(
  user: AppUser,
  action: string,
  entityType: string,
  entityId?: string,
  details?: string,
): Promise<void> {
  const col = await auditLogs();
  await col.insertOne({
    clerkUserId: user.userId,
    clerkEmail: user.email,
    action,
    entityType,
    entityId,
    details,
    createdAt: new Date(),
  });
}
