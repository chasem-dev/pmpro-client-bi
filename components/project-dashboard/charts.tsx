"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActivityStatusCount,
  PhaseCompletion,
  PhaseRemainingDuration,
  PhaseStatusCount,
  StartVariancePoint,
} from "@/lib/metabase-queries";

// Brand palette (see app/globals.css) plus status colors.
const BRAND_SECONDARY = "#4a90e2";
export const STATUS_COLORS: Record<string, string> = {
  Complete: "#16a34a",
  "In Progress": "#4a90e2",
  "Not Started": "#eab308",
};
const STATUS_ORDER = ["Complete", "In Progress", "Not Started"];

const AXIS_TICK = { fontSize: 12, fill: "#6b7280" };
const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid #e5e7eb",
};

/** Horizontal bar chart: % complete per top-level WBS phase. */
export function PhaseCompletionChart({ phases }: { phases: PhaseCompletion[] }) {
  const data = phases.map((p) => ({
    phase: p.phase,
    percent: p.percentComplete ?? 0,
  }));
  if (data.length === 0) {
    return <EmptyChart label="No phase data" />;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={AXIS_TICK}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="phase"
          width={170}
          tick={AXIS_TICK}
          interval={0}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [`${value}%`, "% Complete"]}
        />
        <Bar dataKey="percent" fill={BRAND_SECONDARY} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Vertical bar chart: activity counts by status. */
export function StatusBreakdownChart({
  breakdown,
}: {
  breakdown: ActivityStatusCount[];
}) {
  const data = [...breakdown].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );
  if (data.length === 0) {
    return <EmptyChart label="No activity data" />;
  }
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 0, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="status" tick={AXIS_TICK} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [value, "Activities"]} />
          <Bar dataKey="activities" radius={[4, 4, 0, 0]} maxBarSize={64}>
            {data.map((entry) => (
              <Cell
                key={entry.status}
                fill={STATUS_COLORS[entry.status] ?? BRAND_SECONDARY}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap justify-center gap-4">
        {data.map((entry) => (
          <span
            key={entry.status}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[entry.status] ?? BRAND_SECONDARY }}
            />
            {entry.status} ({entry.activities})
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal stacked bar chart: activity counts per phase, split by status. */
export function PhaseStatusChart({ counts }: { counts: PhaseStatusCount[] }) {
  // Pivot rows (phase, status, count) into one datum per phase with a key
  // per status, preserving phase sequence order.
  const byPhase = new Map<
    string,
    { phase: string; order: number } & Record<string, string | number>
  >();
  for (const c of counts) {
    const entry =
      byPhase.get(c.phase) ?? { phase: c.phase, order: c.phaseOrder };
    entry[c.status] = c.activities;
    byPhase.set(c.phase, entry);
  }
  const data = [...byPhase.values()].sort((a, b) => a.order - b.order);
  if (data.length === 0) {
    return <EmptyChart label="No phase data" />;
  }
  return (
    <div>
      <ResponsiveContainer
        width="100%"
        height={Math.max(180, data.length * 30 + 40)}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
          <YAxis
            type="category"
            dataKey="phase"
            width={170}
            tick={AXIS_TICK}
            interval={0}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {STATUS_ORDER.map((status) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="status"
              fill={STATUS_COLORS[status]}
              maxBarSize={20}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap justify-center gap-4">
        {STATUS_ORDER.map((status) => (
          <span
            key={status}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[status] }}
            />
            {status}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar chart: total remaining work days per phase. */
export function RemainingDurationChart({
  phases,
}: {
  phases: PhaseRemainingDuration[];
}) {
  const data = phases.map((p) => ({
    phase: p.phase,
    days: p.remainingDays ?? 0,
  }));
  if (data.length === 0) {
    return <EmptyChart label="No remaining work" />;
  }
  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(180, data.length * 30 + 40)}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
        <XAxis type="number" tick={AXIS_TICK} />
        <YAxis
          type="category"
          dataKey="phase"
          width={170}
          tick={AXIS_TICK}
          interval={0}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [`${value} days`, "Remaining"]}
        />
        <Bar dataKey="days" fill="#eab308" radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Parse Metabase "YYYY-MM-DD" dates as local time (see MilestoneTable).
function toLocalTime(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
  return Number.isNaN(time) ? null : time;
}

const shortDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Scatter plot: start variance (days) by planned start date. */
export function StartVarianceScatterChart({
  points,
}: {
  points: StartVariancePoint[];
}) {
  const data = points.flatMap((p) => {
    const ts = toLocalTime(p.plannedStart);
    if (ts === null || p.varianceDays === null) return [];
    return [{ ts, variance: p.varianceDays, activity: p.activity, id: p.id }];
  });
  if (data.length === 0) {
    return <EmptyChart label="No started activities" />;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ left: 0, right: 16, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          dataKey="ts"
          domain={["auto", "auto"]}
          tick={AXIS_TICK}
          tickFormatter={(ts: number) =>
            new Date(ts).toLocaleDateString(undefined, {
              month: "short",
              year: "2-digit",
            })
          }
        />
        <YAxis type="number" dataKey="variance" tick={AXIS_TICK} width={40} />
        <ReferenceLine y={0} stroke="#9ca3af" />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as
              | (typeof data)[number]
              | undefined;
            if (!active || !point) return null;
            return (
              <div
                style={TOOLTIP_STYLE}
                className="bg-white px-3 py-2 shadow-sm"
              >
                <div className="font-medium text-foreground">
                  {point.activity}
                </div>
                <div className="text-muted-foreground">{point.id}</div>
                <div className="text-muted-foreground">
                  Planned {shortDate(point.ts)} ·{" "}
                  {point.variance > 0
                    ? `${point.variance} days late`
                    : point.variance < 0
                      ? `${-point.variance} days early`
                      : "on time"}
                </div>
              </div>
            );
          }}
        />
        <Scatter data={data}>
          {data.map((point, i) => (
            <Cell
              key={i}
              fill={
                point.variance > 0
                  ? "#dc2626"
                  : point.variance < 0
                    ? "#16a34a"
                    : "#f59e0b"
              }
              fillOpacity={0.75}
            />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground/70">
      {label}
    </div>
  );
}
