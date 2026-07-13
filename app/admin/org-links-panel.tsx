"use client";

import { useEffect, useState } from "react";
import { apiCall, Field, FormMessage, inputClass, jsonInit, Panel } from "./ui";

type Project = {
  ObjectId: string;
  Id: string;
  Name: string;
  ParentEPSId?: string;
  ParentEPSName?: string;
};
type Organization = { id: string; name: string; slug: string | null };
type OrgLink = {
  projectObjectId: string;
  clerkOrgId: string;
  clerkOrgName: string;
  linkedAt: string;
};

export function OrgLinksPanel({ projects }: { projects: Project[] }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [links, setLinks] = useState<OrgLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadLinks() {
    const res = await apiCall<{ links: OrgLink[] }>("/api/project-org-links");
    if (res.ok) setLinks(res.data?.links ?? []);
    else setError(res.error ?? "Failed to load organization links.");
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiCall<{ organizations: Organization[] }>("/api/organizations"),
      apiCall<{ links: OrgLink[] }>("/api/project-org-links"),
    ]).then(([orgsRes, linksRes]) => {
      if (cancelled) return;
      if (orgsRes.ok) setOrganizations(orgsRes.data?.organizations ?? []);
      if (linksRes.ok) setLinks(linksRes.data?.links ?? []);
      const firstError = orgsRes.error ?? linksRes.error ?? null;
      if (firstError) setError(firstError);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const linkedProjectIds = new Set(links.map((l) => l.projectObjectId));
  const unlinkedProjects = projects.filter(
    (p) => !linkedProjectIds.has(String(p.ObjectId)),
  );

  // Group unlinked projects by their parent EPS for optgroup separators.
  const epsLabel = (p: Project) =>
    p.ParentEPSId && p.ParentEPSName
      ? `${p.ParentEPSId} — ${p.ParentEPSName}`
      : "Other";
  const projectGroups = new Map<string, Project[]>();
  for (const project of unlinkedProjects) {
    const label = epsLabel(project);
    const group = projectGroups.get(label);
    if (group) group.push(project);
    else projectGroups.set(label, [project]);
  }

  const projectLabel = (objectId: string) => {
    const project = projects.find((p) => String(p.ObjectId) === objectId);
    return project ? `${project.Name} (${project.Id})` : `Project #${objectId}`;
  };

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await apiCall(
      "/api/project-org-links",
      jsonInit("POST", { projectObjectId: projectId, clerkOrgId: orgId }),
    );
    setBusy(false);
    if (res.ok) {
      const orgName = organizations.find((o) => o.id === orgId)?.name ?? orgId;
      setSuccess(`Linked ${projectLabel(projectId)} to ${orgName}.`);
      setProjectId("");
      setOrgId("");
      await loadLinks();
    } else {
      setError(res.error ?? "Failed to link project.");
    }
  }

  async function unlink(target: OrgLink) {
    if (
      !window.confirm(
        `Unlink ${projectLabel(target.projectObjectId)} from ${target.clerkOrgName}? Members of that organization will lose access.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await apiCall(
      `/api/project-org-links?projectObjectId=${encodeURIComponent(target.projectObjectId)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (res.ok) await loadLinks();
    else setError(res.error ?? "Failed to unlink project.");
  }

  return (
    <Panel title="Organization access">
      <p className="mb-3 text-sm text-muted-foreground">
        Link a project to the Clerk organization that owns it. Members of that
        organization will see the project on their dashboard. Each project can
        belong to only one organization.
      </p>

      <form onSubmit={link} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project *">
            <select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={inputClass}
              disabled={loading}
            >
              <option value="">Select a project…</option>
              {Array.from(projectGroups, ([label, group]) => (
                <optgroup key={label} label={label}>
                  {group.map((p) => (
                    <option key={p.ObjectId} value={p.ObjectId}>
                      {p.Name} ({p.Id})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Organization *">
            <select
              required
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className={inputClass}
              disabled={loading}
            >
              <option value="">Select an organization…</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                  {org.slug ? ` (${org.slug})` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && <FormMessage tone="error">{error}</FormMessage>}
        {success && <FormMessage tone="success">{success}</FormMessage>}

        <button
          type="submit"
          disabled={busy || !projectId || !orgId}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Linking…" : "Link organization"}
        </button>
        {!loading && organizations.length === 0 && (
          <p className="text-xs text-amber-600">
            No Clerk organizations found. Create one in the Clerk dashboard
            first.
          </p>
        )}
      </form>

      <div className="mt-5 border-t border-brand-border pt-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Current links
          {!loading && (
            <span className="ml-1.5 font-normal text-muted-foreground/70">
              ({links.length})
            </span>
          )}
        </h3>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No projects are linked to an organization yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => (
              <li
                key={l.projectObjectId}
                className="flex items-center justify-between gap-3 rounded-md border border-brand-border bg-white px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <span className="font-medium text-foreground">
                    {projectLabel(l.projectObjectId)}
                  </span>
                  <span className="text-muted-foreground/70"> → </span>
                  <span className="text-foreground">
                    {l.clerkOrgName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void unlink(l)}
                  disabled={busy}
                  className="shrink-0 text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
