"use client";

import { useCallback, useEffect, useState } from "react";
import { AppFooter, AppHeader, PageHeader } from "@/components/AppShell";
import { apiCall, fmtNum } from "@/components/my-work/types";
import type { UnitsReportResource } from "@/lib/units-report";

type ReportResponse = {
  labor?: UnitsReportResource[];
  nonlabor?: UnitsReportResource[];
  error?: string;
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function ResourceTable({
  title,
  unitLabel,
  resources,
}: {
  title: string;
  unitLabel: string;
  resources: UnitsReportResource[];
}) {
  return (
    <section className="rounded-lg border border-brand-border bg-card p-4">
      <h2 className="mb-3 border-l-4 border-secondary pl-2.5 text-xs font-semibold uppercase tracking-wide text-primary">
        {title}
      </h2>
      {resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No entries in the selected period.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3">Resource / Activity</th>
                <th className="py-1.5 pr-3">Project</th>
                <th className="py-1.5 pr-3 text-right">Days</th>
                <th className="py-1.5 text-right">{unitLabel}</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <ResourceRows key={resource.resourceName} resource={resource} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ResourceRows({ resource }: { resource: UnitsReportResource }) {
  return (
    <>
      <tr className="border-t border-brand-border/60 bg-muted/50 font-medium">
        <td className="py-1.5 pr-3">{resource.resourceName}</td>
        <td />
        <td />
        <td className="py-1.5 text-right">{fmtNum(resource.totalUnits)}</td>
      </tr>
      {resource.activities.map((a) => (
        <tr key={a.activityObjectId} className="border-t border-brand-border/40">
          <td className="py-1.5 pl-4 pr-3 text-muted-foreground">
            {a.activityName ?? a.activityId ?? a.activityObjectId}
          </td>
          <td className="py-1.5 pr-3 text-muted-foreground">
            {a.projectName ?? "—"}
          </td>
          <td className="py-1.5 pr-3 text-right text-muted-foreground">
            {a.days}
          </td>
          <td className="py-1.5 text-right">{fmtNum(a.units)}</td>
        </tr>
      ))}
    </>
  );
}

export default function UnitsReportPage() {
  const [from, setFrom] = useState(() => isoDaysAgo(30));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const [labor, setLabor] = useState<UnitsReportResource[]>([]);
  const [nonlabor, setNonlabor] = useState<UnitsReportResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await apiCall<ReportResponse>(
      `/api/reports/units?${params.toString()}`,
    );
    if (res.ok) {
      setLabor(res.data?.labor ?? []);
      setNonlabor(res.data?.nonlabor ?? []);
    } else {
      setError(res.error ?? "Failed to load report.");
      setLabor([]);
      setNonlabor([]);
    }
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <PageHeader
        title="Units Report"
        subtitle="Labor hours and non-labor units you entered, grouped by resource."
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-lg border border-brand-border bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Date range
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-brand-border px-2 py-1"
            />
            <span className="text-muted-foreground/70">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-brand-border px-2 py-1"
            />
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded bg-primary px-3 py-1.5 text-sm text-white hover:bg-secondary disabled:opacity-50"
            >
              {loading ? "Loading…" : "Run report"}
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-lg border border-brand-border bg-white"
              />
            ))}
          </div>
        ) : (
          <>
            <ResourceTable
              title="Labor (hours)"
              unitLabel="Hours"
              resources={labor}
            />
            <ResourceTable
              title="Non-Labor (units)"
              unitLabel="Units"
              resources={nonlabor}
            />
          </>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
