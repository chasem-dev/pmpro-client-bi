import type { AppUser } from "@/lib/auth";
import { filterProjectsInProd } from "@/lib/eps";
import { canView, type FieldKey, type FieldPolicyRule } from "@/lib/fields";
import { getAllowedCompanyEpsIds, loadFieldPoliciesForUser } from "@/lib/policy";
import {
  findActivityIdsByOwnerEmail,
  getActivitiesByIds,
  getActivityComments,
  getActivitySteps,
  getEps,
  getProjects,
  getResourceAssignments,
  type P6Activity,
  type P6ActivityComment,
  type P6ActivityStep,
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
  steps: P6ActivityStep[];
  comments: P6ActivityComment[];
  laborResources: MyActivityResource[];
  nonLaborResources: MyActivityResource[];
  materialResources: MyActivityResource[];
}

export interface MyActivitiesResult {
  activities: MyActivityView[];
  policies: Record<string, { visible: boolean; editable: boolean }>;
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
  opts?: { days?: number; from?: string; to?: string },
): Promise<MyActivitiesResult> {
  const [policies, allowedCompanies, epsList, projects, activityIds] =
    await Promise.all([
      loadFieldPoliciesForUser(user),
      getAllowedCompanyEpsIds(user),
      getEps(),
      getProjects(),
      findActivityIdsByOwnerEmail(user.email),
    ]);

  if (activityIds.length === 0) {
    return {
      activities: [],
      policies: policiesToRecord(policies),
    };
  }

  const prodProjects = filterProjectsInProd(projects, epsList);
  const projectById = new Map(prodProjects.map((p) => [p.ObjectId, p]));

  const allowedProjectIds = new Set(
    prodProjects
      .filter((p) => {
        if (!allowedCompanies) return true;
        const companyId = p.companyEps?.ObjectId;
        return companyId ? allowedCompanies.has(companyId) : false;
      })
      .map((p) => p.ObjectId),
  );

  const activities = await getActivitiesByIds(activityIds);
  const filtered = activities.filter((a) => {
    const projectId = a.ProjectObjectId ? String(a.ProjectObjectId) : null;
    if (!projectId || !allowedProjectIds.has(projectId)) return false;
    return inTimeWindow(a, opts?.days, opts?.from, opts?.to);
  });

  const ids = filtered.map((a) => a.ObjectId);
  const [steps, comments, assignments] = await Promise.all([
    getActivitySteps(ids),
    getActivityComments(ids),
    getResourceAssignments(ids),
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
      steps: stepsByActivity.get(a.ObjectId) ?? [],
      comments: commentsByActivity.get(a.ObjectId) ?? [],
      laborResources: labor.map(mapResource),
      nonLaborResources: nonLabor.map(mapResource),
      materialResources: material.map(mapResource),
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
  };
}
