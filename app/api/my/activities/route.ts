import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { fetchMyActivities } from "@/lib/my-activities";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser();
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days");
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const days = daysParam ? Number(daysParam) : undefined;

    // Global admins may view any project's activities via ?project=<ObjectId>.
    const projectParam = url.searchParams.get("project");
    if (projectParam && !user.isGlobalAdmin) {
      return NextResponse.json(
        { error: "Only global admins can view a specific project." },
        { status: 403 },
      );
    }

    const result = await fetchMyActivities(user, {
      days: Number.isFinite(days) ? days : undefined,
      from,
      to,
      projectObjectId:
        projectParam && /^\d+$/.test(projectParam) ? projectParam : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return authErrorResponse(err);
  }
}
