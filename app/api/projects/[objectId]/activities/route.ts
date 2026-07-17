import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createActivity,
  getOwnerEmailsForActivities,
  getProjectActivities,
  P6Error,
} from "@/lib/p6";

export const dynamic = "force-dynamic";

function p6ErrorResponse(err: unknown) {
  if (err instanceof P6Error) {
    return NextResponse.json(
      { error: err.message, details: err.body },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

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
    const ownerEmails = await getOwnerEmailsForActivities(
      activities.map((a) => Number(a.ObjectId)),
    );
    const withOwners = activities.map((a) => ({
      ...a,
      OwnerEmail: ownerEmails.get(Number(a.ObjectId)),
    }));
    return NextResponse.json({ activities: withOwners });
  } catch (err) {
    return p6ErrorResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/projects/[objectId]/activities">,
) {
  const { objectId } = await ctx.params;

  if (!objectId || !/^\d+$/.test(objectId)) {
    return NextResponse.json({ error: "Invalid project ObjectId." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { Name, WBSObjectId, PlannedStartDate, PlannedFinishDate } = (body ??
    {}) as Record<string, unknown>;

  if (typeof Name !== "string" || !Name.trim()) {
    return NextResponse.json({ error: "Activity Name is required." }, { status: 400 });
  }
  const wbsId = Number(WBSObjectId);
  if (!Number.isInteger(wbsId)) {
    return NextResponse.json(
      { error: "A valid WBSObjectId is required to create an activity." },
      { status: 400 },
    );
  }

  try {
    const result = await createActivity({
      ProjectObjectId: Number(objectId),
      WBSObjectId: wbsId,
      Name: Name.trim(),
      ...(typeof PlannedStartDate === "string" && PlannedStartDate
        ? { PlannedStartDate }
        : {}),
      ...(typeof PlannedFinishDate === "string" && PlannedFinishDate
        ? { PlannedFinishDate }
        : {}),
    });
    return NextResponse.json({ result }, { status: 201 });
  } catch (err) {
    return p6ErrorResponse(err);
  }
}
