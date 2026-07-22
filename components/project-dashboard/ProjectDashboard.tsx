"use client";

import { useEffect, useState } from "react";
import type { ProjectDashboardData } from "@/lib/metabase-queries";
import { DashboardCard } from "./DashboardCard";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { MilestoneTable } from "./MilestoneTable";
import { PhaseCompletionChart, StatusBreakdownChart } from "./charts";

/**
 * BI dashboard shown at the top of a project section. Fetches all widget
 * data for one project from /api/projects/[objectId]/dashboard (Metabase).
 */
export function ProjectDashboard({
  projectObjectId,
}: {
  projectObjectId: number;
}) {
  // Single state object keyed by project id so a project change naturally
  // reads as "loading" without synchronous setState calls in the effect.
  const [state, setState] = useState<{
    forId: number;
    data: ProjectDashboardData | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectObjectId}/dashboard`);
        const body = (await res.json()) as ProjectDashboardData & {
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setState({
            forId: projectObjectId,
            data: null,
            error: body.error ?? `Request failed (${res.status})`,
          });
        } else {
          setState({ forId: projectObjectId, data: body, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            forId: projectObjectId,
            data: null,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectObjectId]);

  const loading = state?.forId !== projectObjectId;
  const data = loading ? null : state.data;
  const error = loading ? null : state.error;

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Failed to load project dashboard: {error}
      </div>
    );
  }

  if (!data) return null;

  const percent = data.percentComplete;

  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-2">
      <DashboardCard title="Schedule — % Complete">
        <div className="flex h-full flex-col justify-center gap-3 pb-2">
          <div className="text-4xl font-bold text-primary">
            {percent === null ? "—" : `${percent}%`}
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-secondary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground/70">
            Weighted by target duration hours across all activities.
          </p>
        </div>
      </DashboardCard>

      <DashboardCard title="Schedule — Late Activities">
        <div className="flex h-full flex-col justify-center pb-2">
          <div
            className={`text-5xl font-bold ${data.lateActivities > 0 ? "text-destructive" : "text-green-600"}`}
          >
            {data.lateActivities}
          </div>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Incomplete activities past their target end date.
          </p>
        </div>
      </DashboardCard>

      <DashboardCard title="Schedule — % Complete by Phase" className="sm:col-span-2">
        <PhaseCompletionChart phases={data.phases} />
      </DashboardCard>

      <DashboardCard title="Schedule — Activity Status Breakdown">
        <StatusBreakdownChart breakdown={data.statusBreakdown} />
      </DashboardCard>

      <DashboardCard title="Schedule — Milestone Tracker">
        <MilestoneTable milestones={data.milestones} />
      </DashboardCard>
    </div>
  );
}
