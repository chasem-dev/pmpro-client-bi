export type FieldPolicies = Record<
  string,
  { visible: boolean; editable: boolean }
>;

export type MyActivityResource = {
  objectId: number;
  resourceName?: string;
  resourceType?: string;
  plannedUnits?: number;
  actualUnits?: number;
  remainingUnits?: number;
  atCompletionUnits?: number;
  plannedCost?: number;
  actualCost?: number;
};

export type MyActivityRelationship = {
  objectId: number;
  activityObjectId: number;
  activityId?: string;
  activityName?: string;
  /** P6 status of the related activity, e.g. "Not Started". */
  status?: string;
  type?: string;
  lag?: number;
};

export type MyActivity = {
  objectId: number;
  id?: string;
  name: string;
  projectObjectId?: number;
  projectName?: string;
  percentComplete?: number;
  plannedStart?: string;
  plannedFinish?: string;
  totalFloat?: number;
  freeFloat?: number;
  actualStart?: string;
  actualFinish?: string;
  expectedFinish?: string;
  status?: string;
  ownerEmail?: string;
  isLate?: boolean;
  steps: {
    ObjectId: number;
    Name: string;
    IsCompleted?: boolean;
    PercentComplete?: number;
  }[];
  comments: {
    ObjectId?: number;
    CommentText: string;
    CreateDate?: string;
    CreateUser?: string;
  }[];
  laborResources: MyActivityResource[];
  nonLaborResources: MyActivityResource[];
  materialResources: MyActivityResource[];
  predecessors?: MyActivityRelationship[];
  successors?: MyActivityRelationship[];
};

export type AssignableMember = {
  name: string;
  email: string;
};

export type MyActivitiesResponse = {
  activities?: MyActivity[];
  policies?: FieldPolicies;
  canAssignOwner?: boolean;
  assignableMembers?: AssignableMember[];
  error?: string;
};

export function fmtDate(s?: string): string {
  if (!s) return "—";
  return s.slice(0, 10);
}

export function fmtNum(n?: number, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function toDateInput(s?: string): string {
  return s ? s.slice(0, 10) : "";
}

export function toP6Date(d: string): string | undefined {
  return d ? `${d}T00:00:00` : undefined;
}

export function policy(
  policies: FieldPolicies | undefined,
  key: string,
): { visible: boolean; editable: boolean } {
  return policies?.[key] ?? { visible: true, editable: false };
}

export async function apiCall<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(url, init);
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      return { ok: false, error: body?.error ?? `Request failed (${res.status})` };
    }
    return { ok: true, data: body };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** YYYY-MM-DD in the user's local timezone (toISOString would shift days). */
function localIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Dates for the daily entry grids: today plus the previous `lookBack` days,
 * oldest first. Users updating progress rarely enter future days but often
 * need to correct recent ones.
 */
export function trailingDates(anchor = new Date(), lookBack = 7): string[] {
  const dates: string[] = [];
  for (let i = lookBack; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    dates.push(localIsoDate(d));
  }
  return dates;
}
