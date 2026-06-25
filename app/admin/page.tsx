"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

type Project = { ObjectId: string; Id: string; Name: string };
type Eps = { ObjectId: string; Id: string; Name: string };
type Wbs = { ObjectId: string; Name: string; Code?: string };
type User = { ObjectId: string; Name?: string; EmailAddress?: string };
type Activity = {
  ObjectId: string;
  Name: string;
  Status?: string;
  ActivityOwnerUserId?: number;
  OwnerNamesArray?: string[];
  PrimaryResourceName?: string;
  PlannedLaborUnits?: number | string;
  PlannedLaborCost?: number | string;
  PlannedStartDate?: string;
  PlannedFinishDate?: string;
};

async function apiCall<T>(
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
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

// HTML date input → P6 date-time, and back.
const toP6Date = (d: string) => (d ? `${d}T00:00:00` : undefined);
const toDateInput = (s?: string) => (s ? s.slice(0, 10) : "");

export default function AdminPage() {
  const [eps, setEps] = useState<Eps[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  async function loadProjects() {
    const res = await apiCall<{ projects: Project[] }>("/api/projects");
    if (res.ok) setProjects(res.data?.projects ?? []);
    else setLoadError(res.error ?? "Failed to load projects.");
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiCall<{ eps: Eps[] }>("/api/eps"),
      apiCall<{ projects: Project[] }>("/api/projects"),
      apiCall<{ users: User[] }>("/api/users"),
    ]).then(([epsRes, projRes, usersRes]) => {
      if (cancelled) return;
      if (epsRes.ok) setEps(epsRes.data?.eps ?? []);
      if (projRes.ok) setProjects(projRes.data?.projects ?? []);
      if (usersRes.ok) setUsers(usersRes.data?.users ?? []);
      const firstError =
        epsRes.error ?? projRes.error ?? usersRes.error ?? null;
      if (firstError) setLoadError(firstError);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProject = projects.find((p) => p.ObjectId === selectedProjectId);

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4 dark:bg-black">
      <nav className="mx-auto mb-6 flex max-w-4xl items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            PMPro BI
          </span>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Projects
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

      <main className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Admin
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create projects under a business (EPS), then manage activities and
            owner assignments within a project.
          </p>
        </header>

        {loadError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {loadError}
          </div>
        )}

        <CreateProjectForm eps={eps} onCreated={loadProjects} />

        <Panel title="Manage a project">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.ObjectId} value={p.ObjectId}>
                {p.Name} ({p.Id})
              </option>
            ))}
          </select>

          {selectedProject && (
            <ProjectManager
              key={selectedProject.ObjectId}
              project={selectedProject}
              users={users}
            />
          )}
        </Panel>
      </main>
    </div>
  );
}

function CreateProjectForm({
  eps,
  onCreated,
}: {
  eps: Eps[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [epsId, setEpsId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Pick a sensible default folder so users don't have to think about EPS:
  // prefer the "BI Dashboard Demo" EPS, otherwise the first one available.
  const defaultEpsId =
    eps.find((n) => n.Id === "DEMO" || /bi dashboard demo/i.test(n.Name))
      ?.ObjectId ??
    eps[0]?.ObjectId ??
    "";
  const effectiveEpsId = epsId || defaultEpsId;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const res = await apiCall(
      "/api/projects",
      jsonInit("POST", {
        Id: id.trim(),
        Name: name.trim(),
        ParentEPSObjectId: Number(effectiveEpsId),
        Description: description.trim() || undefined,
      }),
    );
    setSubmitting(false);
    if (res.ok) {
      setSuccess(`Project "${name.trim()}" created.`);
      setName("");
      setId("");
      setDescription("");
      onCreated();
    } else {
      setError(res.error ?? "Failed to create project.");
    }
  }

  return (
    <Panel title="Create a project">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name *">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className={inputClass}
            />
          </Field>
          <Field label="Id (short code) *">
            <input
              required
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. NEW-001"
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Project folder">
          <select
            value={effectiveEpsId}
            onChange={(e) => setEpsId(e.target.value)}
            className={inputClass}
          >
            {eps.map((node) => (
              <option key={node.ObjectId} value={node.ObjectId}>
                {node.Name} ({node.Id})
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal normal-case text-zinc-400">
            Where the project lives in P6 (its EPS folder). A default is
            pre-selected — leave it unless you need a specific one.
          </span>
        </Field>
        <Field label="Description">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </Field>

        {error && <FormMessage tone="error">{error}</FormMessage>}
        {success && <FormMessage tone="success">{success}</FormMessage>}

        <button
          type="submit"
          disabled={submitting || !name.trim() || !id.trim() || !effectiveEpsId}
          className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create project"}
        </button>
      </form>
    </Panel>
  );
}

function ProjectManager({
  project,
  users,
}: {
  project: Project;
  users: User[];
}) {
  const [wbs, setWbs] = useState<Wbs[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadActivities() {
    const res = await apiCall<{ activities: Activity[] }>(
      `/api/projects/${project.ObjectId}/activities`,
    );
    if (res.ok) setActivities(res.data?.activities ?? []);
    else setError(res.error ?? "Failed to load activities.");
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiCall<{ wbs: Wbs[] }>(`/api/projects/${project.ObjectId}/wbs`),
      apiCall<{ activities: Activity[] }>(
        `/api/projects/${project.ObjectId}/activities`,
      ),
    ]).then(([wbsRes, actRes]) => {
      if (cancelled) return;
      if (wbsRes.ok) setWbs(wbsRes.data?.wbs ?? []);
      if (actRes.ok) setActivities(actRes.data?.activities ?? []);
      const firstError = wbsRes.error ?? actRes.error ?? null;
      if (firstError) setError(firstError);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [project.ObjectId]);

  return (
    <div className="mt-5 space-y-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <CreateActivityForm
        projectObjectId={project.ObjectId}
        wbs={wbs}
        onCreated={loadActivities}
      />

      <div>
        <h3 className="mb-2 text-sm font-semibold text-black dark:text-zinc-50">
          Activities
          {!loading && (
            <span className="ml-1.5 font-normal text-zinc-400">
              ({activities.length})
            </span>
          )}
        </h3>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900"
              />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-sm text-zinc-500">No activities yet.</div>
        ) : (
          <ul className="space-y-2">
            {activities.map((activity) => (
              <ActivityRow
                key={activity.ObjectId}
                activity={activity}
                users={users}
                onMutated={loadActivities}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CreateActivityForm({
  projectObjectId,
  wbs,
  onCreated,
}: {
  projectObjectId: string;
  wbs: Wbs[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [wbsId, setWbsId] = useState("");
  const [start, setStart] = useState("");
  const [finish, setFinish] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const res = await apiCall(
      `/api/projects/${projectObjectId}/activities`,
      jsonInit("POST", {
        Name: name.trim(),
        WBSObjectId: Number(wbsId),
        PlannedStartDate: toP6Date(start),
        PlannedFinishDate: toP6Date(finish),
      }),
    );
    setSubmitting(false);
    if (res.ok) {
      setSuccess(`Activity "${name.trim()}" created.`);
      setName("");
      setStart("");
      setFinish("");
      onCreated();
    } else {
      setError(res.error ?? "Failed to create activity.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        New activity
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Activity name"
            className={inputClass}
          />
        </Field>
        <Field label="WBS *">
          <select
            required
            value={wbsId}
            onChange={(e) => setWbsId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select a WBS…</option>
            {wbs.map((node) => (
              <option key={node.ObjectId} value={node.ObjectId}>
                {node.Code ? `${node.Code} — ` : ""}
                {node.Name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Planned start">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Planned finish">
          <input
            type="date"
            value={finish}
            onChange={(e) => setFinish(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {error && <FormMessage tone="error">{error}</FormMessage>}
      {success && <FormMessage tone="success">{success}</FormMessage>}

      <button
        type="submit"
        disabled={submitting || !name.trim() || !wbsId}
        className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Add activity"}
      </button>
      {wbs.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          This project has no WBS nodes, so activities can&apos;t be created
          until one exists.
        </p>
      )}
    </form>
  );
}

function ActivityRow({
  activity,
  users,
  onMutated,
}: {
  activity: Activity;
  users: User[];
  onMutated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(activity.Name);
  const [ownerId, setOwnerId] = useState(
    activity.ActivityOwnerUserId ? String(activity.ActivityOwnerUserId) : "",
  );
  const [laborUnits, setLaborUnits] = useState(
    activity.PlannedLaborUnits != null ? String(activity.PlannedLaborUnits) : "",
  );
  const [laborCost, setLaborCost] = useState(
    activity.PlannedLaborCost != null ? String(activity.PlannedLaborCost) : "",
  );
  const [start, setStart] = useState(toDateInput(activity.PlannedStartDate));
  const [finish, setFinish] = useState(toDateInput(activity.PlannedFinishDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await apiCall(
      `/api/activities/${activity.ObjectId}`,
      jsonInit("PUT", {
        Name: name.trim(),
        ActivityOwnerUserId: ownerId || undefined,
        PlannedLaborUnits: laborUnits || undefined,
        PlannedLaborCost: laborCost || undefined,
        PlannedStartDate: toP6Date(start),
        PlannedFinishDate: toP6Date(finish),
      }),
    );
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      onMutated();
    } else {
      setError(res.error ?? "Update failed.");
    }
  }

  async function remove() {
    if (!window.confirm(`Delete activity "${activity.Name}"?`)) return;
    setBusy(true);
    setError(null);
    const res = await apiCall(`/api/activities/${activity.ObjectId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) onMutated();
    else setError(res.error ?? "Delete failed.");
  }

  const ownerLabel =
    activity.OwnerNamesArray?.join(", ") ||
    users.find((u) => String(u.ObjectId) === String(activity.ActivityOwnerUserId))
      ?.Name ||
    "—";

  return (
    <li className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-black dark:text-zinc-50">
            {activity.Name}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>#{activity.ObjectId}</span>
            {activity.Status && <span>{activity.Status}</span>}
            <span>Owner: {ownerLabel}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            disabled={busy}
            className="text-xs text-zinc-600 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Assigned user">
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.ObjectId} value={u.ObjectId}>
                    {u.Name ?? u.EmailAddress ?? u.ObjectId}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Planned labor units">
              <input
                type="number"
                step="any"
                value={laborUnits}
                onChange={(e) => setLaborUnits(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Planned labor cost">
              <input
                type="number"
                step="any"
                value={laborCost}
                onChange={(e) => setLaborCost(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Planned start">
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Planned finish">
              <input
                type="date"
                value={finish}
                onChange={(e) => setFinish(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {error && <FormMessage tone="error">{error}</FormMessage>}

          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
      {!editing && error && (
        <div className="mt-2">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      )}
    </li>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${classes}`}>
      {children}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}
