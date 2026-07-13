"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityCard } from "@/components/my-work/ActivityCard";
import type { MyActivitiesResponse, MyActivity } from "@/components/my-work/types";

export default function Home() {
  const [activities, setActivities] = useState<MyActivity[]>([]);
  const [policies, setPolicies] = useState<MyActivitiesResponse["policies"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState("30");
  const [useRange, setUseRange] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (useRange) {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else if (days) {
      params.set("days", days);
    }
    try {
      const res = await fetch(`/api/my/activities?${params.toString()}`);
      const body = (await res.json()) as MyActivitiesResponse;
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`);
        setActivities([]);
      } else {
        setActivities(body.activities ?? []);
        setPolicies(body.policies);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setActivities([]);
    }
    setLoading(false);
  }, [days, useRange, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, MyActivity[]>();
    for (const a of activities) {
      const key = a.projectName ?? "Unknown project";
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activities]);

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4 dark:bg-black">
      <nav className="mx-auto mb-6 flex max-w-6xl items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            PMPro Update Tool
          </span>
          <Link
            href="/admin"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Admin
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

      <main className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              My Work
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Activities assigned to you via the P6 Owner Email field.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="h-9 shrink-0 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Time period
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!useRange}
                onChange={() => setUseRange(false)}
              />
              Days from today
              <input
                type="number"
                min={1}
                value={days}
                disabled={useRange}
                onChange={(e) => setDays(e.target.value)}
                className="w-20 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={useRange}
                onChange={() => setUseRange(true)}
              />
              Date range
            </label>
            {useRange && (
              <>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <span className="text-sm text-zinc-400">to</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Apply filter
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              />
            ))}
          </div>
        ) : activities.length === 0 && !error ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-xl dark:bg-zinc-900">
              📁
            </div>
            <h2 className="mt-4 text-base font-semibold text-black dark:text-zinc-50">
              No activities found
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              No activities are assigned to you in the selected time period. If
              you believe this is a mistake, contact an Admin.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([projectName, projectActivities]) => (
              <section key={projectName}>
                <h2 className="mb-3 text-lg font-semibold text-black dark:text-zinc-50">
                  {projectName}
                  <span className="ml-2 text-sm font-normal text-zinc-400">
                    ({projectActivities.length})
                  </span>
                </h2>
                <div className="space-y-4">
                  {projectActivities.map((activity) => (
                    <ActivityCard
                      key={activity.objectId}
                      activity={activity}
                      policies={policies}
                      onRefresh={load}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
