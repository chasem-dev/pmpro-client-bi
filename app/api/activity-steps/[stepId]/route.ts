import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { writeAudit } from "@/lib/audit";
import { canEdit } from "@/lib/fields";
import { loadFieldPoliciesForUser } from "@/lib/policy";
import {
  tryMarkActivitiesForUpdateReview,
  updateActivityStep,
} from "@/lib/p6";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/activity-steps/[stepId]">,
) {
  try {
    const user = await requireAppUser();
    const policies = await loadFieldPoliciesForUser(user);
    if (!canEdit(policies, "activityStep")) {
      return NextResponse.json(
        { error: "Activity steps are not editable for this user." },
        { status: 403 },
      );
    }

    const { stepId } = await ctx.params;
    if (!stepId || !/^\d+$/.test(stepId)) {
      return NextResponse.json({ error: "Invalid step ObjectId." }, { status: 400 });
    }

    let body: { isCompleted?: boolean; activityObjectId?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (typeof body.isCompleted !== "boolean") {
      return NextResponse.json(
        { error: "isCompleted (boolean) is required." },
        { status: 400 },
      );
    }

    const result = await updateActivityStep({
      ObjectId: Number(stepId),
      IsCompleted: body.isCompleted,
    });

    if (body.activityObjectId != null) {
      await tryMarkActivitiesForUpdateReview([Number(body.activityObjectId)]);
    }

    await writeAudit(
      user,
      "update",
      "activityStep",
      stepId,
      JSON.stringify({ isCompleted: body.isCompleted }),
    );
    return NextResponse.json({ result });
  } catch (err) {
    return authErrorResponse(err);
  }
}
