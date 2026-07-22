import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { writeAudit } from "@/lib/audit";
import { nonlaborEntries } from "@/lib/db";
import { canEdit } from "@/lib/fields";
import { loadFieldPoliciesForUser } from "@/lib/policy";
import {
  tryMarkActivitiesForUpdateReview,
  updateResourceAssignment,
} from "@/lib/p6";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser();
    const url = new URL(request.url);
    const activityId = url.searchParams.get("activityId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const col = await nonlaborEntries();
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
    if (!canEdit(policies, "actualNonLaborUnits")) {
      return NextResponse.json(
        { error: "Actual non-labor units are not editable for this user." },
        { status: 403 },
      );
    }

    let body: {
      entries?: {
        activityObjectId: number;
        resourceAssignmentObjectId: number;
        workDate: string;
        units: number;
      }[];
      runningTotal?: {
        resourceAssignmentObjectId: number;
        units: number;
        activityObjectId?: number;
      };
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (body.runningTotal) {
      const { resourceAssignmentObjectId, units } = body.runningTotal;
      if (!resourceAssignmentObjectId || units == null) {
        return NextResponse.json(
          { error: "runningTotal needs resourceAssignmentObjectId and units." },
          { status: 400 },
        );
      }
      await updateResourceAssignment({
        ObjectId: resourceAssignmentObjectId,
        ActualUnits: units,
        AtCompletionUnits: units,
      });
      if (body.runningTotal.activityObjectId != null) {
        await tryMarkActivitiesForUpdateReview([
          Number(body.runningTotal.activityObjectId),
        ]);
      }
      await writeAudit(
        user,
        "update",
        "nonlaborTotal",
        String(resourceAssignmentObjectId),
        JSON.stringify({ units }),
      );
      return NextResponse.json({ ok: true, mode: "runningTotal" });
    }

    const entries = body.entries;
    if (!entries?.length) {
      return NextResponse.json(
        { error: "entries array or runningTotal is required." },
        { status: 400 },
      );
    }

    const col = await nonlaborEntries();
    const now = new Date();

    for (const entry of entries) {
      if (
        !entry.activityObjectId ||
        !entry.resourceAssignmentObjectId ||
        !entry.workDate ||
        entry.units == null
      ) {
        return NextResponse.json(
          { error: "Each entry needs activityObjectId, resourceAssignmentObjectId, workDate, units." },
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
            units: entry.units,
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
      const totalUnits = allForAssignment.reduce((s, e) => s + e.units, 0);
      await updateResourceAssignment({
        ObjectId: assignmentId,
        ActualUnits: totalUnits,
        AtCompletionUnits: totalUnits,
      });
    }

    await tryMarkActivitiesForUpdateReview(
      entries.map((e) => e.activityObjectId),
    );

    await writeAudit(
      user,
      "submit",
      "nonlabor",
      undefined,
      JSON.stringify({ count: entries.length }),
    );

    return NextResponse.json({ ok: true, synced: assignmentIds.length });
  } catch (err) {
    return authErrorResponse(err);
  }
}
