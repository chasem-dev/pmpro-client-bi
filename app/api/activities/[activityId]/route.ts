import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { writeAudit } from "@/lib/audit";
import { canEdit, type FieldKey } from "@/lib/fields";
import { loadFieldPoliciesForUser } from "@/lib/policy";
import {
  deleteActivity,
  getActivitiesByIds,
  P6Error,
  setActivityOwnerEmail,
  tryMarkActivitiesForUpdateReview,
  updateActivity,
  type UpdateActivityInput,
} from "@/lib/p6";
import { getLinkForProject } from "@/lib/project-org-links";

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

const FIELD_MAP: Record<string, FieldKey> = {
  PercentComplete: "percentComplete",
  ActualStartDate: "actualStart",
  ActualFinishDate: "actualFinish",
  ExpectedFinishDate: "expectedFinish",
  Name: "activityName",
  PlannedLaborUnits: "budgetedLaborUnits",
  PlannedLaborCost: "budgetedMaterialCost",
  PlannedStartDate: "plannedStart",
  PlannedFinishDate: "plannedFinish",
};

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/activities/[activityId]">,
) {
  try {
    const user = await requireAppUser();
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

    const raw = (body ?? {}) as Record<string, unknown>;

    // Global admins, and org:admins of the organization this activity's
    // project is linked to, administer the schedule: they bypass client
    // field policies and may reassign the activity owner.
    let isActivityAdmin = user.isGlobalAdmin;
    if (!isActivityAdmin && user.isProjectAdmin) {
      const [activity] = await getActivitiesByIds([Number(activityId)]);
      if (activity?.ProjectObjectId) {
        const link = await getLinkForProject(String(activity.ProjectObjectId));
        isActivityAdmin = !!link && user.adminOrgIds.includes(link.clerkOrgId);
      }
    }

    if (!isActivityAdmin) {
      const policies = await loadFieldPoliciesForUser(user);
      for (const [apiField, policyKey] of Object.entries(FIELD_MAP)) {
        if (raw[apiField] !== undefined && !canEdit(policies, policyKey)) {
          return NextResponse.json(
            { error: `Field '${policyKey}' is not editable for this user.` },
            { status: 403 },
          );
        }
      }
    }

    const hasOwnerEmail = "OwnerEmail" in raw;
    if (hasOwnerEmail) {
      if (raw.OwnerEmail !== null && typeof raw.OwnerEmail !== "string") {
        return NextResponse.json(
          { error: "OwnerEmail must be a string or null." },
          { status: 400 },
        );
      }
      if (!isActivityAdmin) {
        return NextResponse.json(
          { error: "You are not allowed to assign this activity's owner." },
          { status: 403 },
        );
      }
    }

    const update: UpdateActivityInput = { ObjectId: Number(activityId) };
    if (typeof raw.Name === "string" && raw.Name.trim()) update.Name = raw.Name.trim();
    const ownerId = optionalNumber(raw.ActivityOwnerUserId);
    if (ownerId !== undefined) update.ActivityOwnerUserId = ownerId;
    const pct = optionalNumber(raw.PercentComplete);
    if (pct !== undefined) update.PercentComplete = pct;
    const laborUnits = optionalNumber(raw.PlannedLaborUnits);
    if (laborUnits !== undefined) update.PlannedLaborUnits = laborUnits;
    const laborCost = optionalNumber(raw.PlannedLaborCost);
    if (laborCost !== undefined) update.PlannedLaborCost = laborCost;
    if (typeof raw.PlannedStartDate === "string" && raw.PlannedStartDate)
      update.PlannedStartDate = raw.PlannedStartDate;
    if (typeof raw.PlannedFinishDate === "string" && raw.PlannedFinishDate)
      update.PlannedFinishDate = raw.PlannedFinishDate;
    if (typeof raw.ActualStartDate === "string" && raw.ActualStartDate)
      update.ActualStartDate = raw.ActualStartDate;
    if (typeof raw.ActualFinishDate === "string" && raw.ActualFinishDate)
      update.ActualFinishDate = raw.ActualFinishDate;
    if (typeof raw.ExpectedFinishDate === "string" && raw.ExpectedFinishDate)
      update.ExpectedFinishDate = raw.ExpectedFinishDate;

    const hasFieldUpdates = Object.keys(update).length > 1;
    if (!hasFieldUpdates && !hasOwnerEmail) {
      return NextResponse.json({ error: "No updatable fields provided." }, { status: 400 });
    }

    let result: unknown = null;
    if (hasFieldUpdates) {
      result = await updateActivity(update);
      // Flag the activity for scheduler review; the update itself already
      // succeeded, so a failure here must not fail the request.
      await tryMarkActivitiesForUpdateReview([Number(activityId)]);
    }
    if (hasOwnerEmail) {
      await setActivityOwnerEmail(
        Number(activityId),
        (raw.OwnerEmail as string | null) ?? null,
      );
    }

    await writeAudit(
      user,
      "update",
      "activity",
      activityId,
      JSON.stringify({
        ...update,
        ...(hasOwnerEmail ? { OwnerEmail: raw.OwnerEmail } : {}),
      }),
    );
    return NextResponse.json({ result });
  } catch (err) {
    return authErrorResponse(err);
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
