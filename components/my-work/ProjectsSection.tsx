"use client";

import { useEffect, useState } from "react";

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

/** Projects the signed-in user's organization is linked to. */
export function ProjectsSection() {
  const [projects, setProjects] = useState<Project[]>([]);
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
          setProjects(body.projects ?? []);
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
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Your projects
        {!loading && !error && projects.length > 0 && (
          <span className="ml-1.5 font-normal text-zinc-400">
            ({projects.length})
          </span>
        )}
      </h2>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-md border border-zinc-100 bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-900"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : projects.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your organization doesn&apos;t have access to any projects yet.
          Contact an Admin to get set up.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.ObjectId}
              className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <div className="truncate text-sm font-medium text-black dark:text-zinc-50">
                {project.Name}
              </div>
              <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {project.Id}
                {project.ParentEPSName ? ` · ${project.ParentEPSName}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
