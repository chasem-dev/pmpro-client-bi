"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import type {
  AssignableMember,
  MyActivity,
  MyActivityRelationship,
  FieldPolicies,
} from "./types";
import {
  apiCall,
  fmtDate,
  fmtNum,
  jsonInit,
  policy,
  toDateInput,
  toP6Date,
  trailingDates,
} from "./types";

export const activityAnchorId = (objectId: number) => `activity-${objectId}`;

function OwnerField({
  ownerEmail,
  editable,
  members,
  onSave,
}: {
  ownerEmail?: string;
  editable: boolean;
  members: AssignableMember[];
  onSave: (email: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ownerEmail ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <span className="text-xs text-muted-foreground">Owner</span>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          {members.length > 0 ? (
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="max-w-52 rounded border border-brand-border px-2 py-1 text-sm"
            >
              <option value="">Unassigned</option>
              {/* Keep the current owner selectable even when they are not a
                  member of the linked organization. */}
              {draft && !members.some((m) => m.email === draft) && (
                <option value={draft}>{draft}</option>
              )}
              {members.map((m) => (
                <option key={m.email} value={m.email}>
                  {m.name ? `${m.name} (${m.email})` : m.email}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="email"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="owner@example.com"
              className="w-52 rounded border border-brand-border px-2 py-1 text-sm"
            />
          )}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(draft.trim());
              setBusy(false);
              setEditing(false);
            }}
            className="text-xs text-secondary"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(ownerEmail ?? "");
              setEditing(false);
            }}
            className="text-xs text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className="truncate text-sm">
          {ownerEmail ?? "—"}
          {editable && (
            <button
              type="button"
              onClick={() => {
                setDraft(ownerEmail ?? "");
                setEditing(true);
              }}
              className="ml-1 text-xs text-secondary"
            >
              Change
            </button>
          )}
        </p>
      )}
    </div>
  );
}

/** Client-facing status label/color for a related activity's P6 status. */
function relationshipStatus(status?: string): {
  label: string;
  className: string;
} | null {
  switch (status) {
    case "Not Started":
      return { label: "Not Started", className: "bg-gray-100 text-gray-600" };
    case "In Progress":
      return { label: "In-Progress", className: "bg-blue-100 text-blue-700" };
    case "Completed":
      return { label: "Finished", className: "bg-emerald-100 text-emerald-700" };
    default:
      return status ? { label: status, className: "bg-gray-100 text-gray-600" } : null;
  }
}

function RelationshipList({
  title,
  relationships,
  linkableIds,
}: {
  title: string;
  relationships: MyActivityRelationship[];
  linkableIds?: Set<number>;
}) {
  if (relationships.length === 0) return null;
  return (
    <div>
      <h5 className="text-xs font-semibold text-muted-foreground">{title}</h5>
      <ul className="mt-1 space-y-1">
        {relationships.map((rel) => {
          const label = rel.activityName ?? rel.activityId ?? rel.activityObjectId;
          const status = relationshipStatus(rel.status);
          const meta = [rel.type, rel.lag ? `lag ${fmtNum(rel.lag)}` : null]
            .filter(Boolean)
            .join(", ");
          const linkable = linkableIds?.has(rel.activityObjectId);
          return (
            <li key={rel.objectId} className="text-sm">
              {linkable ? (
                <a
                  href={`#${activityAnchorId(rel.activityObjectId)}`}
                  className="font-medium text-secondary hover:underline"
                >
                  {label}
                </a>
              ) : (
                <span>{label}</span>
              )}
              {status && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
              )}
              {meta && (
                <span className="ml-1 text-xs text-muted-foreground/70">
                  ({meta})
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EditableDate({
  label,
  value,
  editable,
  onSave,
}: {
  label: string;
  value?: string;
  editable: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toDateInput(value));
  const [busy, setBusy] = useState(false);

  if (!editable) {
    return (
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm">{fmtDate(value)}</dd>
      </div>
    );
  }

  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      {editing ? (
        <dd className="flex items-center gap-2">
          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="rounded border border-brand-border px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(draft);
              setBusy(false);
              setEditing(false);
            }}
            className="text-xs text-secondary"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-muted-foreground"
          >
            Cancel
          </button>
        </dd>
      ) : (
        <dd className="text-sm">
          {fmtDate(value)}{" "}
          <button
            type="button"
            onClick={() => {
              setDraft(toDateInput(value));
              setEditing(true);
            }}
            className="ml-1 text-xs text-secondary"
          >
            Edit
          </button>
        </dd>
      )}
    </div>
  );
}

/**
 * Loads previously saved daily entries for this activity so the week grid
 * shows the existing breakdown instead of starting blank after a refresh.
 * Returns the values map keyed `${assignmentId}-${date}` plus dirty tracking
 * so only edited days are re-submitted.
 */
function useDailyEntries(
  endpoint: "/api/timesheet" | "/api/nonlabor",
  activityObjectId: number,
  dates: string[],
  amountField: "hours" | "units",
) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const from = dates[0];
  const to = dates[dates.length - 1];

  useEffect(() => {
    let cancelled = false;
    apiCall<{ entries?: Record<string, unknown>[] }>(
      `${endpoint}?activityId=${activityObjectId}&from=${from}&to=${to}`,
    ).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        const next: Record<string, number> = {};
        for (const e of res.data?.entries ?? []) {
          const amount = Number(e[amountField]);
          if (Number.isFinite(amount)) {
            next[`${e.resourceAssignmentObjectId}-${e.workDate}`] = amount;
          }
        }
        setValues(next);
        setDirty(new Set());
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [endpoint, activityObjectId, from, to, amountField]);

  function setValue(key: string, amount: number) {
    setValues((v) => ({ ...v, [key]: amount }));
    setDirty((d) => new Set(d).add(key));
  }

  function clearDirty() {
    setDirty(new Set());
  }

  return { values, dirty, loading, setValue, clearDirty };
}

function TimesheetGrid({
  activity,
  policies,
  onSaved,
}: {
  activity: MyActivity;
  policies?: FieldPolicies;
  onSaved: () => void;
}) {
  const dates = trailingDates();
  const { values, dirty, loading, setValue, clearDirty } = useDailyEntries(
    "/api/timesheet",
    activity.objectId,
    dates,
    "hours",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!policy(policies, "actualLaborUnits").editable) return null;
  if (activity.laborResources.length === 0) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    // Only the days edited this session; sending 0 clears a saved day.
    const entries = activity.laborResources.flatMap((r) =>
      dates
        .filter((d) => dirty.has(`${r.objectId}-${d}`))
        .map((d) => ({
          activityObjectId: activity.objectId,
          resourceAssignmentObjectId: r.objectId,
          workDate: d,
          hours: values[`${r.objectId}-${d}`] ?? 0,
        })),
    );
    if (entries.length === 0) {
      setBusy(false);
      return;
    }
    const res = await apiCall("/api/timesheet", jsonInit("POST", { entries }));
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Failed to save timesheet");
    else {
      clearDirty();
      onSaved();
    }
  }

  return (
    <div className="mt-3 rounded border border-brand-border p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        Labor timesheet (hours)
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-2">Resource</th>
              {dates.map((d) => (
                <th key={d} className="px-1 py-1">
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activity.laborResources.map((r) => (
              <tr key={r.objectId}>
                <td className="py-1 pr-2">{r.resourceName ?? r.objectId}</td>
                {dates.map((d) => {
                  const key = `${r.objectId}-${d}`;
                  return (
                    <td key={key} className="px-1 py-1">
                      <input
                        type="number"
                        min={0}
                        step={0.25}
                        disabled={loading}
                        className="w-14 rounded border border-brand-border px-1 disabled:opacity-50"
                        value={values[key] ?? ""}
                        onChange={(e) =>
                          setValue(key, Number(e.target.value) || 0)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button
        type="button"
        disabled={busy || loading || dirty.size === 0}
        onClick={() => void submit()}
        className="mt-2 rounded bg-primary px-3 py-1 text-xs text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save timesheet"}
      </button>
    </div>
  );
}

function NonlaborSection({
  activity,
  policies,
  onSaved,
}: {
  activity: MyActivity;
  policies?: FieldPolicies;
  onSaved: () => void;
}) {
  const dates = trailingDates();
  const { values, dirty, loading, setValue, clearDirty } = useDailyEntries(
    "/api/nonlabor",
    activity.objectId,
    dates,
    "units",
  );
  const [totals, setTotals] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDaily = policy(policies, "actualNonLaborUnits").editable;
  const canAtComplete = policy(policies, "atCompleteNonLaborUnits").editable;
  if (!canDaily && !canAtComplete) return null;
  if (activity.nonLaborResources.length === 0) return null;

  async function submitDaily() {
    setBusy(true);
    setError(null);
    // Only the days edited this session; sending 0 clears a saved day.
    const entries = activity.nonLaborResources.flatMap((r) =>
      dates
        .filter((d) => dirty.has(`${r.objectId}-${d}`))
        .map((d) => ({
          activityObjectId: activity.objectId,
          resourceAssignmentObjectId: r.objectId,
          workDate: d,
          units: values[`${r.objectId}-${d}`] ?? 0,
        })),
    );
    if (entries.length === 0) {
      setBusy(false);
      return;
    }
    const res = await apiCall("/api/nonlabor", jsonInit("POST", { entries }));
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Failed to save");
    else {
      clearDirty();
      onSaved();
    }
  }

  async function submitTotal(resourceId: number) {
    const units = Number(totals[resourceId]);
    if (!Number.isFinite(units)) return;
    setBusy(true);
    setError(null);
    const res = await apiCall(
      "/api/nonlabor",
      jsonInit("POST", {
        runningTotal: {
          resourceAssignmentObjectId: resourceId,
          units,
          activityObjectId: activity.objectId,
        },
      }),
    );
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Failed to save");
    else onSaved();
  }

  return (
    <div className="mt-3 rounded border border-brand-border p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        Non-labor tracking
      </h4>
      {canDaily && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Resource</th>
                  {dates.map((d) => (
                    <th key={d} className="px-1 py-1">
                      {d.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.nonLaborResources.map((r) => (
                  <tr key={r.objectId}>
                    <td className="py-1 pr-2">{r.resourceName ?? r.objectId}</td>
                    {dates.map((d) => {
                      const key = `${r.objectId}-${d}`;
                      return (
                        <td key={key} className="px-1 py-1">
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            disabled={loading}
                            className="w-14 rounded border border-brand-border px-1 disabled:opacity-50"
                            value={values[key] ?? ""}
                            onChange={(e) =>
                              setValue(key, Number(e.target.value) || 0)
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={busy || loading || dirty.size === 0}
            onClick={() => void submitDaily()}
            className="mt-2 rounded bg-primary px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            Save daily non-labor
          </button>
        </>
      )}
      {canAtComplete && (
        <ul className="mt-3 space-y-2">
          {activity.nonLaborResources.map((r) => (
            <li key={r.objectId} className="flex items-center gap-2 text-xs">
              <span>{r.resourceName ?? r.objectId}</span>
              <input
                type="number"
                step={0.1}
                placeholder="Running total"
                className="w-24 rounded border border-brand-border px-2 py-1"
                value={totals[r.objectId] ?? ""}
                onChange={(e) =>
                  setTotals((t) => ({ ...t, [r.objectId]: e.target.value }))
                }
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitTotal(r.objectId)}
                className="text-secondary"
              >
                Set total
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Numeric input that saves on blur. Unlike a bare defaultValue input it
 * re-syncs when the server value changes (e.g. a timesheet submission also
 * updates At Complete in P6), and it only saves when the value was edited.
 */
function UnitsInput({
  value,
  onSave,
}: {
  value?: number;
  onSave: (n: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Adopt refreshed server data unless the user is mid-edit (focused).
  const lastValue = useRef(value);
  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      if (document.activeElement !== inputRef.current) {
        setDraft(value != null ? String(value) : "");
      }
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="number"
      step={0.1}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft);
        if (draft !== "" && Number.isFinite(n) && n !== value) {
          void onSave(n);
        }
      }}
      className="w-20 rounded border border-brand-border px-1"
    />
  );
}

/** Local card updates for P6 activity fields we just saved successfully. */
function patchFromActivityFields(
  fields: Record<string, unknown>,
): Partial<MyActivity> {
  const patch: Partial<MyActivity> = {};
  if (typeof fields.ActualStartDate === "string")
    patch.actualStart = fields.ActualStartDate;
  if (typeof fields.ActualFinishDate === "string")
    patch.actualFinish = fields.ActualFinishDate;
  if (typeof fields.ExpectedFinishDate === "string")
    patch.expectedFinish = fields.ExpectedFinishDate;
  if ("OwnerEmail" in fields)
    patch.ownerEmail = (fields.OwnerEmail as string | null) ?? undefined;
  return patch;
}

export function ActivityCard({
  activity,
  policies,
  onRefresh,
  onPatch,
  linkableIds,
  canAssignOwner = false,
  assignableMembers = [],
}: {
  activity: MyActivity;
  policies?: FieldPolicies;
  /** Background reconcile with P6 (should not blank the page). */
  onRefresh: () => void;
  /** Applies a local update to this card only, for instant feedback. */
  onPatch?: (patch: Partial<MyActivity>) => void;
  /** ObjectIds of activities rendered on this page (relationship links). */
  linkableIds?: Set<number>;
  /** Whether the current user may reassign the activity owner. */
  canAssignOwner?: boolean;
  assignableMembers?: AssignableMember[];
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const { user } = useUser();
  const myEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isMine =
    !!activity.ownerEmail &&
    !!myEmail &&
    activity.ownerEmail.toLowerCase() === myEmail;

  // Relationship links use #activity-<id> anchors; when this card is the
  // target, expand it and scroll it into view.
  useEffect(() => {
    const anchor = activityAnchorId(activity.objectId);
    function onHashChange() {
      if (window.location.hash === `#${anchor}`) {
        setOpen(true);
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [activity.objectId]);

  async function updateActivity(fields: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await apiCall(
      `/api/activities/${activity.objectId}`,
      jsonInit("PUT", fields),
    );
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Update failed");
    else {
      onPatch?.(patchFromActivityFields(fields));
      onRefresh();
    }
  }

  async function addComment() {
    if (!comment.trim()) return;
    setBusy(true);
    const res = await apiCall(
      `/api/activities/${activity.objectId}/comments`,
      jsonInit("POST", { commentText: comment.trim() }),
    );
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Comment failed");
    else {
      setComment("");
      onRefresh();
    }
  }

  async function toggleStep(stepId: number, completed: boolean) {
    setBusy(true);
    const res = await apiCall(
      `/api/activity-steps/${stepId}`,
      jsonInit("PUT", {
        isCompleted: completed,
        activityObjectId: activity.objectId,
      }),
    );
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Step update failed");
    else {
      onPatch?.({
        steps: activity.steps.map((s) =>
          s.ObjectId === stepId ? { ...s, IsCompleted: completed } : s,
        ),
      });
      onRefresh();
    }
  }

  async function updateAssignment(
    id: number,
    fields: {
      remainingUnits?: number;
      atCompletionUnits?: number;
      actualCost?: number;
    },
    resourceType: "labor" | "nonlabor" | "material",
  ) {
    setBusy(true);
    const res = await apiCall(
      `/api/resource-assignments/${id}`,
      jsonInit("PUT", {
        ...fields,
        resourceType,
        activityObjectId: activity.objectId,
      }),
    );
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Assignment update failed");
    else {
      const listKey =
        resourceType === "labor"
          ? "laborResources"
          : resourceType === "nonlabor"
            ? "nonLaborResources"
            : "materialResources";
      onPatch?.({
        [listKey]: activity[listKey].map((r) =>
          r.objectId === id ? { ...r, ...fields } : r,
        ),
      });
      onRefresh();
    }
  }

  const show = (key: string) => policy(policies, key).visible;
  const edit = (key: string) => policy(policies, key).editable;

  return (
    <article
      ref={ref}
      id={activityAnchorId(activity.objectId)}
      className={`scroll-mt-24 rounded-lg border bg-card ${
        activity.isLate ? "border-red-300" : "border-brand-border"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
          activity.isLate ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-muted/50"
        }`}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="truncate">
              {show("activityName")
                ? activity.name
                : (activity.id ?? activity.objectId)}
            </span>
            {activity.isLate && (
              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                Late
              </span>
            )}
          </p>
          {(activity.ownerEmail ||
            (show("activityId") && show("activityName") && activity.id)) && (
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              {show("activityId") && show("activityName") && activity.id && (
                <span className="shrink-0">{activity.id}</span>
              )}
              {activity.ownerEmail && (
                <span className="flex min-w-0 items-center gap-1">
                  <span aria-hidden>👤</span>
                  <span className="truncate">{activity.ownerEmail}</span>
                  {isMine && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      ⭐ You
                    </span>
                  )}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {show("plannedStart") && (
            <div className="text-right">
              <span className="block text-xs text-muted-foreground">
                Planned Start
              </span>
              <span className="text-sm">{fmtDate(activity.plannedStart)}</span>
            </div>
          )}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-brand-border/60 p-4">
      <header className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {show("plannedStart") && (
          <div>
            <span className="text-xs text-muted-foreground">Planned Start</span>
            <p className="text-sm">{fmtDate(activity.plannedStart)}</p>
          </div>
        )}
        {show("plannedFinish") && (
          <div>
            <span className="text-xs text-muted-foreground">Planned Finish</span>
            <p className="text-sm">{fmtDate(activity.plannedFinish)}</p>
          </div>
        )}
        {show("freeFloat") && (
          <div>
            <span className="text-xs text-muted-foreground">Free Float</span>
            <p className="text-sm">{fmtNum(activity.freeFloat)}</p>
          </div>
        )}
        {show("totalFloat") && (
          <div>
            <span className="text-xs text-muted-foreground">Total Float</span>
            <p className="text-sm">{fmtNum(activity.totalFloat)}</p>
          </div>
        )}
        <OwnerField
          ownerEmail={activity.ownerEmail}
          editable={canAssignOwner}
          members={assignableMembers}
          onSave={(email) => updateActivity({ OwnerEmail: email || null })}
        />
      </header>

      <dl className="mt-3 grid gap-3 border-t border-brand-border/60 pt-3 sm:grid-cols-3">
        {show("actualStart") && (
          <EditableDate
            label="Actual Start"
            value={activity.actualStart}
            editable={edit("actualStart")}
            onSave={(v) => updateActivity({ ActualStartDate: toP6Date(v) })}
          />
        )}
        {show("actualFinish") && (
          <EditableDate
            label="Actual Finish"
            value={activity.actualFinish}
            editable={edit("actualFinish")}
            onSave={(v) => updateActivity({ ActualFinishDate: toP6Date(v) })}
          />
        )}
        {show("expectedFinish") && (
          <EditableDate
            label="Expected Finish"
            value={activity.expectedFinish}
            editable={edit("expectedFinish")}
            onSave={(v) => updateActivity({ ExpectedFinishDate: toP6Date(v) })}
          />
        )}
      </dl>

      {show("activityStep") && activity.steps.length > 0 && (
        <section className="mt-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Activity Steps
          </h4>
          <ul className="mt-1 space-y-1">
            {activity.steps.map((step) => {
              const completed = step.IsCompleted === true;
              return (
                <li
                  key={step.ObjectId}
                  className="flex items-center gap-2 text-sm"
                >
                  {edit("activityStep") ? (
                    <input
                      type="checkbox"
                      checked={completed}
                      disabled={busy}
                      onChange={(e) =>
                        void toggleStep(step.ObjectId, e.target.checked)
                      }
                    />
                  ) : (
                    <span>{completed ? "✓" : "○"}</span>
                  )}
                  <span
                    className={
                      completed ? "text-muted-foreground/70 line-through" : ""
                    }
                  >
                    {step.Name}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {((activity.predecessors?.length ?? 0) > 0 ||
        (activity.successors?.length ?? 0) > 0) && (
        <section className="mt-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Relationships
          </h4>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            <RelationshipList
              title="Predecessors (hand-offs in)"
              relationships={activity.predecessors ?? []}
              linkableIds={linkableIds}
            />
            <RelationshipList
              title="Successors (hand-offs out)"
              relationships={activity.successors ?? []}
              linkableIds={linkableIds}
            />
          </div>
        </section>
      )}

      {(show("resourceName") || show("budgetedLaborUnits")) &&
        activity.laborResources.length > 0 && (
          <section className="mt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Labor Resources
            </h4>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    {show("resourceName") && <th className="py-1">Resource</th>}
                    {show("budgetedLaborUnits") && <th>Budgeted</th>}
                    {show("actualLaborUnits") && <th>Actual</th>}
                    {show("remainingLaborUnits") && <th>Remaining</th>}
                    {show("atCompleteLaborUnits") && <th>At Complete</th>}
                  </tr>
                </thead>
                <tbody>
                  {activity.laborResources.map((r) => (
                    <tr key={r.objectId}>
                      {show("resourceName") && (
                        <td className="py-1">{r.resourceName ?? r.objectId}</td>
                      )}
                      {show("budgetedLaborUnits") && (
                        <td>{fmtNum(r.plannedUnits)}</td>
                      )}
                      {show("actualLaborUnits") && (
                        <td>{fmtNum(r.actualUnits)}</td>
                      )}
                      {show("remainingLaborUnits") && (
                        <td>
                          {edit("remainingLaborUnits") ? (
                            <UnitsInput
                              value={r.remainingUnits}
                              onSave={(n) =>
                                updateAssignment(
                                  r.objectId,
                                  { remainingUnits: n },
                                  "labor",
                                )
                              }
                            />
                          ) : (
                            fmtNum(r.remainingUnits)
                          )}
                        </td>
                      )}
                      {show("atCompleteLaborUnits") && (
                        <td>
                          {edit("atCompleteLaborUnits") ? (
                            <UnitsInput
                              value={r.atCompletionUnits}
                              onSave={(n) =>
                                updateAssignment(
                                  r.objectId,
                                  { atCompletionUnits: n },
                                  "labor",
                                )
                              }
                            />
                          ) : (
                            fmtNum(r.atCompletionUnits)
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {(show("resourceName") || show("budgetedNonLaborUnits")) &&
        activity.nonLaborResources.length > 0 && (
          <section className="mt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Non-Labor Resources
            </h4>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    {show("resourceName") && <th className="py-1">Resource</th>}
                    {show("budgetedNonLaborUnits") && <th>Budgeted</th>}
                    {show("actualNonLaborUnits") && <th>Actual</th>}
                    {show("remainingNonLaborUnits") && <th>Remaining</th>}
                    {show("atCompleteNonLaborUnits") && <th>At Complete</th>}
                  </tr>
                </thead>
                <tbody>
                  {activity.nonLaborResources.map((r) => (
                    <tr key={r.objectId}>
                      {show("resourceName") && (
                        <td className="py-1">{r.resourceName ?? r.objectId}</td>
                      )}
                      {show("budgetedNonLaborUnits") && (
                        <td>{fmtNum(r.plannedUnits)}</td>
                      )}
                      {show("actualNonLaborUnits") && (
                        <td>{fmtNum(r.actualUnits)}</td>
                      )}
                      {show("remainingNonLaborUnits") && (
                        <td>
                          {edit("remainingNonLaborUnits") ? (
                            <UnitsInput
                              value={r.remainingUnits}
                              onSave={(n) =>
                                updateAssignment(
                                  r.objectId,
                                  { remainingUnits: n },
                                  "nonlabor",
                                )
                              }
                            />
                          ) : (
                            fmtNum(r.remainingUnits)
                          )}
                        </td>
                      )}
                      {show("atCompleteNonLaborUnits") && (
                        <td>
                          {edit("atCompleteNonLaborUnits") ? (
                            <UnitsInput
                              value={r.atCompletionUnits}
                              onSave={(n) =>
                                updateAssignment(
                                  r.objectId,
                                  { atCompletionUnits: n },
                                  "nonlabor",
                                )
                              }
                            />
                          ) : (
                            fmtNum(r.atCompletionUnits)
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {show("materialName") && activity.materialResources.length > 0 && (
        <section className="mt-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Materials
          </h4>
          <ul className="mt-1 space-y-1 text-sm">
            {activity.materialResources.map((r) => (
              <li key={r.objectId}>{r.resourceName ?? r.objectId}</li>
            ))}
          </ul>
        </section>
      )}

      <TimesheetGrid
        activity={activity}
        policies={policies}
        onSaved={onRefresh}
      />
      <NonlaborSection
        activity={activity}
        policies={policies}
        onSaved={onRefresh}
      />

      {show("activityComment") && (
        <section className="mt-3 border-t border-brand-border/60 pt-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Comments
          </h4>
          {activity.comments.length > 0 && (
            <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
              {activity.comments.map((c, i) => (
                <li key={c.ObjectId ?? i}>
                  <span className="text-xs text-muted-foreground/70">
                    {c.CreateUser ?? "User"} · {fmtDate(c.CreateDate)}
                  </span>
                  <p>{c.CommentText}</p>
                </li>
              ))}
            </ul>
          )}
          {edit("activityComment") && (
            <div className="mt-2 flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded border border-brand-border px-2 py-1 text-sm"
              />
              <button
                type="button"
                disabled={busy || !comment.trim()}
                onClick={() => void addComment()}
                className="rounded bg-primary px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                Post
              </button>
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
        </div>
      )}
    </article>
  );
}
