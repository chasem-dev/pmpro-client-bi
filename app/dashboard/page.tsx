"use client";

import { useEffect, useState } from "react";
import { AppFooter, AppHeader, PageHeader } from "@/components/AppShell";
import { ProjectDashboard } from "@/components/project-dashboard/ProjectDashboard";

type Project = {
  ObjectId: string;
  Id: string;
  Name: string;
  ParentEPSName?: string;
};

type ProjectsResponse = {
  projects?: Project[];
  error?: string;
};

/**
 * Standalone Project Dashboard tab: BI widgets for the projects linked to the
 * signed-in user's organization, one project at a time.
 */
export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then(async (res) => {
        const body = (await res.json()) as ProjectsResponse;
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? `Request failed (${res.status})`);
        } else {
          const list = body.projects ?? [];
          setProjects(list);
          setSelected(list[0]?.ObjectId ?? null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <PageHeader
        title="Project Dashboard"
        subtitle="Schedule health at a glance for your projects."
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="h-64 animate-pulse rounded-lg border border-brand-border bg-white" />
        ) : projects.length === 0 && !error ? (
          <div className="rounded-lg border border-brand-border bg-card p-10 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-xl">
              📊
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              No projects found
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Your organization doesn&apos;t have access to any projects yet.
              Contact an Admin to get set up.
            </p>
          </div>
        ) : (
          <>
            {projects.length > 1 && (
              <section className="rounded-lg border border-brand-border bg-card p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Project
                </h2>
                <div className="flex flex-wrap gap-2">
                  {projects.map((p) => (
                    <button
                      key={p.ObjectId}
                      type="button"
                      onClick={() => setSelected(p.ObjectId)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected === p.ObjectId
                          ? "border-primary bg-primary text-white"
                          : "border-brand-border bg-white text-foreground hover:bg-muted"
                      }`}
                    >
                      {p.Name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {selected != null && (
              <section>
                <h2 className="mb-3 border-l-4 border-secondary pl-3 text-lg font-semibold text-primary">
                  {projects.find((p) => p.ObjectId === selected)?.Name}
                </h2>
                <ProjectDashboard projectObjectId={Number(selected)} />
              </section>
            )}
          </>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
