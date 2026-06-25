const P6_BASE = requireEnv("P6_BASE_URL");
const P6_DB = requireEnv("P6_DATABASE_NAME");
const P6_AUTHTOKEN = requireEnv("P6_AUTHTOKEN");

const SESSION_TTL_MS = 10 * 60 * 1000;

let sessionCookie: string | null = null;
let sessionExpiresAt = 0;
let loginInFlight: Promise<string> | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function authHeaders(): Record<string, string> {
  return {
    authtoken: P6_AUTHTOKEN,
  };
}

async function login(): Promise<string> {
  const url = `${P6_BASE}/login?DatabaseName=${encodeURIComponent(P6_DB)}`;
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
  const res = await fetch(`${P6_BASE}${path}`, {
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

// P6 write bodies are arrays of entities, and the API expects JSON.
async function p6Write(
  method: "POST" | "PUT",
  resource: string,
  entities: Record<string, unknown>[],
): Promise<unknown> {
  const res = await p6Request(`/${resource}?DatabaseName=${encodeURIComponent(P6_DB)}`, {
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
}

export interface P6Eps {
  ObjectId: string;
  Id: string;
  Name: string;
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
  Name: string;
  ProjectName?: string;
  OwnerIDArray?: number[];
  OwnerNamesArray?: string[];
  ActivityOwnerUserId?: number;
  PrimaryResourceId?: string;
  PrimaryResourceName?: string;
  PrimaryResourceObjectId?: number;
  Status?: string;
  PlannedLaborUnits?: number;
  PlannedLaborCost?: number;
  ActualLaborUnits?: number;
  ActualLaborCost?: number;
  PlannedStartDate?: string;
  PlannedFinishDate?: string;
}

export async function getProjects(): Promise<P6Project[]> {
  const params = new URLSearchParams({
    DatabaseName: P6_DB,
    Fields: "Name,ObjectId,Id",
    Filter: "",
  });
  const res = await p6Fetch(`/project?${params.toString()}`);
  if (!res.ok) {
    throw new P6Error(`P6 projects fetch failed (${res.status})`, res.status, await safeText(res));
  }
  const data = (await res.json()) as P6Project[] | null;
  return Array.isArray(data) ? data : [];
}

export async function getEps(): Promise<P6Eps[]> {
  const params = new URLSearchParams({
    DatabaseName: P6_DB,
    Fields: "Name,ObjectId,Id",
  });
  const res = await p6Fetch(`/eps?${params.toString()}`);
  if (!res.ok) {
    throw new P6Error(`P6 EPS fetch failed (${res.status})`, res.status, await safeText(res));
  }
  const data = (await res.json()) as P6Eps[] | null;
  return Array.isArray(data) ? data : [];
}

export async function getUsers(): Promise<P6User[]> {
  const params = new URLSearchParams({
    DatabaseName: P6_DB,
    Fields: "ObjectId,Name,EmailAddress",
  });
  const res = await p6Fetch(`/user?${params.toString()}`);
  if (!res.ok) {
    throw new P6Error(`P6 users fetch failed (${res.status})`, res.status, await safeText(res));
  }
  const data = (await res.json()) as P6User[] | null;
  return Array.isArray(data) ? data : [];
}

export async function getProjectWbs(projectObjectId: string): Promise<P6Wbs[]> {
  const params = new URLSearchParams({
    DatabaseName: P6_DB,
    Fields: "Name,ObjectId,Code,ProjectObjectId,ParentObjectId",
    Filter: `ProjectObjectId:eq:'${projectObjectId}'`,
  });
  const res = await p6Fetch(`/wbs?${params.toString()}`);
  if (!res.ok) {
    throw new P6Error(`P6 WBS fetch failed (${res.status})`, res.status, await safeText(res));
  }
  const data = (await res.json()) as P6Wbs[] | null;
  return Array.isArray(data) ? data : [];
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

// Only the fields the admin UI exposes; ObjectId identifies the target activity.
export interface UpdateActivityInput {
  ObjectId: number;
  Name?: string;
  ActivityOwnerUserId?: number;
  PlannedLaborUnits?: number;
  PlannedLaborCost?: number;
  PlannedStartDate?: string;
  PlannedFinishDate?: string;
}

export async function updateActivity(input: UpdateActivityInput): Promise<unknown> {
  return p6Write("PUT", "activity", [{ ...input }]);
}

export async function deleteActivity(objectId: number): Promise<unknown> {
  const params = new URLSearchParams({
    DatabaseName: P6_DB,
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
  const params = new URLSearchParams({
    DatabaseName: P6_DB,
    Fields:
      "ProjectName,Name,ObjectId,OwnerIDArray,OwnerNamesArray,ActivityOwnerUserId,PrimaryResourceId,PrimaryResourceName,PrimaryResourceObjectId,Status,PlannedLaborUnits,PlannedLaborCost,ActualLaborUnits,ActualLaborCost,PlannedStartDate,PlannedFinishDate",
    Filter: `ProjectObjectId:eq:'${projectObjectId}'`,
  });
  const res = await p6Fetch(`/activity?${params.toString()}`);
  if (!res.ok) {
    throw new P6Error(
      `P6 activities fetch failed (${res.status})`,
      res.status,
      await safeText(res),
    );
  }
  const data = (await res.json()) as P6Activity[] | null;
  return Array.isArray(data) ? data : [];
}

export async function findUserByEmail(email: string): Promise<P6User | null> {
  const params = new URLSearchParams({
    DatabaseName: P6_DB,
    Fields: "ObjectId,EmailAddress,Name",
    Filter: `EmailAddress:eq:'${email}'`,
  });
  const res = await p6Fetch(`/user?${params.toString()}`);
  if (!res.ok) {
    throw new P6Error(`P6 user lookup failed (${res.status})`, res.status, await safeText(res));
  }
  const data = (await res.json()) as P6User[] | P6User | null;
  if (!data) return null;
  const list = Array.isArray(data) ? data : [data];
  return list.length > 0 ? list[0] : null;
}

export async function findActivitiesForUser(userId: number): Promise<P6Activity[]> {
  const params = new URLSearchParams({
    DatabaseName: P6_DB,
    Fields:
      "ProjectName,Name,ObjectId,OwnerIDArray,OwnerNamesArray,ActivityOwnerUserId,PrimaryResourceId,PrimaryResourceName,PrimaryResourceObjectId",
    Filter: `ActivityOwnerUserId:eq:'${userId}'`,
  });
  const res = await p6Fetch(`/activity?${params.toString()}`);
  if (!res.ok) {
    throw new P6Error(`P6 activities fetch failed (${res.status})`, res.status, await safeText(res));
  }
  const data = (await res.json()) as P6Activity[] | null;
  return Array.isArray(data) ? data : [];
}

async function safeText(res: Response): Promise<string | undefined> {
  try {
    return await res.text();
  } catch {
    return undefined;
  }
}
