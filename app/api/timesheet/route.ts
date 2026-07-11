import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { writeAudit } from "@/lib/audit";
import { timesheetEntries } from "@/lib/db";
import { canEdit } from "@/lib/fields";
import { loadFieldPoliciesForUser } from "@/lib/policy";
import { updateResourceAssignment } from "@/lib/p6";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser();
    const url = new URL(request.url);
    const activityId = url.searchParams.get("activityId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const col = await timesheetEntries();
    const filter: Record<string, unknown> = { clerkUserId: user.userId };
    if (activityId) filter.activityObjectId = Number(activityId);

    const entries = await col.find(filter).toArray();
    const filtered = entries.filter((e) => {
      if (!from && !to) return true;
      if (from && e.workDate < from) return false;
      if (to && e.workDate > to) return false;
      return true;
    });

    return NextResponse.json({ entries: filtered });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const policies = await loadFieldPoliciesForUser(user);
    if (!canEdit(policies, "actualLaborUnits")) {
      return NextResponse.json(
        { error: "Actual labor units are not editable for this user." },
        { status: 403 },
      );
    }

    let body: {
      entries?: {
        activityObjectId: number;
        resourceAssignmentObjectId: number;
        workDate: string;
        hours: number;
      }[];
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const entries = body.entries;
    if (!entries?.length) {
      return NextResponse.json({ error: "entries array is required." }, { status: 400 });
    }

    const col = await timesheetEntries();
    const now = new Date();

    for (const entry of entries) {
      if (
        !entry.activityObjectId ||
        !entry.resourceAssignmentObjectId ||
        !entry.workDate ||
        entry.hours == null
      ) {
        return NextResponse.json(
          { error: "Each entry needs activityObjectId, resourceAssignmentObjectId, workDate, hours." },
          { status: 400 },
        );
      }
      await col.updateOne(
        {
          clerkUserId: user.userId,
          resourceAssignmentObjectId: entry.resourceAssignmentObjectId,
          workDate: entry.workDate,
        },
        {
          $set: {
            activityObjectId: entry.activityObjectId,
            hours: entry.hours,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );
    }

    const assignmentIds = [
      ...new Set(entries.map((e) => e.resourceAssignmentObjectId)),
    ];
    for (const assignmentId of assignmentIds) {
      const allForAssignment = await col
        .find({
          clerkUserId: user.userId,
          resourceAssignmentObjectId: assignmentId,
        })
        .toArray();
      const totalHours = allForAssignment.reduce((s, e) => s + e.hours, 0);
      await updateResourceAssignment({
        ObjectId: assignmentId,
        ActualUnits: totalHours,
        AtCompletionUnits: totalHours,
      });
    }

    await writeAudit(
      user,
      "submit",
      "timesheet",
      undefined,
      JSON.stringify({ count: entries.length }),
    );

    return NextResponse.json({ ok: true, synced: assignmentIds.length });
  } catch (err) {
    return authErrorResponse(err);
  }
}
