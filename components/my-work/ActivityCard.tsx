"use client";

import { useEffect, useRef, useState } from "react";
import type {
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
  weekDates,
} from "./types";

export const activityAnchorId = (objectId: number) => `activity-${objectId}`;

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

function TimesheetGrid({
  activity,
  policies,
  onSaved,
}: {
  activity: MyActivity;
  policies?: FieldPolicies;
  onSaved: () => void;
}) {
  const dates = weekDates();
  const [values, setValues] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!policy(policies, "actualLaborUnits").editable) return null;
  if (activity.laborResources.length === 0) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    const entries = activity.laborResources.flatMap((r) =>
      dates
        .map((d) => ({
          activityObjectId: activity.objectId,
          resourceAssignmentObjectId: r.objectId,
          workDate: d,
          hours: values[`${r.objectId}-${d}`] ?? 0,
        }))
        .filter((e) => e.hours > 0),
    );
    const res = await apiCall("/api/timesheet", jsonInit("POST", { entries }));
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Failed to save timesheet");
    else onSaved();
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
                        className="w-14 rounded border border-brand-border px-1"
                        value={values[key] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [key]: Number(e.target.value) || 0,
                          }))
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
        disabled={busy}
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
  const dates = weekDates();
  const [values, setValues] = useState<Record<string, number>>({});
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
    const entries = activity.nonLaborResources.flatMap((r) =>
      dates
        .map((d) => ({
          activityObjectId: activity.objectId,
          resourceAssignmentObjectId: r.objectId,
          workDate: d,
          units: values[`${r.objectId}-${d}`] ?? 0,
        }))
        .filter((e) => e.units > 0),
    );
    const res = await apiCall("/api/nonlabor", jsonInit("POST", { entries }));
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Failed to save");
    else onSaved();
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
                            className="w-14 rounded border border-brand-border px-1"
                            value={values[key] ?? ""}
                            onChange={(e) =>
                              setValues((v) => ({
                                ...v,
                                [key]: Number(e.target.value) || 0,
                              }))
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
            disabled={busy}
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

export function ActivityCard({
  activity,
  policies,
  onRefresh,
  linkableIds,
}: {
  activity: MyActivity;
  policies?: FieldPolicies;
  onRefresh: () => void;
  /** ObjectIds of activities rendered on this page (relationship links). */
  linkableIds?: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [pct, setPct] = useState(
    activity.percentComplete != null ? String(activity.percentComplete) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLElement>(null);

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
    else onRefresh();
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
    else onRefresh();
  }

  async function updateAssignment(
    id: number,
    fields: Record<string, unknown>,
    resourceType: string,
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
    else onRefresh();
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
          {show("activityId") && show("activityName") && activity.id && (
            <p className="text-xs text-muted-foreground">{activity.id}</p>
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
      <header className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {show("percentComplete") && (
          <div>
            <span className="text-xs text-muted-foreground">% Complete</span>
            {edit("percentComplete") ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  className="w-20 rounded border border-brand-border px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void updateActivity({ PercentComplete: Number(pct) })
                  }
                  className="text-xs text-secondary"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm">{fmtNum(activity.percentComplete, 0)}%</p>
            )}
          </div>
        )}
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
                    {show("atCompleteLaborUnits") && <th>At Complete</th>}
                    {show("actualLaborUnits") && <th>Actual</th>}
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
                      {show("atCompleteLaborUnits") && (
                        <td>
                          {edit("atCompleteLaborUnits") ? (
                            <input
                              type="number"
                              step={0.1}
                              defaultValue={r.atCompletionUnits ?? ""}
                              onBlur={(e) =>
                                void updateAssignment(
                                  r.objectId,
                                  {
                                    atCompletionUnits: Number(e.target.value),
                                  },
                                  "labor",
                                )
                              }
                              className="w-20 rounded border border-brand-border px-1"
                            />
                          ) : (
                            fmtNum(r.atCompletionUnits)
                          )}
                        </td>
                      )}
                      {show("actualLaborUnits") && (
                        <td>{fmtNum(r.actualUnits)}</td>
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
                    {show("atCompleteNonLaborUnits") && <th>At Complete</th>}
                    {show("actualNonLaborUnits") && <th>Actual</th>}
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
                      {show("atCompleteNonLaborUnits") && (
                        <td>
                          {edit("atCompleteNonLaborUnits") ? (
                            <input
                              type="number"
                              step={0.1}
                              defaultValue={r.atCompletionUnits ?? ""}
                              onBlur={(e) =>
                                void updateAssignment(
                                  r.objectId,
                                  {
                                    atCompletionUnits: Number(e.target.value),
                                  },
                                  "nonlabor",
                                )
                              }
                              className="w-20 rounded border border-brand-border px-1"
                            />
                          ) : (
                            fmtNum(r.atCompletionUnits)
                          )}
                        </td>
                      )}
                      {show("actualNonLaborUnits") && (
                        <td>{fmtNum(r.actualUnits)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {(show("materialName") || show("budgetedMaterialCost")) &&
        activity.materialResources.length > 0 && (
          <section className="mt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Materials
            </h4>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    {show("materialName") && <th className="py-1">Material</th>}
                    {show("budgetedMaterialCost") && <th>Budgeted Cost</th>}
                    {show("actualMaterialCost") && <th>Actual Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {activity.materialResources.map((r) => (
                    <tr key={r.objectId}>
                      {show("materialName") && (
                        <td className="py-1">{r.resourceName ?? r.objectId}</td>
                      )}
                      {show("budgetedMaterialCost") && (
                        <td>{fmtNum(r.plannedCost, 0)}</td>
                      )}
                      {show("actualMaterialCost") && (
                        <td>
                          {edit("actualMaterialCost") ? (
                            <input
                              type="number"
                              step={1}
                              defaultValue={r.actualCost ?? ""}
                              onBlur={(e) =>
                                void updateAssignment(
                                  r.objectId,
                                  { actualCost: Number(e.target.value) },
                                  "material",
                                )
                              }
                              className="w-24 rounded border border-brand-border px-1"
                            />
                          ) : (
                            fmtNum(r.actualCost, 0)
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
