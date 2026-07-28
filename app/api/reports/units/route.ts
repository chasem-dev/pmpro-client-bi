import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/api-utils";
import { nonlaborEntries, timesheetEntries } from "@/lib/db";
import { getActivitiesByIds, getResourceAssignments } from "@/lib/p6";
import { groupEntriesByResource } from "@/lib/units-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser();
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const dateFilter: Record<string, string> = {};
    if (from) dateFilter.$gte = from;
    if (to) dateFilter.$lte = to;
    const filter: Record<string, unknown> = { clerkUserId: user.userId };
    if (from || to) filter.workDate = dateFilter;

    const [laborCol, nonlaborCol] = await Promise.all([
      timesheetEntries(),
      nonlaborEntries(),
    ]);
    const [laborDocs, nonlaborDocs] = await Promise.all([
      laborCol.find(filter).toArray(),
      nonlaborCol.find(filter).toArray(),
    ]);

    const activityIds = [
      ...new Set(
        [...laborDocs, ...nonlaborDocs].map((e) => e.activityObjectId),
      ),
    ];
    const [assignments, activities] = await Promise.all([
      getResourceAssignments(activityIds),
      getActivitiesByIds(activityIds),
    ]);

    const assignmentInfo = new Map(
      assignments.map((ra) => [
        ra.ObjectId,
        {
          resourceKey: String(ra.ResourceObjectId ?? `ra-${ra.ObjectId}`),
          resourceName: ra.ResourceName ?? `Resource ${ra.ResourceObjectId}`,
        },
      ]),
    );
    const activityInfo = new Map(
      activities.map((a) => [
        a.ObjectId,
        { activityId: a.Id, activityName: a.Name, projectName: a.ProjectName },
      ]),
    );

    return NextResponse.json({
      labor: groupEntriesByResource(
        laborDocs.map((e) => ({ ...e, amount: e.hours })),
        assignmentInfo,
        activityInfo,
      ),
      nonlabor: groupEntriesByResource(
        nonlaborDocs.map((e) => ({ ...e, amount: e.units })),
        assignmentInfo,
        activityInfo,
      ),
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
