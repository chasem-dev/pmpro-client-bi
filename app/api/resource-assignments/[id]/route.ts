import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { writeAudit } from "@/lib/audit";
import { canEdit } from "@/lib/fields";
import { loadFieldPoliciesForUser } from "@/lib/policy";
import { updateResourceAssignment } from "@/lib/p6";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/resource-assignments/[id]">,
) {
  try {
    const user = await requireAppUser();
    const policies = await loadFieldPoliciesForUser(user);
    const { id } = await ctx.params;
    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Invalid resource assignment ObjectId." },
        { status: 400 },
      );
    }

    let body: {
      actualUnits?: number;
      atCompletionUnits?: number;
      actualCost?: number;
      resourceType?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const type = (body.resourceType ?? "").toLowerCase();
    const update: {
      ObjectId: number;
      ActualUnits?: number;
      AtCompletionUnits?: number;
      ActualCost?: number;
    } = { ObjectId: Number(id) };

    if (body.actualUnits !== undefined) {
      const key =
        type === "nonlabor" ? "actualNonLaborUnits" : "actualLaborUnits";
      if (!canEdit(policies, key)) {
        return NextResponse.json(
          { error: `Field '${key}' is not editable.` },
          { status: 403 },
        );
      }
      update.ActualUnits = body.actualUnits;
    }

    if (body.atCompletionUnits !== undefined) {
      const key =
        type === "nonlabor"
          ? "atCompleteNonLaborUnits"
          : "atCompleteLaborUnits";
      if (!canEdit(policies, key)) {
        return NextResponse.json(
          { error: `Field '${key}' is not editable.` },
          { status: 403 },
        );
      }
      update.AtCompletionUnits = body.atCompletionUnits;
    }

    if (body.actualCost !== undefined) {
      if (!canEdit(policies, "actualMaterialCost")) {
        return NextResponse.json(
          { error: "Actual material cost is not editable." },
          { status: 403 },
        );
      }
      update.ActualCost = body.actualCost;
    }

    if (
      update.ActualUnits === undefined &&
      update.AtCompletionUnits === undefined &&
      update.ActualCost === undefined
    ) {
      return NextResponse.json(
        { error: "No updatable fields provided." },
        { status: 400 },
      );
    }

    const result = await updateResourceAssignment(update);
    await writeAudit(user, "update", "resourceAssignment", id, JSON.stringify(update));
    return NextResponse.json({ result });
  } catch (err) {
    return authErrorResponse(err);
  }
}
