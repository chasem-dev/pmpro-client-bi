"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppFooter, AppHeader, PageHeader } from "@/components/AppShell";
import { ActivityCard } from "@/components/my-work/ActivityCard";
import { ProjectDashboard } from "@/components/project-dashboard/ProjectDashboard";
import { ProjectsSection } from "@/components/my-work/ProjectsSection";
import type { MyActivitiesResponse, MyActivity } from "@/components/my-work/types";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <MyWork />
    </Suspense>
  );
}

function MyWork() {
  // Global admins land here with ?project=<ObjectId> from the admin page to
  // see a project exactly as its clients do.
  const adminProjectId = useSearchParams().get("project");

  const [activities, setActivities] = useState<MyActivity[]>([]);
  const [policies, setPolicies] = useState<MyActivitiesResponse["policies"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState("30");
  const [useRange, setUseRange] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (useRange) {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else if (days) {
      params.set("days", days);
    }
    if (adminProjectId) params.set("project", adminProjectId);
    try {
      const res = await fetch(`/api/my/activities?${params.toString()}`);
      const body = (await res.json()) as MyActivitiesResponse;
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`);
        setActivities([]);
      } else {
        setActivities(body.activities ?? []);
        setPolicies(body.policies);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setActivities([]);
    }
    setLoading(false);
  }, [days, useRange, from, to, adminProjectId]);

  useEffect(() => {
    // Defer to a macrotask so the effect doesn't set state synchronously
    // (react-hooks/set-state-in-effect); also coalesces rapid filter changes.
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, MyActivity[]>();
    for (const a of activities) {
      const key = a.projectName ?? "Unknown project";
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activities]);

  // Relationship entries only become links when the target activity is
  // rendered somewhere on this page.
  const linkableIds = useMemo(
    () => new Set(activities.map((a) => a.objectId)),
    [activities],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <PageHeader
        title={adminProjectId ? "Project View" : "My Work"}
        subtitle={
          adminProjectId
            ? "Admin view: every activity in this project, as clients see it."
            : "Activities assigned to you via the P6 Owner Email field."
        }
      >
        <button
          onClick={() => void load()}
          disabled={loading}
          className="h-9 shrink-0 rounded-md border border-white/40 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </PageHeader>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {adminProjectId ? (
          <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>
              You are viewing project #{adminProjectId} as a global admin.
            </span>
            <a href="/admin" className="font-medium text-secondary hover:underline">
              Back to Admin
            </a>
          </div>
        ) : (
          <ProjectsSection />
        )}

        <section className="rounded-lg border border-brand-border bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Time period
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!useRange}
                onChange={() => setUseRange(false)}
              />
              Days from today
              <input
                type="number"
                min={1}
                value={days}
                disabled={useRange}
                onChange={(e) => setDays(e.target.value)}
                className="w-20 rounded border border-brand-border px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={useRange}
                onChange={() => setUseRange(true)}
              />
              Date range
            </label>
            {useRange && (
              <>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded border border-brand-border px-2 py-1 text-sm"
                />
                <span className="text-sm text-muted-foreground/70">to</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded border border-brand-border px-2 py-1 text-sm"
                />
              </>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="rounded bg-primary px-3 py-1.5 text-sm text-white hover:bg-secondary"
            >
              Apply filter
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
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg border border-brand-border bg-white"
              />
            ))}
          </div>
        ) : activities.length === 0 && !error ? (
          <div className="rounded-lg border border-brand-border bg-card p-10 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-xl">
              📁
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              No activities found
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              No activities are assigned to you in the selected time period. If
              you believe this is a mistake, contact an Admin.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([projectName, projectActivities]) => {
              const projectObjectId = projectActivities.find(
                (a) => a.projectObjectId != null,
              )?.projectObjectId;
              const late = projectActivities.filter((a) => a.isLate);
              const onTrack = projectActivities.filter((a) => !a.isLate);
              return (
                <section key={projectName}>
                  <h2 className="mb-3 border-l-4 border-secondary pl-3 text-lg font-semibold text-primary">
                    {projectName}
                    <span className="ml-2 text-sm font-normal text-muted-foreground/70">
                      ({projectActivities.length})
                    </span>
                  </h2>
                  {projectObjectId != null && (
                    <ProjectDashboard projectObjectId={projectObjectId} />
                  )}
                  {late.length > 0 && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50/50 p-3">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-800">
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Late
                        </span>
                        Past due — not completed or not started (
                        {late.length})
                      </h3>
                      <div className="space-y-4">
                        {late.map((activity) => (
                          <ActivityCard
                            key={activity.objectId}
                            activity={activity}
                            policies={policies}
                            onRefresh={load}
                            linkableIds={linkableIds}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-4">
                    {onTrack.map((activity) => (
                      <ActivityCard
                        key={activity.objectId}
                        activity={activity}
                        policies={policies}
                        onRefresh={load}
                        linkableIds={linkableIds}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
