import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { MetabaseError } from "@/lib/metabase";
import { getProjectDashboard } from "@/lib/metabase-queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/projects/[objectId]/dashboard">,
) {
  const { objectId } = await ctx.params;

  if (!objectId || !/^\d+$/.test(objectId)) {
    return NextResponse.json(
      { error: "Invalid project ObjectId." },
      { status: 400 },
    );
  }

  try {
    await requireAppUser();
    const dashboard = await getProjectDashboard(Number(objectId));
    return NextResponse.json(dashboard);
  } catch (err) {
    if (err instanceof MetabaseError) {
      return NextResponse.json(
        { error: err.message, details: err.body },
        { status: 502 },
      );
    }
    return authErrorResponse(err);
  }
}
