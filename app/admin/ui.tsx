"use client";

export async function apiCall<T>(
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

export const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const inputClass =
  "w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm text-foreground outline-none ring-brand-ring focus:ring-2";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${classes}`}>
      {children}
    </div>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-brand-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 border-l-4 border-secondary pl-2.5 text-sm font-semibold uppercase tracking-wide text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}
