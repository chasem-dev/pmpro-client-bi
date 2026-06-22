import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getProjectActivities, P6Error } from "@/lib/p6";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/projects/[objectId]/activities">,
) {
  const { objectId } = await ctx.params;

  if (!objectId || !/^\d+$/.test(objectId)) {
    return NextResponse.json(
      { error: "Invalid project ObjectId." },
      { status: 400 },
    );
  }

  try {
    const activities = await getProjectActivities(objectId);
    return NextResponse.json({ activities });
  } catch (err) {
    if (err instanceof P6Error) {
      return NextResponse.json(
        { error: err.message, details: err.body },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
