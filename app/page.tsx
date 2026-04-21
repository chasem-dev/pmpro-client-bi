"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Activity = {
  ObjectId: number;
  Name: string;
  ProjectName?: string;
  OwnerNamesArray?: string[];
  PrimaryResourceName?: string;
};

type ActivitiesResponse = {
  user: { ObjectId: number; Name?: string; EmailAddress?: string; Id?: string };
  activities: Activity[];
};

type ProbeSignal = {
  source: string;
  detail: string;
  value?: string;
  token?: string;
};

type PostMessageLog = {
  time: string;
  origin: string;
  dataPreview: string;
  extractedToken?: string;
};

type DirectProbe = {
  attempt: "no-token" | "with-token";
  status?: number;
  ok?: boolean;
  body?: unknown;
  error?: string;
  finishedAt: string;
};

const CLEARSQUARE_SELF_URL =
  "https://dashboard.pmpro.consulting/api/portal/users/self/details";

const TOKEN_KEY_PATTERNS = [
  /token/i,
  /access[_-]?token/i,
  /jwt/i,
  /auth/i,
  /bearer/i,
];

function looksLikeJwt(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  );
}

function extractTokenFromAny(input: unknown, depth = 0): string | undefined {
  if (depth > 4 || input == null) return undefined;
  if (looksLikeJwt(input)) return input as string;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return extractTokenFromAny(parsed, depth + 1);
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = extractTokenFromAny(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof input === "object") {
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (TOKEN_KEY_PATTERNS.some((re) => re.test(key)) && looksLikeJwt(val)) {
        return val as string;
      }
    }
    for (const val of Object.values(input as Record<string, unknown>)) {
      const found = extractTokenFromAny(val, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

function safePreview(value: unknown, max = 240): string {
  let s: string;
  try {
    s = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function truncateToken(t: string): string {
  if (t.length <= 40) return t;
  return `${t.slice(0, 20)}…${t.slice(-12)}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function Home() {
  const [signals, setSignals] = useState<ProbeSignal[]>([]);
  const [messages, setMessages] = useState<PostMessageLog[]>([]);
  const [detectedToken, setDetectedToken] = useState<string | null>(null);
  const [tokenSource, setTokenSource] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");

  const [clearsquareUser, setClearsquareUser] = useState<unknown>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [activities, setActivities] = useState<ActivitiesResponse | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  const attemptedAutoResolve = useRef(false);
  const attemptedAutoActivities = useRef(false);

  const [directProbes, setDirectProbes] = useState<DirectProbe[]>([]);
  const directProbeNoToken = useRef(false);
  const directProbeWithToken = useRef(false);

  // Initial synchronous probes
  useEffect(() => {
    const found: ProbeSignal[] = [];

    const tryPush = (source: string, detail: string, value?: string) => {
      let token: string | undefined;
      if (value) {
        token = looksLikeJwt(value) ? value : extractTokenFromAny(value);
      }
      found.push({ source, detail, value, token });
    };

    try {
      tryPush("location.href", "current URL", window.location.href);
    } catch (e) {
      tryPush("location.href", `error: ${(e as Error).message}`);
    }

    try {
      const qs = new URLSearchParams(window.location.search);
      if ([...qs.keys()].length === 0) {
        tryPush("location.search", "(empty)");
      } else {
        qs.forEach((v, k) => tryPush(`location.search[${k}]`, "query param", v));
      }
    } catch (e) {
      tryPush("location.search", `error: ${(e as Error).message}`);
    }

    try {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) {
        tryPush("location.hash", "(empty)");
      } else {
        const hp = new URLSearchParams(hash);
        if ([...hp.keys()].length === 0) {
          tryPush("location.hash", "raw hash", hash);
        } else {
          hp.forEach((v, k) => tryPush(`location.hash[${k}]`, "hash param", v));
        }
      }
    } catch (e) {
      tryPush("location.hash", `error: ${(e as Error).message}`);
    }

    try {
      tryPush(
        "document.referrer",
        "referrer",
        document.referrer || "(empty)",
      );
    } catch (e) {
      tryPush("document.referrer", `error: ${(e as Error).message}`);
    }

    try {
      const cookie = document.cookie || "(empty)";
      tryPush("document.cookie", "cookies visible to this doc", cookie);
    } catch (e) {
      tryPush("document.cookie", `error: ${(e as Error).message}`);
    }

    try {
      const keys = Object.keys(window.localStorage);
      if (keys.length === 0) {
        tryPush("localStorage", "(empty)");
      } else {
        keys.forEach((k) =>
          tryPush(
            `localStorage[${k}]`,
            "stored value",
            window.localStorage.getItem(k) ?? "",
          ),
        );
      }
    } catch (e) {
      tryPush("localStorage", `error: ${(e as Error).message}`);
    }

    try {
      const keys = Object.keys(window.sessionStorage);
      if (keys.length === 0) {
        tryPush("sessionStorage", "(empty)");
      } else {
        keys.forEach((k) =>
          tryPush(
            `sessionStorage[${k}]`,
            "stored value",
            window.sessionStorage.getItem(k) ?? "",
          ),
        );
      }
    } catch (e) {
      tryPush("sessionStorage", `error: ${(e as Error).message}`);
    }

    try {
      tryPush("window.name", "window.name", window.name || "(empty)");
    } catch (e) {
      tryPush("window.name", `error: ${(e as Error).message}`);
    }

    try {
      if (window.parent && window.parent !== window) {
        try {
          tryPush(
            "parent.location.href",
            "parent URL (same-origin only)",
            window.parent.location.href,
          );
        } catch (e) {
          tryPush(
            "parent.location.href",
            `cross-origin blocked: ${(e as Error).message}`,
          );
        }
      } else {
        tryPush("window.parent", "no parent window (not iframed)");
      }
    } catch (e) {
      tryPush("window.parent", `error: ${(e as Error).message}`);
    }

    setSignals(found);

    for (const s of found) {
      if (s.token) {
        setDetectedToken(s.token);
        setTokenSource(s.source);
        break;
      }
    }
  }, []);

  // postMessage listener + proactive handshake
  useEffect(() => {
    function handler(ev: MessageEvent) {
      const log: PostMessageLog = {
        time: new Date().toISOString().slice(11, 23),
        origin: ev.origin || "(null)",
        dataPreview: safePreview(ev.data),
      };
      const token = extractTokenFromAny(ev.data);
      if (token) {
        log.extractedToken = token;
        setDetectedToken((prev) => prev ?? token);
        setTokenSource((prev) => prev ?? `postMessage from ${ev.origin}`);
      }
      setMessages((prev) => [...prev.slice(-49), log]);
    }
    window.addEventListener("message", handler);

    // Proactively ask parent for identity — many portals respond to these
    if (window.parent && window.parent !== window) {
      const requests = [
        { type: "whoami" },
        { type: "requestToken" },
        { type: "auth-request" },
        { action: "getUser" },
      ];
      for (const msg of requests) {
        try {
          window.parent.postMessage(msg, "*");
        } catch {
          /* ignore */
        }
      }
    }

    return () => window.removeEventListener("message", handler);
  }, []);

  async function resolveUser(token: string) {
    setResolving(true);
    setResolveError(null);
    setClearsquareUser(null);
    try {
      const res = await fetch("/api/clearsquare/self", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, access_token: token }),
      });
      const body = await res.json();
      if (!res.ok) {
        setResolveError(
          body.error ? `${body.error}` : `Request failed (${res.status})`,
        );
        if (body.details) setClearsquareUser({ error: body });
      } else {
        setClearsquareUser(body);
        const emailFromUser = findEmail(body);
        if (emailFromUser) setEmail(emailFromUser);
      }
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setResolving(false);
    }
  }

  // Auto-resolve once when we detect a token
  useEffect(() => {
    if (detectedToken && !attemptedAutoResolve.current) {
      attemptedAutoResolve.current = true;
      void resolveUser(detectedToken);
    }
  }, [detectedToken]);

  // Direct client-side probe of Clearsquare endpoint (with credentials).
  // Runs once on mount; re-runs once if a token is detected later.
  useEffect(() => {
    const hasToken = !!detectedToken;
    if (hasToken && directProbeWithToken.current) return;
    if (!hasToken && directProbeNoToken.current) return;
    if (hasToken) directProbeWithToken.current = true;
    else directProbeNoToken.current = true;

    const attempt: DirectProbe["attempt"] = hasToken
      ? "with-token"
      : "no-token";
    const payload = hasToken
      ? { token: detectedToken, access_token: detectedToken }
      : {};

    (async () => {
      try {
        const res = await fetch(CLEARSQUARE_SELF_URL, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        let body: unknown = text;
        try {
          body = JSON.parse(text);
        } catch {
          /* keep as text */
        }
        setDirectProbes((prev) => [
          ...prev,
          {
            attempt,
            status: res.status,
            ok: res.ok,
            body,
            finishedAt: new Date().toISOString().slice(11, 23),
          },
        ]);

        // If it actually worked, surface the user + email just like the proxy path.
        if (res.ok) {
          setClearsquareUser((existing: unknown) => existing ?? body);
          const emailFromBody = findEmail(body);
          if (emailFromBody) setEmail((e: string) => e || emailFromBody);
        }
      } catch (err) {
        setDirectProbes((prev) => [
          ...prev,
          {
            attempt,
            error:
              err instanceof Error ? `${err.name}: ${err.message}` : String(err),
            finishedAt: new Date().toISOString().slice(11, 23),
          },
        ]);
      }
    })();
  }, [detectedToken]);

  async function fetchActivities(emailToUse: string) {
    setActivitiesLoading(true);
    setActivitiesError(null);
    setActivities(null);
    try {
      const res = await fetch(
        `/api/activities?email=${encodeURIComponent(emailToUse)}`,
      );
      const body = await res.json();
      if (!res.ok) {
        setActivitiesError(body.error ?? `Request failed (${res.status})`);
      } else {
        setActivities(body);
      }
    } catch (err) {
      setActivitiesError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActivitiesLoading(false);
    }
  }

  // Auto-fetch activities once when email is populated from Clearsquare
  useEffect(() => {
    if (
      clearsquareUser &&
      email &&
      !attemptedAutoActivities.current &&
      !activities
    ) {
      attemptedAutoActivities.current = true;
      void fetchActivities(email);
    }
  }, [clearsquareUser, email, activities]);

  const jwtPreview = useMemo(
    () => (detectedToken ? decodeJwtPayload(detectedToken) : null),
    [detectedToken],
  );

  function onEmailSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void fetchActivities(email);
  }

  function onManualTokenSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setDetectedToken(manualToken.trim());
    setTokenSource("manual paste");
    attemptedAutoResolve.current = false;
    void resolveUser(manualToken.trim());
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4 dark:bg-black">
      <main className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            PMPro BI — Clearsquare iframe probe
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Deploy target. Logs every channel we could pick up an auth token on
            so we can see what Clearsquare actually exposes.
          </p>
        </header>

        <Panel title="1. Detected token">
          {detectedToken ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-zinc-500">source:</span>{" "}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-900">
                  {tokenSource}
                </code>
              </div>
              <div>
                <span className="text-zinc-500">token:</span>{" "}
                <code className="break-all text-xs">
                  {truncateToken(detectedToken)}
                </code>
              </div>
              {jwtPreview && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-zinc-500">
                    decoded JWT payload
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 dark:bg-zinc-900">
                    {JSON.stringify(jwtPreview, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">
              No token auto-detected yet. Check the probe panels below, or paste
              one manually.
            </div>
          )}

          <form
            onSubmit={onManualTokenSubmit}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="paste token manually"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-black outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              className="h-10 rounded-md bg-zinc-800 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-black"
            >
              Use this token
            </button>
          </form>
        </Panel>

        <Panel title="2. Direct iframe fetch (credentials: include)">
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Fires on mount, and re-fires once a token is detected. Tells us
            whether the Clearsquare session cookie flows to this origin and
            what CORS posture the endpoint has. A network/CORS failure here
            surfaces as a <code>TypeError</code>.
          </p>
          {directProbes.length === 0 ? (
            <div className="text-sm text-zinc-500">Running…</div>
          ) : (
            <div className="space-y-3">
              {directProbes.map((p, i) => (
                <div
                  key={i}
                  className="rounded border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-900">
                      attempt: <strong>{p.attempt}</strong>
                    </span>
                    {p.status !== undefined && (
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          p.ok
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        }`}
                      >
                        status: {p.status}
                      </span>
                    )}
                    {p.error && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800 dark:bg-red-950 dark:text-red-200">
                        {p.error}
                      </span>
                    )}
                    <span className="text-zinc-500">at {p.finishedAt}</span>
                  </div>
                  {p.body !== undefined && (
                    <pre className="overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
                      {typeof p.body === "string"
                        ? p.body
                        : JSON.stringify(p.body, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="3. Clearsquare user (via /api/clearsquare/self proxy)">
          {resolving && (
            <div className="text-sm text-zinc-500">Resolving user…</div>
          )}
          {resolveError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {resolveError}
            </div>
          )}
          {clearsquareUser ? (
            <pre className="overflow-x-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              {JSON.stringify(clearsquareUser, null, 2)}
            </pre>
          ) : (
            !resolving &&
            !resolveError && (
              <div className="text-sm text-zinc-500">
                Waiting on a token before calling Clearsquare.
              </div>
            )
          )}
        </Panel>

        <Panel title="4. P6 activity lookup">
          <form
            onSubmit={onEmailSubmit}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
              >
                Email (auto-filled from Clearsquare if available)
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <button
              type="submit"
              disabled={activitiesLoading}
              className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {activitiesLoading ? "Fetching…" : "Fetch activities"}
            </button>
          </form>
          {activitiesError && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {activitiesError}
            </div>
          )}
          {activities && (
            <div className="mt-4">
              <div className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                {activities.activities.length} activities for{" "}
                <span className="font-medium text-black dark:text-zinc-50">
                  {activities.user.Name ??
                    activities.user.Id ??
                    activities.user.EmailAddress}
                </span>{" "}
                (ObjectId {activities.user.ObjectId})
              </div>
              <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Activity</th>
                      <th className="px-3 py-2">Owners</th>
                      <th className="px-3 py-2">Primary Resource</th>
                      <th className="px-3 py-2 text-right">ObjectId</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                    {activities.activities.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-5 text-center text-zinc-500 dark:text-zinc-400"
                        >
                          No activities found.
                        </td>
                      </tr>
                    ) : (
                      activities.activities.map((a) => (
                        <tr key={a.ObjectId}>
                          <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                            {a.ProjectName ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                            {a.Name}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                            {a.OwnerNamesArray?.join(", ") ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                            {a.PrimaryResourceName ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            {a.ObjectId}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="5. Environment signals">
          <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                    source
                  </th>
                  <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                    detail
                  </th>
                  <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                    value
                  </th>
                  <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                    token?
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {signals.map((s, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-mono text-zinc-700 dark:text-zinc-300">
                      {s.source}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400">
                      {s.detail}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-zinc-700 dark:text-zinc-300">
                      {s.value ? safePreview(s.value, 180) : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      {s.token ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          yes
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="6. postMessage log (live)">
          {messages.length === 0 ? (
            <div className="text-sm text-zinc-500">
              No messages received yet. Parent may not postMessage, or only
              responds to specific triggers.
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-xs">
                <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2">time</th>
                    <th className="px-3 py-2">origin</th>
                    <th className="px-3 py-2">data</th>
                    <th className="px-3 py-2">token?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {messages.map((m, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono text-zinc-600 dark:text-zinc-400">
                        {m.time}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {m.origin}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-zinc-700 dark:text-zinc-300">
                        {m.dataPreview}
                      </td>
                      <td className="px-3 py-1.5">
                        {m.extractedToken ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            yes
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </main>
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

function findEmail(obj: unknown, depth = 0): string | undefined {
  if (depth > 4 || obj == null) return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findEmail(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof obj !== "object") return undefined;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (/email/i.test(key) && typeof val === "string" && val.includes("@")) {
      return val;
    }
  }
  for (const val of Object.values(obj as Record<string, unknown>)) {
    const found = findEmail(val, depth + 1);
    if (found) return found;
  }
  return undefined;
}
