import type { VarianceRow } from "@/lib/metabase-queries";
import { formatDate } from "./MilestoneTable";

const STATUS_PILL: Record<string, string> = {
  "In Progress": "bg-blue-100 text-blue-800",
  "Not Started": "bg-amber-100 text-amber-800",
};

function formatDays(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Incomplete activities past their planned finish, most-late first. */
export function VarianceTable({ rows }: { rows: VarianceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground/70">
        No overdue activities
      </div>
    );
  }
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-brand-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">Activity</th>
            <th className="py-2 pr-3 font-semibold">Phase</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            <th className="py-2 pr-3 font-semibold">Planned Start</th>
            <th className="py-2 pr-3 font-semibold">Planned Finish</th>
            <th className="py-2 pr-3 text-right font-semibold">Days Late</th>
            <th className="py-2 pr-3 text-right font-semibold">Float (days)</th>
            <th className="py-2 text-right font-semibold">Remaining (days)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.id}-${row.activity}`}
              className="border-b border-brand-border/60 last:border-b-0"
            >
              <td className="py-2 pr-3">
                <div className="font-medium text-foreground">{row.activity}</div>
                <div className="text-xs text-muted-foreground/70">{row.id}</div>
              </td>
              <td className="py-2 pr-3 text-muted-foreground">{row.phase}</td>
              <td className="py-2 pr-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_PILL[row.status] ?? "bg-muted text-muted-foreground"}`}
                >
                  {row.status}
                </span>
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                {formatDate(row.plannedStart)}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                {formatDate(row.plannedFinish)}
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-destructive">
                {row.daysLate}
              </td>
              <td className="py-2 pr-3 text-right text-muted-foreground">
                {formatDays(row.floatDays)}
              </td>
              <td className="py-2 text-right text-muted-foreground">
                {formatDays(row.remainingDays)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
