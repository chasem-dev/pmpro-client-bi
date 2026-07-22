import { clerkClient } from "@clerk/nextjs/server";
import type { AppUser } from "@/lib/auth";
import { filterProjectsInProd } from "@/lib/eps";
import { canView, type FieldKey, type FieldPolicyRule } from "@/lib/fields";
import { getAllowedCompanyEpsIds, loadFieldPoliciesForUser } from "@/lib/policy";
import {
  getLinkForProject,
  getProjectObjectIdsForOrg,
} from "@/lib/project-org-links";
import {
  findActivityIdsByOwnerEmail,
  getActivitiesByIds,
  getActivityComments,
  getActivitySteps,
  getEps,
  getOwnerEmailsForActivities,
  getProjectActivities,
  getProjects,
  getRelationships,
  getResourceAssignments,
  type P6Activity,
  type P6ActivityComment,
  type P6ActivityStep,
  type P6Relationship,
  type P6ResourceAssignment,
} from "@/lib/p6";

export interface MyActivityResource {
  objectId: number;
  resourceName?: string;
  resourceType?: string;
  plannedUnits?: number;
  actualUnits?: number;
  atCompletionUnits?: number;
  plannedCost?: number;
  actualCost?: number;
}

export interface MyActivityRelationship {
  /** Relationship ObjectId in P6. */
  objectId: number;
  /** ObjectId of the activity on the other side of the relationship. */
  activityObjectId: number;
  activityId?: string;
  activityName?: string;
  /** e.g. "Finish to Start". */
  type?: string;
  lag?: number;
}

export interface MyActivityView {
  objectId: number;
  id?: string;
  name: string;
  projectObjectId?: number;
  projectName?: string;
  percentComplete?: number;
  plannedStart?: string;
  plannedFinish?: string;
  totalFloat?: number;
  freeFloat?: number;
  actualStart?: string;
  actualFinish?: string;
  expectedFinish?: string;
  status?: string;
  /** Value of the "Owner Email" activity UDF. */
  ownerEmail?: string;
  /** Overdue: past its planned dates without being completed/started. */
  isLate: boolean;
  steps: P6ActivityStep[];
  comments: P6ActivityComment[];
  laborResources: MyActivityResource[];
  nonLaborResources: MyActivityResource[];
  materialResources: MyActivityResource[];
  predecessors: MyActivityRelationship[];
  successors: MyActivityRelationship[];
}

export interface AssignableMember {
  name: string;
  email: string;
}

export interface MyActivitiesResult {
  activities: MyActivityView[];
  policies: Record<string, { visible: boolean; editable: boolean }>;
  /** Whether this user may reassign the Owner Email on listed activities. */
  canAssignOwner: boolean;
  /** Org members offered as owner choices (empty = free-form email entry). */
  assignableMembers: AssignableMember[];
}

function policiesToRecord(
  policies: Map<FieldKey, FieldPolicyRule>,
): MyActivitiesResult["policies"] {
  const out: MyActivitiesResult["policies"] = {};
  for (const [k, v] of policies) {
    out[k] = { visible: v.visible, editable: v.editable };
  }
  return out;
}

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inTimeWindow(
  activity: P6Activity,
  days?: number,
  from?: string,
  to?: string,
): boolean {
  const start = parseDate(activity.PlannedStartDate);
  const finish = parseDate(activity.PlannedFinishDate);
  if (!start && !finish) return true;

  let windowStart: Date;
  let windowEnd: Date;

  if (from || to) {
    windowStart = from ? new Date(from) : new Date(0);
    windowEnd = to ? new Date(to) : new Date(8640000000000000);
  } else if (days != null && days > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - days);
    windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + days);
  } else {
    return true;
  }

  const actStart = start ?? finish!;
  const actEnd = finish ?? start!;
  return actStart <= windowEnd && actEnd >= windowStart;
}

/**
 * An activity is "late" when it should have started or finished by now but
 * hasn't: planned finish is in the past without completion, or planned start
 * is in the past and the activity was never started.
 */
function isLateActivity(activity: P6Activity, now = new Date()): boolean {
  const status = activity.Status ?? "";
  if (status === "Completed") return false;
  const finish = parseDate(activity.PlannedFinishDate);
  if (finish && finish < now) return true;
  const start = parseDate(activity.PlannedStartDate);
  if (start && start < now && status === "Not Started") return true;
  return false;
}

/** Every Clerk organization the user belongs to, preferring the active one. */
async function getOrgIdsForUser(user: AppUser): Promise<string[]> {
  if (user.orgId) return [user.orgId];
  const clerk = await clerkClient();
  const memberships = await clerk.users.getOrganizationMembershipList({
    userId: user.userId,
    limit: 100,
  });
  return memberships.data.map((m) => m.organization.id);
}

async function getOrgMembers(orgId: string): Promise<AssignableMember[]> {
  const clerk = await clerkClient();
  const { data } = await clerk.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    limit: 200,
  });
  return data
    .map((m) => ({
      name: [m.publicUserData?.firstName, m.publicUserData?.lastName]
        .filter(Boolean)
        .join(" "),
      email: m.publicUserData?.identifier ?? "",
    }))
    .filter((m) => m.email);
}

function mapResource(ra: P6ResourceAssignment): MyActivityResource {
  return {
    objectId: ra.ObjectId,
    resourceName: ra.ResourceName,
    resourceType: ra.ResourceType,
    plannedUnits: ra.PlannedUnits,
    actualUnits: ra.ActualUnits,
    atCompletionUnits: ra.AtCompletionUnits,
    plannedCost: ra.PlannedCost,
    actualCost: ra.ActualCost,
  };
}

function applyPolicyVisibility(
  view: MyActivityView,
  policies: Map<FieldKey, FieldPolicyRule>,
): MyActivityView {
  const out = { ...view };
  if (!canView(policies, "activityId")) out.id = undefined;
  if (!canView(policies, "activityName")) out.name = "";
  if (!canView(policies, "percentComplete")) out.percentComplete = undefined;
  if (!canView(policies, "plannedStart")) out.plannedStart = undefined;
  if (!canView(policies, "plannedFinish")) out.plannedFinish = undefined;
  if (!canView(policies, "totalFloat")) out.totalFloat = undefined;
  if (!canView(policies, "freeFloat")) out.freeFloat = undefined;
  if (!canView(policies, "actualStart")) out.actualStart = undefined;
  if (!canView(policies, "actualFinish")) out.actualFinish = undefined;
  if (!canView(policies, "expectedFinish")) out.expectedFinish = undefined;
  if (!canView(policies, "activityStep")) out.steps = [];
  if (!canView(policies, "activityComment")) out.comments = [];
  if (!canView(policies, "resourceName")) {
    out.laborResources = out.laborResources.map((r) => ({
      ...r,
      resourceName: undefined,
    }));
    out.nonLaborResources = out.nonLaborResources.map((r) => ({
      ...r,
      resourceName: undefined,
    }));
  }
  if (!canView(policies, "materialName")) {
    out.materialResources = out.materialResources.map((r) => ({
      ...r,
      resourceName: undefined,
    }));
  }
  return out;
}

export async function fetchMyActivities(
  user: AppUser,
  opts?: {
    days?: number;
    from?: string;
    to?: string;
    /** Global admins only: view every activity of one project. */
    projectObjectId?: string;
  },
): Promise<MyActivitiesResult> {
  const [policies, allowedCompanies, epsList, projects] = await Promise.all([
    loadFieldPoliciesForUser(user),
    getAllowedCompanyEpsIds(user),
    getEps(),
    getProjects(),
  ]);

  const prodProjects = filterProjectsInProd(projects, epsList);
  const projectById = new Map(prodProjects.map((p) => [p.ObjectId, p]));

  const companyAllowedProjectIds = new Set(
    prodProjects
      .filter((p) => {
        if (!allowedCompanies) return true;
        const companyId = p.companyEps?.ObjectId;
        return companyId ? allowedCompanies.has(companyId) : false;
      })
      .map((p) => p.ObjectId),
  );

  const adminProjectView = !!(user.isGlobalAdmin && opts?.projectObjectId);

  // Owner reassignment: global admins anywhere, org admins in their own
  // projects (which is all this view ever shows them). The member list drives
  // the owner picker on the activity cards.
  const canAssignOwner = user.isGlobalAdmin || user.isProjectAdmin;
  let assignableMembers: AssignableMember[] = [];
  if (canAssignOwner) {
    let memberOrgId: string | null = null;
    if (adminProjectView) {
      const link = await getLinkForProject(opts!.projectObjectId!);
      memberOrgId = link?.clerkOrgId ?? null;
    } else if (user.isProjectAdmin && user.orgId) {
      memberOrgId = user.orgId;
    }
    if (memberOrgId) assignableMembers = await getOrgMembers(memberOrgId);
  }

  // Activity selection:
  // - Global admins viewing a specific project see all of its activities.
  // - Project admins (org:admin) see every activity in the projects linked to
  //   their organization.
  // - Everyone else sees only activities assigned to them via the Owner Email
  //   UDF, and only within projects linked to one of their organizations.
  let activities: P6Activity[];
  let allowedProjectIds: Set<string>;
  if (adminProjectView) {
    allowedProjectIds = new Set([opts!.projectObjectId!]);
    activities = await getProjectActivities(opts!.projectObjectId!);
  } else if (user.isProjectAdmin && user.orgId) {
    const orgProjectIds = await getProjectObjectIdsForOrg(user.orgId);
    const adminProjectIds = orgProjectIds.filter((id) =>
      companyAllowedProjectIds.has(id),
    );
    allowedProjectIds = new Set(adminProjectIds);
    const perProject = await Promise.all(
      adminProjectIds.map((id) => getProjectActivities(id)),
    );
    activities = perProject.flat();
  } else {
    // Owner Email matches only count inside projects linked to the user's
    // organization(s); activities elsewhere in P6 are ignored.
    const orgIds = await getOrgIdsForUser(user);
    const linkedIdLists = await Promise.all(
      orgIds.map((id) => getProjectObjectIdsForOrg(id)),
    );
    allowedProjectIds = new Set(
      linkedIdLists.flat().filter((id) => companyAllowedProjectIds.has(id)),
    );

    const activityIds =
      allowedProjectIds.size > 0
        ? await findActivityIdsByOwnerEmail(user.email)
        : [];
    if (activityIds.length === 0) {
      return {
        activities: [],
        policies: policiesToRecord(policies),
        canAssignOwner,
        assignableMembers,
      };
    }
    activities = await getActivitiesByIds(activityIds);
  }

  // Late activities are always shown, even outside the selected time window,
  // so overdue work can't silently drop off the list.
  const filtered = activities.filter((a) => {
    const projectId = a.ProjectObjectId ? String(a.ProjectObjectId) : null;
    if (!projectId || !allowedProjectIds.has(projectId)) return false;
    return (
      inTimeWindow(a, opts?.days, opts?.from, opts?.to) || isLateActivity(a)
    );
  });

  const ids = filtered.map((a) => a.ObjectId);
  const [steps, comments, assignments, relationships, ownerEmails] =
    await Promise.all([
      getActivitySteps(ids),
      getActivityComments(ids),
      getResourceAssignments(ids),
      getRelationships(ids),
      getOwnerEmailsForActivities(ids),
    ]);

  const stepsByActivity = new Map<number, P6ActivityStep[]>();
  for (const step of steps) {
    const list = stepsByActivity.get(step.ActivityObjectId) ?? [];
    list.push(step);
    stepsByActivity.set(step.ActivityObjectId, list);
  }

  const commentsByActivity = new Map<number, P6ActivityComment[]>();
  for (const comment of comments) {
    const list = commentsByActivity.get(comment.ActivityObjectId) ?? [];
    list.push(comment);
    commentsByActivity.set(comment.ActivityObjectId, list);
  }

  const assignmentsByActivity = new Map<number, P6ResourceAssignment[]>();
  for (const ra of assignments) {
    const list = assignmentsByActivity.get(ra.ActivityObjectId) ?? [];
    list.push(ra);
    assignmentsByActivity.set(ra.ActivityObjectId, list);
  }

  const predecessorsByActivity = new Map<number, P6Relationship[]>();
  const successorsByActivity = new Map<number, P6Relationship[]>();
  for (const rel of relationships) {
    // A relationship is a predecessor of its successor activity, and vice versa.
    const preds = predecessorsByActivity.get(rel.SuccessorActivityObjectId) ?? [];
    preds.push(rel);
    predecessorsByActivity.set(rel.SuccessorActivityObjectId, preds);
    const succs = successorsByActivity.get(rel.PredecessorActivityObjectId) ?? [];
    succs.push(rel);
    successorsByActivity.set(rel.PredecessorActivityObjectId, succs);
  }

  const views: MyActivityView[] = filtered.map((a) => {
    const projectId = a.ProjectObjectId ? String(a.ProjectObjectId) : undefined;
    const project = projectId ? projectById.get(projectId) : undefined;
    const ras = assignmentsByActivity.get(a.ObjectId) ?? [];
    const labor = ras.filter(
      (r) => (r.ResourceType ?? "").toLowerCase() === "labor",
    );
    const nonLabor = ras.filter(
      (r) => (r.ResourceType ?? "").toLowerCase() === "nonlabor",
    );
    const material = ras.filter(
      (r) => (r.ResourceType ?? "").toLowerCase() === "material",
    );

    const view: MyActivityView = {
      objectId: a.ObjectId,
      id: a.Id,
      name: a.Name,
      projectObjectId: a.ProjectObjectId,
      projectName: project?.Name ?? a.ProjectName,
      percentComplete: a.PercentComplete,
      plannedStart: a.PlannedStartDate,
      plannedFinish: a.PlannedFinishDate,
      totalFloat: a.TotalFloat,
      freeFloat: a.FreeFloat,
      actualStart: a.ActualStartDate,
      actualFinish: a.ActualFinishDate,
      expectedFinish: a.ExpectedFinishDate,
      status: a.Status,
      ownerEmail: ownerEmails.get(a.ObjectId),
      isLate: isLateActivity(a),
      steps: stepsByActivity.get(a.ObjectId) ?? [],
      comments: commentsByActivity.get(a.ObjectId) ?? [],
      laborResources: labor.map(mapResource),
      nonLaborResources: nonLabor.map(mapResource),
      materialResources: material.map(mapResource),
      predecessors: (predecessorsByActivity.get(a.ObjectId) ?? []).map(
        (rel) => ({
          objectId: rel.ObjectId,
          activityObjectId: rel.PredecessorActivityObjectId,
          activityId: rel.PredecessorActivityId,
          activityName: rel.PredecessorActivityName,
          type: rel.Type,
          lag: rel.Lag,
        }),
      ),
      successors: (successorsByActivity.get(a.ObjectId) ?? []).map((rel) => ({
        objectId: rel.ObjectId,
        activityObjectId: rel.SuccessorActivityObjectId,
        activityId: rel.SuccessorActivityId,
        activityName: rel.SuccessorActivityName,
        type: rel.Type,
        lag: rel.Lag,
      })),
    };
    return applyPolicyVisibility(view, policies);
  });

  views.sort((a, b) => {
    const proj = (a.projectName ?? "").localeCompare(b.projectName ?? "");
    if (proj !== 0) return proj;
    const startA = a.plannedStart ?? "";
    const startB = b.plannedStart ?? "";
    const startCmp = startA.localeCompare(startB);
    if (startCmp !== 0) return startCmp;
    return (a.plannedFinish ?? "").localeCompare(b.plannedFinish ?? "");
  });

  return {
    activities: views,
    policies: policiesToRecord(policies),
    canAssignOwner,
    assignableMembers,
  };
}
