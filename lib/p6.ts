function getP6Base(): string {
  return requireEnv("P6_BASE_URL");
}
function getP6Db(): string {
  return requireEnv("P6_DATABASE_NAME");
}
function getP6Authtoken(): string {
  return requireEnv("P6_AUTHTOKEN");
}

const OWNER_EMAIL_UDF_TITLE =
  process.env.P6_OWNER_EMAIL_UDF_TITLE ?? "Owner Email";

const SESSION_TTL_MS = 10 * 60 * 1000;

let sessionCookie: string | null = null;
let sessionExpiresAt = 0;
let loginInFlight: Promise<string> | null = null;
let ownerEmailUdfTypeId: number | null = null;
let ownerEmailUdfTypeLookup: Promise<number> | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function authHeaders(): Record<string, string> {
  return { authtoken: getP6Authtoken() };
}

function escapeP6FilterValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function login(): Promise<string> {
  const url = `${getP6Base()}/login?DatabaseName=${encodeURIComponent(getP6Db())}`;
  const res = await fetch(url, { method: "POST", headers: authHeaders() });
  if (!res.ok) {
    throw new P6Error(`P6 login failed (${res.status})`, res.status, await safeText(res));
  }
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new P6Error("P6 login returned no Set-Cookie header", 500);
  }
  const cookie = setCookie.split(";")[0];
  sessionCookie = cookie;
  sessionExpiresAt = Date.now() + SESSION_TTL_MS;
  return cookie;
}

async function getSession(): Promise<string> {
  if (sessionCookie && Date.now() < sessionExpiresAt) return sessionCookie;
  if (loginInFlight) return loginInFlight;
  loginInFlight = login().finally(() => {
    loginInFlight = null;
  });
  return loginInFlight;
}

async function p6Request(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const cookie = await getSession();
  const res = await fetch(`${getP6Base()}${path}`, {
    ...init,
    headers: { ...authHeaders(), cookie, ...(init.headers ?? {}) },
  });
  if (res.status === 401 && retry) {
    sessionCookie = null;
    sessionExpiresAt = 0;
    return p6Request(path, init, false);
  }
  return res;
}

async function p6Fetch(path: string, retry = true): Promise<Response> {
  return p6Request(path, { method: "GET" }, retry);
}

async function p6Read<T>(
  resource: string,
  fields: string,
  filter?: string,
): Promise<T[]> {
  const params = new URLSearchParams({
    DatabaseName: getP6Db(),
    Fields: fields,
  });
  if (filter) params.set("Filter", filter);
  const res = await p6Fetch(`/${resource}?${params.toString()}`);
  if (!res.ok) {
    throw new P6Error(
      `P6 read ${resource} failed (${res.status})`,
      res.status,
      await safeText(res),
    );
  }
  const data = (await res.json()) as T[] | null;
  return Array.isArray(data) ? data : [];
}

async function p6Write(
  method: "POST" | "PUT",
  resource: string,
  entities: Record<string, unknown>[],
): Promise<unknown> {
  const res = await p6Request(`/${resource}?DatabaseName=${encodeURIComponent(getP6Db())}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entities),
  });
  if (!res.ok) {
    throw new P6Error(
      `P6 ${method} ${resource} failed (${res.status})`,
      res.status,
      await safeText(res),
    );
  }
  const text = await safeText(res);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class P6Error extends Error {
  status: number;
  body?: string;
  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "P6Error";
    this.status = status;
    this.body = body;
  }
}

export interface P6User {
  ObjectId: number;
  EmailAddress?: string;
  Name?: string;
  Id?: string;
}

export interface P6Project {
  ObjectId: string;
  Id: string;
  Name: string;
  ParentEPSObjectId?: string;
  ParentEPSId?: string;
  ParentEPSName?: string;
}

export interface P6Eps {
  ObjectId: string;
  Id: string;
  Name: string;
  ParentObjectId?: string;
}

export interface P6Wbs {
  ObjectId: string;
  Name: string;
  Code?: string;
  ProjectObjectId: string;
  ParentObjectId?: string;
}

export interface P6Activity {
  ObjectId: number;
  Id?: string;
  Name: string;
  ProjectObjectId?: number;
  ProjectName?: string;
  OwnerIDArray?: number[];
  OwnerNamesArray?: string[];
  ActivityOwnerUserId?: number;
  PrimaryResourceId?: string;
  PrimaryResourceName?: string;
  PrimaryResourceObjectId?: number;
  Status?: string;
  PercentComplete?: number;
  PlannedLaborUnits?: number;
  PlannedLaborCost?: number;
  ActualLaborUnits?: number;
  ActualLaborCost?: number;
  PlannedNonLaborUnits?: number;
  ActualNonLaborUnits?: number;
  AtCompletionLaborUnits?: number;
  AtCompletionNonLaborUnits?: number;
  PlannedStartDate?: string;
  PlannedFinishDate?: string;
  ActualStartDate?: string;
  ActualFinishDate?: string;
  ExpectedFinishDate?: string;
  TotalFloat?: number;
  FreeFloat?: number;
}

export interface P6UdfType {
  ObjectId: number;
  Title?: string;
  SubjectArea?: string;
}

export interface P6UdfValue {
  ObjectId?: number;
  ForeignObjectId: number;
  Text?: string;
  UDFTypeObjectId?: number;
  UDFTypeTitle?: string;
  UDFTypeSubjectArea?: string;
}

export interface P6ActivityStep {
  ObjectId: number;
  ActivityObjectId: number;
  Name: string;
  IsCompleted?: boolean;
  PercentComplete?: number;
  SequenceNumber?: number;
}

export interface P6ActivityComment {
  ObjectId?: number;
  ActivityObjectId: number;
  CommentText: string;
  CreateDate?: string;
  CreateUser?: string;
  UserObjectId?: number;
}

export interface P6ResourceAssignment {
  ObjectId: number;
  ActivityObjectId: number;
  ResourceObjectId?: number;
  ResourceName?: string;
  ResourceType?: string;
  PlannedUnits?: number;
  ActualUnits?: number;
  AtCompletionUnits?: number;
  PlannedCost?: number;
  ActualCost?: number;
  RemainingUnits?: number;
}

export const ACTIVITY_FIELDS =
  "Id,Name,ObjectId,ProjectObjectId,ProjectName,Status,PercentComplete,PlannedLaborUnits,PlannedLaborCost,ActualLaborUnits,ActualLaborCost,PlannedNonLaborUnits,ActualNonLaborUnits,AtCompletionLaborUnits,AtCompletionNonLaborUnits,PlannedStartDate,PlannedFinishDate,ActualStartDate,ActualFinishDate,ExpectedFinishDate,TotalFloat,FreeFloat";

// This app only exposes the "Production" EPS branch under PM Pro Consulting.
// Everything else in P6 (Sand Box, Templates, Waiting For Review, …) is
// invisible to both the dashboard and the admin tools.
const PRODUCTION_EPS_ID = "PROD";

async function getAllEps(): Promise<P6Eps[]> {
  return p6Read<P6Eps>("eps", "Name,ObjectId,Id,ParentObjectId");
}

/** The Production EPS node and all of its descendants. */
export async function getEps(): Promise<P6Eps[]> {
  const all = await getAllEps();
  const root = all.find((node) => node.Id === PRODUCTION_EPS_ID);
  if (!root) {
    throw new P6Error(
      `Production EPS (Id "${PRODUCTION_EPS_ID}") not found in P6.`,
      500,
    );
  }
  const subtree: P6Eps[] = [];
  const queue = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    subtree.push(node);
    queue.push(...all.filter((n) => n.ParentObjectId === node.ObjectId));
  }
  return subtree;
}

export async function getProjects(): Promise<P6Project[]> {
  const productionEps = await getEps();
  // P6 filters accept SQL-style clauses; restrict to the Production branch.
  const epsIds = productionEps
    .map((node) => Number(node.ObjectId))
    .filter(Number.isInteger);
  return p6Read<P6Project>(
    "project",
    "Name,ObjectId,Id,ParentEPSObjectId,ParentEPSId,ParentEPSName",
    `ParentEPSObjectId IN (${epsIds.join(", ")})`,
  );
}

export async function getUsers(): Promise<P6User[]> {
  return p6Read<P6User>("user", "ObjectId,Name,EmailAddress");
}

export async function getProjectWbs(projectObjectId: string): Promise<P6Wbs[]> {
  return p6Read<P6Wbs>(
    "wbs",
    "Name,ObjectId,Code,ProjectObjectId,ParentObjectId",
    `ProjectObjectId:eq:'${projectObjectId}'`,
  );
}

export interface CreateProjectInput {
  Id: string;
  Name: string;
  ParentEPSObjectId: number;
  Description?: string;
}

export async function createProject(input: CreateProjectInput): Promise<unknown> {
  return p6Write("POST", "project", [{ ...input }]);
}

export interface CreateActivityInput {
  ProjectObjectId: number;
  WBSObjectId: number;
  Name: string;
  PlannedStartDate?: string;
  PlannedFinishDate?: string;
}

export async function createActivity(input: CreateActivityInput): Promise<unknown> {
  return p6Write("POST", "activity", [{ ...input }]);
}

export interface UpdateActivityInput {
  ObjectId: number;
  Name?: string;
  ActivityOwnerUserId?: number;
  PercentComplete?: number;
  PlannedLaborUnits?: number;
  PlannedLaborCost?: number;
  PlannedStartDate?: string;
  PlannedFinishDate?: string;
  ActualStartDate?: string;
  ActualFinishDate?: string;
  ExpectedFinishDate?: string;
}

export async function updateActivity(input: UpdateActivityInput): Promise<unknown> {
  return p6Write("PUT", "activity", [{ ...input }]);
}

export async function deleteActivity(objectId: number): Promise<unknown> {
  const params = new URLSearchParams({
    DatabaseName: getP6Db(),
    ObjectId: String(objectId),
  });
  const res = await p6Request(`/activity?${params.toString()}`, { method: "DELETE" });
  if (!res.ok) {
    throw new P6Error(
      `P6 delete activity failed (${res.status})`,
      res.status,
      await safeText(res),
    );
  }
  const text = await safeText(res);
  return text ? text.trim() : null;
}

export async function getProjectActivities(
  projectObjectId: string,
): Promise<P6Activity[]> {
  return p6Read<P6Activity>(
    "activity",
    ACTIVITY_FIELDS,
    `ProjectObjectId:eq:'${projectObjectId}'`,
  );
}

export async function getActivitiesByIds(ids: number[]): Promise<P6Activity[]> {
  if (ids.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += 50) {
    chunks.push(ids.slice(i, i + 50));
  }
  const results: P6Activity[] = [];
  for (const chunk of chunks) {
    const filter = chunk.map((id) => `ObjectId:eq:'${id}'`).join(":or:");
    const batch = await p6Read<P6Activity>("activity", ACTIVITY_FIELDS, filter);
    results.push(...batch);
  }
  return results;
}

export async function findUserByEmail(email: string): Promise<P6User | null> {
  const list = await p6Read<P6User>(
    "user",
    "ObjectId,EmailAddress,Name",
    `EmailAddress:eq:'${escapeP6FilterValue(email)}'`,
  );
  return list.length > 0 ? list[0] : null;
}

export async function findActivitiesForUser(userId: number): Promise<P6Activity[]> {
  return p6Read<P6Activity>(
    "activity",
    ACTIVITY_FIELDS,
    `ActivityOwnerUserId:eq:'${userId}'`,
  );
}

export async function getOwnerEmailUdfTypeObjectId(): Promise<number> {
  if (ownerEmailUdfTypeId) return ownerEmailUdfTypeId;
  if (ownerEmailUdfTypeLookup) return ownerEmailUdfTypeLookup;

  ownerEmailUdfTypeLookup = (async () => {
    const types = await p6Read<P6UdfType>(
      "udfType",
      "ObjectId,Title,SubjectArea",
      `Title:eq:'${escapeP6FilterValue(OWNER_EMAIL_UDF_TITLE)}'`,
    );
    if (types.length === 0) {
      const allActivityTypes = await p6Read<P6UdfType>(
        "udfType",
        "ObjectId,Title,SubjectArea",
        `SubjectArea:eq:'Activity'`,
      );
      const match = allActivityTypes.find(
        (t) =>
          t.Title?.toLowerCase() === OWNER_EMAIL_UDF_TITLE.toLowerCase() ||
          t.Title?.toLowerCase().includes("owner") &&
            t.Title?.toLowerCase().includes("email"),
      );
      if (!match) {
        throw new P6Error(
          `Owner Email UDF type not found (title: "${OWNER_EMAIL_UDF_TITLE}")`,
          404,
        );
      }
      ownerEmailUdfTypeId = match.ObjectId;
      return match.ObjectId;
    }
    ownerEmailUdfTypeId = types[0].ObjectId;
    return types[0].ObjectId;
  })();

  return ownerEmailUdfTypeLookup;
}

export async function findActivityIdsByOwnerEmail(
  email: string,
): Promise<number[]> {
  const udfTypeId = await getOwnerEmailUdfTypeObjectId();
  const values = await p6Read<P6UdfValue>(
    "udfValue",
    "ForeignObjectId,Text,UDFTypeObjectId",
    `UDFTypeObjectId:eq:'${udfTypeId}':and:Text:eq:'${escapeP6FilterValue(email.toLowerCase())}'`,
  );
  return values.map((v) => v.ForeignObjectId);
}

export async function getActivitySteps(
  activityObjectIds: number[],
): Promise<P6ActivityStep[]> {
  if (activityObjectIds.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < activityObjectIds.length; i += 25) {
    chunks.push(activityObjectIds.slice(i, i + 25));
  }
  const results: P6ActivityStep[] = [];
  for (const chunk of chunks) {
    const filter = chunk
      .map((id) => `ActivityObjectId:eq:'${id}'`)
      .join(":or:");
    const batch = await p6Read<P6ActivityStep>(
      "activityStep",
      "ObjectId,ActivityObjectId,Name,IsCompleted,PercentComplete,SequenceNumber",
      filter,
    );
    results.push(...batch);
  }
  return results.sort(
    (a, b) => (a.SequenceNumber ?? 0) - (b.SequenceNumber ?? 0),
  );
}

export async function getActivityComments(
  activityObjectIds: number[],
): Promise<P6ActivityComment[]> {
  if (activityObjectIds.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < activityObjectIds.length; i += 25) {
    chunks.push(activityObjectIds.slice(i, i + 25));
  }
  const results: P6ActivityComment[] = [];
  for (const chunk of chunks) {
    const filter = chunk
      .map((id) => `ActivityObjectId:eq:'${id}'`)
      .join(":or:");
    const batch = await p6Read<P6ActivityComment>(
      "activityComment",
      "ObjectId,ActivityObjectId,CommentText,CreateDate,CreateUser,UserObjectId",
      filter,
    );
    results.push(...batch);
  }
  return results.sort(
    (a, b) =>
      new Date(b.CreateDate ?? 0).getTime() -
      new Date(a.CreateDate ?? 0).getTime(),
  );
}

export async function getResourceAssignments(
  activityObjectIds: number[],
): Promise<P6ResourceAssignment[]> {
  if (activityObjectIds.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < activityObjectIds.length; i += 25) {
    chunks.push(activityObjectIds.slice(i, i + 25));
  }
  const results: P6ResourceAssignment[] = [];
  for (const chunk of chunks) {
    const filter = chunk
      .map((id) => `ActivityObjectId:eq:'${id}'`)
      .join(":or:");
    const batch = await p6Read<P6ResourceAssignment>(
      "resourceAssignment",
      "ObjectId,ActivityObjectId,ResourceObjectId,ResourceName,ResourceType,PlannedUnits,ActualUnits,AtCompletionUnits,PlannedCost,ActualCost,RemainingUnits",
      filter,
    );
    results.push(...batch);
  }
  return results;
}

export async function updateActivityStep(input: {
  ObjectId: number;
  IsCompleted: boolean;
}): Promise<unknown> {
  return p6Write("PUT", "activityStep", [input]);
}

export async function createActivityComment(input: {
  ActivityObjectId: number;
  CommentText: string;
  UserObjectId: number;
}): Promise<unknown> {
  return p6Write("POST", "activityComment", [input]);
}

export interface UpdateResourceAssignmentInput {
  ObjectId: number;
  ActualUnits?: number;
  AtCompletionUnits?: number;
  ActualCost?: number;
}

export async function updateResourceAssignment(
  input: UpdateResourceAssignmentInput,
): Promise<unknown> {
  return p6Write("PUT", "resourceAssignment", [{ ...input }]);
}

async function safeText(res: Response): Promise<string | undefined> {
  try {
    return await res.text();
  } catch {
    return undefined;
  }
}
