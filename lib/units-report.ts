export interface UnitsReportActivity {
  activityObjectId: number;
  activityId?: string;
  activityName?: string;
  projectName?: string;
  units: number;
  /** Number of distinct days with an entry. */
  days: number;
}

export interface UnitsReportResource {
  resourceName: string;
  totalUnits: number;
  activities: UnitsReportActivity[];
}

export interface UnitsReportEntry {
  activityObjectId: number;
  resourceAssignmentObjectId: number;
  workDate: string;
  amount: number;
}

/**
 * Groups a user's daily entries by resource, then by activity within each
 * resource. Resource names come from the P6 resource assignments.
 */
export function groupEntriesByResource(
  entries: UnitsReportEntry[],
  assignmentInfo: Map<number, { resourceKey: string; resourceName: string }>,
  activityInfo: Map<
    number,
    { activityId?: string; activityName?: string; projectName?: string }
  >,
): UnitsReportResource[] {
  const resources = new Map<
    string,
    { resourceName: string; activities: Map<number, UnitsReportActivity> }
  >();
  for (const entry of entries) {
    const info = assignmentInfo.get(entry.resourceAssignmentObjectId) ?? {
      resourceKey: `assignment-${entry.resourceAssignmentObjectId}`,
      resourceName: `Assignment ${entry.resourceAssignmentObjectId}`,
    };
    let resource = resources.get(info.resourceKey);
    if (!resource) {
      resource = { resourceName: info.resourceName, activities: new Map() };
      resources.set(info.resourceKey, resource);
    }
    let act = resource.activities.get(entry.activityObjectId);
    if (!act) {
      const a = activityInfo.get(entry.activityObjectId);
      act = {
        activityObjectId: entry.activityObjectId,
        activityId: a?.activityId,
        activityName: a?.activityName,
        projectName: a?.projectName,
        units: 0,
        days: 0,
      };
      resource.activities.set(entry.activityObjectId, act);
    }
    act.units += entry.amount;
    act.days += 1;
  }
  return [...resources.values()]
    .map((r) => {
      const activities = [...r.activities.values()].sort(
        (a, b) => b.units - a.units,
      );
      return {
        resourceName: r.resourceName,
        totalUnits: activities.reduce((s, a) => s + a.units, 0),
        activities,
      };
    })
    .sort((a, b) => a.resourceName.localeCompare(b.resourceName));
}
