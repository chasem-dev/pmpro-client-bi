"use client";

import { useEffect, useState } from "react";
import { AppFooter, AppHeader, PageHeader } from "@/components/AppShell";
import { OrgLinksPanel } from "./org-links-panel";
import {
  apiCall,
  Field,
  FormMessage,
  inputClass,
  jsonInit,
  Panel,
} from "./ui";

// Activity creation is temporarily disabled; flip this to bring the form back.
const ENABLE_ACTIVITY_CREATION = false;

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
    const res = await apiCall<{ projects: Project[] }>("/api/projects?scope=all");
    if (res.ok) setProjects(res.data?.projects ?? []);
    else setLoadError(res.error ?? "Failed to load projects.");
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiCall<{ eps: Eps[] }>("/api/eps"),
      apiCall<{ projects: Project[] }>("/api/projects?scope=all"),
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
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <PageHeader
        title="Admin"
        subtitle="Create projects, link client organizations, and manage access."
      />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {loadError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        )}

        <CreateProjectForm eps={eps} onCreated={loadProjects} />

        <OrgLinksPanel projects={projects} />

        <Panel title="Manage a project">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm text-foreground"
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

        <PolicyManager eps={eps} />
        <AuditPanel />
      </main>

      <AppFooter />
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
          <span className="mt-1 block text-xs font-normal normal-case text-muted-foreground/70">
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
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="mt-5 space-y-5 border-t border-brand-border pt-5">
      {ENABLE_ACTIVITY_CREATION && (
        <CreateActivityForm
          projectObjectId={project.ObjectId}
          wbs={wbs}
          onCreated={loadActivities}
        />
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Activities
          {!loading && (
            <span className="ml-1.5 font-normal text-muted-foreground/70">
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
                className="h-12 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-sm text-muted-foreground">No activities yet.</div>
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
      className="space-y-3 rounded-md border border-brand-border bg-muted p-3"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Add activity"}
      </button>
      {wbs.length === 0 && (
        <p className="text-xs text-amber-600">
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
    <li className="rounded-md border border-brand-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {activity.Name}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
            className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-brand-border/60 pt-3">
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
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-secondary disabled:opacity-50"
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

type PolicyRule = {
  fieldKey: string;
  visible: boolean;
  editable: boolean;
};

type CompanyRule = {
  epsObjectId: string;
  epsId: string;
  epsName: string;
};

function PolicyManager({ eps }: { eps: Eps[] }) {
  const [scope, setScope] = useState<"org" | "user">("org");
  const [subjectKey, setSubjectKey] = useState("");
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [companies, setCompanies] = useState<CompanyRule[]>([]);
  const [selectedEps, setSelectedEps] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPolicies() {
    if (!subjectKey.trim()) return;
    setError(null);
    const res = await apiCall<{
      policies: PolicyRule[];
      companies: CompanyRule[];
    }>(`/api/policies?scope=${scope}&subjectKey=${encodeURIComponent(subjectKey.trim())}`);
    if (res.ok) {
      setPolicies(res.data?.policies ?? []);
      setCompanies(res.data?.companies ?? []);
    } else {
      setError(res.error ?? "Failed to load policies.");
    }
  }

  async function savePolicy(fieldKey: string, visible: boolean, editable: boolean) {
    if (!subjectKey.trim()) return;
    const res = await apiCall("/api/policies", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope,
        subjectKey: subjectKey.trim(),
        fieldKey,
        visible,
        editable,
      }),
    });
    if (res.ok) {
      setMessage(`Saved policy for ${fieldKey}.`);
      void loadPolicies();
    } else {
      setError(res.error ?? "Failed to save policy.");
    }
  }

  async function addCompany() {
    if (!subjectKey.trim() || !selectedEps) return;
    const node = eps.find((e) => e.ObjectId === selectedEps);
    if (!node) return;
    const res = await apiCall("/api/policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope,
        subjectKey: subjectKey.trim(),
        epsObjectId: node.ObjectId,
        epsId: node.Id,
        epsName: node.Name,
      }),
    });
    if (res.ok) {
      setMessage(`Granted access to ${node.Name}.`);
      void loadPolicies();
    } else {
      setError(res.error ?? "Failed to add company access.");
    }
  }

  async function removeCompany(epsObjectId: string) {
    const res = await apiCall(
      `/api/policies?scope=${scope}&subjectKey=${encodeURIComponent(subjectKey.trim())}&epsObjectId=${epsObjectId}`,
      { method: "DELETE" },
    );
    if (res.ok) void loadPolicies();
    else setError(res.error ?? "Failed to remove company access.");
  }

  return (
    <Panel title="Field & company access">
      <p className="mb-3 text-sm text-muted-foreground">
        Configure which fields are visible/editable and which client companies
        (2nd-level EPS) a Clerk org or user can access. Leave company access
        empty to allow all Production projects.
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Scope">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "org" | "user")}
            className={inputClass}
          >
            <option value="org">Organization (Clerk org ID)</option>
            <option value="user">User (Clerk user ID)</option>
          </select>
        </Field>
        <Field label="Subject key">
          <input
            value={subjectKey}
            onChange={(e) => setSubjectKey(e.target.value)}
            placeholder={scope === "org" ? "org_..." : "user_..."}
            className={inputClass}
          />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void loadPolicies()}
            className="h-10 rounded-md border border-brand-border px-4 text-sm"
          >
            Load
          </button>
        </div>
      </div>

      {error && <FormMessage tone="error">{error}</FormMessage>}
      {message && <FormMessage tone="success">{message}</FormMessage>}

      {policies.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2">Field</th>
                <th>Visible</th>
                <th>Editable</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <PolicyRow
                  key={p.fieldKey}
                  rule={p}
                  onSave={(visible, editable) =>
                    void savePolicy(p.fieldKey, visible, editable)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-brand-border pt-4">
        <h3 className="mb-2 text-sm font-semibold">Allowed companies (EPS)</h3>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedEps}
            onChange={(e) => setSelectedEps(e.target.value)}
            className="rounded border border-brand-border px-2 py-1 text-sm"
          >
            <option value="">Select client EPS…</option>
            {eps.map((e) => (
              <option key={e.ObjectId} value={e.ObjectId}>
                {e.Name} ({e.Id})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void addCompany()}
            disabled={!selectedEps}
            className="rounded bg-primary px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {companies.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {companies.map((c) => (
              <li key={c.epsObjectId} className="flex items-center gap-2">
                <span>
                  {c.epsName} ({c.epsId})
                </span>
                <button
                  type="button"
                  onClick={() => void removeCompany(c.epsObjectId)}
                  className="text-xs text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function PolicyRow({
  rule,
  onSave,
}: {
  rule: PolicyRule;
  onSave: (visible: boolean, editable: boolean) => void;
}) {
  const [visible, setVisible] = useState(rule.visible);
  const [editable, setEditable] = useState(rule.editable);

  return (
    <tr className="border-t border-brand-border/60">
      <td className="py-2 font-mono text-xs">{rule.fieldKey}</td>
      <td>
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
        />
      </td>
      <td>
        <input
          type="checkbox"
          checked={editable}
          onChange={(e) => setEditable(e.target.checked)}
        />
      </td>
      <td>
        <button
          type="button"
          onClick={() => onSave(visible, editable)}
          className="text-xs text-secondary"
        >
          Save
        </button>
      </td>
    </tr>
  );
}

function AuditPanel() {
  const [logs, setLogs] = useState<
    {
      action: string;
      entityType: string;
      entityId?: string;
      details?: string;
      createdAt: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await apiCall<{ logs: typeof logs }>("/api/audit?limit=50");
    setLoading(false);
    if (res.ok) setLogs(res.data?.logs ?? []);
    else setError(res.error ?? "Failed to load audit log.");
  }

  return (
    <Panel title="Recent activity (audit)">
      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className="mb-3 rounded border border-brand-border px-3 py-1 text-sm"
      >
        {loading ? "Loading…" : "Load my audit log"}
      </button>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {logs.length > 0 && (
        <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
          {logs.map((log, i) => (
            <li
              key={i}
              className="rounded border border-brand-border/60 px-2 py-1"
            >
              <span className="text-muted-foreground/70">
                {new Date(log.createdAt).toLocaleString()}
              </span>{" "}
              <strong>{log.action}</strong> {log.entityType}
              {log.entityId ? ` #${log.entityId}` : ""}
              {log.details ? ` — ${log.details}` : ""}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
