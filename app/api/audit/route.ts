import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { auditLogs } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser();
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    const col = await auditLogs();
    const logs = await col
      .find({ clerkUserId: user.userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({ logs });
  } catch (err) {
    return authErrorResponse(err);
  }
}
