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
  atCompletionUnits?: number;
  plannedCost?: number;
  actualCost?: number;
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
  steps: {
    ObjectId: number;
    Name: string;
    IsCompleted?: boolean;
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
};

export type MyActivitiesResponse = {
  activities?: MyActivity[];
  policies?: FieldPolicies;
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

export function weekDates(anchor = new Date()): string[] {
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
