// Metabase REST API client (data retrieval only).
//
// Auth: static API key sent via the `X-API-Key` header
// (https://www.metabase.com/docs/latest/api).
//
// Queries run through the ad-hoc endpoint `POST /api/dataset` as "native"
// (raw SQL) queries. SQL may use Metabase template-tag syntax:
//   - `{{project}}`                      required variable
//   - `[[AND proj.name = {{project}}]]`  optional clause, dropped when the
//     variable has no value
// Template tags are extracted from the SQL automatically; pass values via
// the `params` argument of runNativeQuery().
//
// NOTE: /api/dataset caps results at 2,000 rows. If we ever need more, switch
// to the export endpoint (`POST /api/dataset/json`) which returns full results.

function getMetabaseBase(): string {
  // e.g. https://pmproconsulting.metabaseapp.com (no trailing slash, no /api)
  return requireEnv("METABASE_BASE_URL").replace(/\/+$/, "");
}
function getMetabaseApiKey(): string {
  return requireEnv("METABASE_API_KEY");
}
/** Numeric id of the target database connection inside Metabase (see getDatabases()). */
function getMetabaseDatabaseId(): number {
  const id = Number(requireEnv("METABASE_DATABASE_ID"));
  if (!Number.isInteger(id)) {
    throw new Error("METABASE_DATABASE_ID must be an integer");
  }
  return id;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export class MetabaseError extends Error {
  status: number;
  body?: string;
  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "MetabaseError";
    this.status = status;
    this.body = body;
  }
}

async function metabaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${getMetabaseBase()}${path}`, {
    ...init,
    headers: {
      "X-API-Key": getMetabaseApiKey(),
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export type MetabaseParamValue = string | number | boolean | null | undefined;

interface TemplateTag {
  id: string;
  name: string;
  "display-name": string;
  type: "text" | "number";
}

interface DatasetParameter {
  type: string;
  target: ["variable", ["template-tag", string]];
  value: string | number | boolean;
}

export interface MetabaseColumn {
  name: string;
  display_name: string;
  base_type: string;
}

export interface MetabaseQueryResult {
  columns: MetabaseColumn[];
  rows: unknown[][];
  rowCount: number;
}

interface DatasetResponse {
  status?: string;
  error?: string;
  row_count?: number;
  data?: {
    rows?: unknown[][];
    cols?: MetabaseColumn[];
  };
}

// Matches {{variable}} references, but not snippets ({{snippet: ...}}) or
// card/model references ({{#123-some-model}}).
const TEMPLATE_TAG_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

function extractTemplateTags(sql: string): string[] {
  const names = new Set<string>();
  for (const match of sql.matchAll(TEMPLATE_TAG_RE)) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * Runs a native SQL query against the configured Metabase database.
 *
 * Every `{{name}}` in the SQL is declared as a template tag. Values supplied
 * in `params` are bound to their tag; tags without a value are left unset,
 * which drops the surrounding `[[...]]` optional clause (a required tag with
 * no value makes Metabase reject the query).
 */
export async function runNativeQuery(
  sql: string,
  params: Record<string, MetabaseParamValue> = {},
): Promise<MetabaseQueryResult> {
  const tagNames = extractTemplateTags(sql);
  const templateTags: Record<string, TemplateTag> = {};
  const parameters: DatasetParameter[] = [];

  for (const name of tagNames) {
    const value = params[name];
    const isNumber = typeof value === "number";
    templateTags[name] = {
      id: crypto.randomUUID(),
      name,
      "display-name": name,
      type: isNumber ? "number" : "text",
    };
    if (value !== undefined && value !== null) {
      parameters.push({
        // "category" is what the Metabase SQL editor sends for text/boolean
        // variables; number variables use "number/=".
        type: isNumber ? "number/=" : "category",
        target: ["variable", ["template-tag", name]],
        value,
      });
    }
  }

  const res = await metabaseRequest("/api/dataset", {
    method: "POST",
    body: JSON.stringify({
      database: getMetabaseDatabaseId(),
      type: "native",
      native: { query: sql, "template-tags": templateTags },
      parameters,
    }),
  });

  const text = await safeText(res);
  if (!res.ok && res.status !== 202) {
    throw new MetabaseError(`Metabase query failed (${res.status})`, res.status, text);
  }

  let body: DatasetResponse;
  try {
    body = JSON.parse(text ?? "") as DatasetResponse;
  } catch {
    throw new MetabaseError("Metabase returned a non-JSON response", res.status, text);
  }

  // /api/dataset returns 202 for failures too; the real outcome is body.status.
  if (body.status !== "completed") {
    throw new MetabaseError(
      `Metabase query failed: ${body.error ?? `status "${body.status}"`}`,
      res.status,
      text,
    );
  }

  return {
    columns: body.data?.cols ?? [],
    rows: body.data?.rows ?? [],
    rowCount: body.row_count ?? body.data?.rows?.length ?? 0,
  };
}

/** Rows as objects keyed by column name, e.g. { "Project": "X", "% Complete": 42.1 }. */
export function rowsToObjects(
  result: MetabaseQueryResult,
): Record<string, unknown>[] {
  const names = result.columns.map((c) => c.name);
  return result.rows.map((row) =>
    Object.fromEntries(names.map((name, i) => [name, row[i]])),
  );
}

export interface MetabaseDatabase {
  id: number;
  name: string;
  engine: string;
}

/** Databases visible to the API key — use once to find METABASE_DATABASE_ID. */
export async function getDatabases(): Promise<MetabaseDatabase[]> {
  const res = await metabaseRequest("/api/database");
  if (!res.ok) {
    throw new MetabaseError(
      `Metabase list databases failed (${res.status})`,
      res.status,
      await safeText(res),
    );
  }
  const body = (await res.json()) as { data?: MetabaseDatabase[] } | MetabaseDatabase[];
  const list = Array.isArray(body) ? body : (body.data ?? []);
  return list.map(({ id, name, engine }) => ({ id, name, engine }));
}

async function safeText(res: Response): Promise<string | undefined> {
  try {
    return await res.text();
  } catch {
    return undefined;
  }
}
