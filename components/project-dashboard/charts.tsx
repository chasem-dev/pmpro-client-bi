"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActivityStatusCount,
  PhaseCompletion,
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

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground/70">
      {label}
    </div>
  );
}
