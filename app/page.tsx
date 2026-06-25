"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Project = {
  ObjectId: string;
  Id: string;
  Name: string;
};

type Activity = {
  ObjectId: string;
  Name: string;
  ProjectName?: string;
  Status?: string;
  PrimaryResourceId?: string;
  PrimaryResourceName?: string;
  PrimaryResourceObjectId?: string;
  PlannedLaborUnits?: number | string;
  ActualLaborUnits?: number | string;
  PlannedLaborCost?: number | string;
  ActualLaborCost?: number | string;
};

type ProjectsResponse = {
  projects?: Project[];
  error?: string;
};

type ActivitiesResponse = {
  activities?: Activity[];
  error?: string;
};

async function fetchProjects(): Promise<{ projects: Project[]; error?: string }> {
  try {
    const res = await fetch("/api/projects");
    const body = (await res.json()) as ProjectsResponse;
    if (!res.ok) {
      return { projects: [], error: body.error ?? `Request failed (${res.status})` };
    }
    return { projects: body.projects ?? [] };
  } catch (err) {
    return {
      projects: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function fetchActivities(
  projectObjectId: string,
): Promise<{ activities: Activity[]; error?: string }> {
  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectObjectId)}/activities`,
    );
    const body = (await res.json()) as ActivitiesResponse;
    if (!res.ok) {
      return {
        activities: [],
        error: body.error ?? `Request failed (${res.status})`,
      };
    }
    return { activities: body.activities ?? [] };
  } catch (err) {
    return {
      activities: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function num(value: number | string | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

const fmtUnits = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 1 });

const fmtCost = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

// Planned-vs-actual progress bar with actual/planned labels.
function StatBar({
  label,
  planned,
  actual,
  format,
}: {
  label: string;
  planned: number;
  actual: number;
  format: (n: number) => string;
}) {
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
  const over = planned > 0 && actual > planned;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-700 dark:text-zinc-300">
          {format(actual)}
          <span className="text-zinc-400"> / {format(planned)}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full ${
            over ? "bg-amber-500" : "bg-blue-500"
          }`}
          style={{ width: `${planned > 0 ? pct : 0}%` }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const activeRequest = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProjects().then((result) => {
      if (cancelled) return;
      setProjects(result.projects);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    setSelectedId(null);
    const result = await fetchProjects();
    setProjects(result.projects);
    setError(result.error ?? null);
    setLoading(false);
  }

  async function selectProject(project: Project) {
    // Toggle off if already selected.
    if (selectedId === project.ObjectId) {
      setSelectedId(null);
      activeRequest.current = null;
      return;
    }
    activeRequest.current = project.ObjectId;
    setSelectedId(project.ObjectId);
    setActivities([]);
    setActivitiesError(null);
    setActivitiesLoading(true);
    const result = await fetchActivities(project.ObjectId);
    // Ignore if the user moved on to another project meanwhile.
    if (activeRequest.current !== project.ObjectId) return;
    setActivities(result.activities);
    setActivitiesError(result.error ?? null);
    setActivitiesLoading(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4 dark:bg-black">
      <nav className="mx-auto mb-6 flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            PMPro BI
          </span>
          <Link
            href="/admin"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Admin
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="h-9 rounded-md bg-zinc-800 px-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-black">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              P6 Projects
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {loading
                ? "Loading projects from Primavera P6…"
                : `${projects.length} project${projects.length === 1 ? "" : "s"} from Primavera P6. Click a project to view its activities.`}
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="h-9 shrink-0 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              />
            ))}
          </div>
        ) : projects.length === 0 && !error ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            No projects found.
          </div>
        ) : (
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const isSelected = selectedId === project.ObjectId;
              return (
                <article
                  key={project.ObjectId}
                  className={`flex flex-col rounded-lg border bg-white shadow-sm transition-shadow dark:bg-zinc-950 ${
                    isSelected
                      ? "border-blue-500 ring-1 ring-blue-500 sm:col-span-2 lg:col-span-3 dark:border-blue-500"
                      : "border-zinc-200 hover:shadow-md dark:border-zinc-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void selectProject(project)}
                    aria-expanded={isSelected}
                    className="flex flex-col items-start p-4 text-left"
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
                        {project.Name}
                      </h2>
                      <span
                        className={`mt-0.5 shrink-0 text-zinc-400 transition-transform ${
                          isSelected ? "rotate-90" : ""
                        }`}
                        aria-hidden
                      >
                        ›
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
                      {project.Id}
                    </p>
                    <span className="mt-3 inline-flex w-fit items-center rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                      ObjectId {project.ObjectId}
                    </span>
                  </button>

                  {isSelected && (
                    <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                          Activities
                          {!activitiesLoading && !activitiesError && (
                            <span className="ml-1.5 font-normal text-zinc-400">
                              ({activities.length})
                            </span>
                          )}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setSelectedId(null)}
                          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        >
                          Close
                        </button>
                      </div>

                      {!activitiesLoading &&
                        !activitiesError &&
                        activities.length > 0 && (
                          <div className="mb-3 grid gap-x-6 gap-y-2 rounded-md border border-zinc-100 bg-zinc-50 p-3 sm:grid-cols-2 dark:border-zinc-900 dark:bg-zinc-900/40">
                            <StatBar
                              label="Total labor units (actual / planned)"
                              planned={activities.reduce(
                                (s, a) => s + num(a.PlannedLaborUnits),
                                0,
                              )}
                              actual={activities.reduce(
                                (s, a) => s + num(a.ActualLaborUnits),
                                0,
                              )}
                              format={fmtUnits}
                            />
                            <StatBar
                              label="Total labor cost (actual / planned)"
                              planned={activities.reduce(
                                (s, a) => s + num(a.PlannedLaborCost),
                                0,
                              )}
                              actual={activities.reduce(
                                (s, a) => s + num(a.ActualLaborCost),
                                0,
                              )}
                              format={fmtCost}
                            />
                          </div>
                        )}

                      {activitiesLoading ? (
                        <div className="space-y-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-9 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900"
                            />
                          ))}
                        </div>
                      ) : activitiesError ? (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                          {activitiesError}
                        </div>
                      ) : activities.length === 0 ? (
                        <div className="text-sm text-zinc-500">
                          No activities found for this project.
                        </div>
                      ) : (
                        <ul className="max-h-[32rem] divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-100 dark:divide-zinc-900 dark:border-zinc-900">
                          {activities.map((activity) => (
                            <li key={activity.ObjectId} className="px-3 py-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-sm text-zinc-800 dark:text-zinc-200">
                                  {activity.Name}
                                </span>
                                {activity.PrimaryResourceName && (
                                  <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                                    {activity.PrimaryResourceName}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                                <StatBar
                                  label="Labor units (actual / planned)"
                                  planned={num(activity.PlannedLaborUnits)}
                                  actual={num(activity.ActualLaborUnits)}
                                  format={fmtUnits}
                                />
                                <StatBar
                                  label="Labor cost (actual / planned)"
                                  planned={num(activity.PlannedLaborCost)}
                                  actual={num(activity.ActualLaborCost)}
                                  format={fmtCost}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
