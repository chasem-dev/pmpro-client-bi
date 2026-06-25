import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  deleteActivity,
  P6Error,
  updateActivity,
  type UpdateActivityInput,
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

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/activities/[activityId]">,
) {
  const { activityId } = await ctx.params;
  if (!activityId || !/^\d+$/.test(activityId)) {
    return NextResponse.json({ error: "Invalid activity ObjectId." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    Name,
    ActivityOwnerUserId,
    PlannedLaborUnits,
    PlannedLaborCost,
    PlannedStartDate,
    PlannedFinishDate,
  } = (body ?? {}) as Record<string, unknown>;

  const update: UpdateActivityInput = { ObjectId: Number(activityId) };
  if (typeof Name === "string" && Name.trim()) update.Name = Name.trim();
  const ownerId = optionalNumber(ActivityOwnerUserId);
  if (ownerId !== undefined) update.ActivityOwnerUserId = ownerId;
  const laborUnits = optionalNumber(PlannedLaborUnits);
  if (laborUnits !== undefined) update.PlannedLaborUnits = laborUnits;
  const laborCost = optionalNumber(PlannedLaborCost);
  if (laborCost !== undefined) update.PlannedLaborCost = laborCost;
  if (typeof PlannedStartDate === "string" && PlannedStartDate)
    update.PlannedStartDate = PlannedStartDate;
  if (typeof PlannedFinishDate === "string" && PlannedFinishDate)
    update.PlannedFinishDate = PlannedFinishDate;

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No updatable fields provided." }, { status: 400 });
  }

  try {
    const result = await updateActivity(update);
    return NextResponse.json({ result });
  } catch (err) {
    return p6ErrorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/activities/[activityId]">,
) {
  const { activityId } = await ctx.params;
  if (!activityId || !/^\d+$/.test(activityId)) {
    return NextResponse.json({ error: "Invalid activity ObjectId." }, { status: 400 });
  }

  try {
    const result = await deleteActivity(Number(activityId));
    return NextResponse.json({ result });
  } catch (err) {
    return p6ErrorResponse(err);
  }
}
