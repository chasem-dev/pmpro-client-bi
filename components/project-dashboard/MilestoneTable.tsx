import type { Milestone, MilestoneStatus } from "@/lib/metabase-queries";

const STATUS_PILL: Record<MilestoneStatus, string> = {
  Complete: "bg-green-100 text-green-800",
  Late: "bg-red-100 text-red-800",
  "At Risk": "bg-amber-100 text-amber-800",
  "On Track": "bg-blue-100 text-blue-800",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  // Metabase returns dates as "YYYY-MM-DD" (or ISO timestamps); parse the
  // date part as local time to avoid timezone day-shifts.
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MilestoneTable({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground/70">
        No milestones
      </div>
    );
  }
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-brand-border text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">Milestone</th>
            <th className="py-2 pr-3 font-semibold">Target</th>
            <th className="py-2 pr-3 font-semibold">Actual</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            <th className="py-2 font-semibold">Variance</th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((m) => (
            <tr
              key={`${m.id}-${m.milestone}`}
              className="border-b border-brand-border/60 last:border-b-0"
            >
              <td className="py-2 pr-3">
                <div className="font-medium text-foreground">{m.milestone}</div>
                <div className="text-xs text-muted-foreground/70">{m.id}</div>
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                {formatDate(m.targetDate)}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                {formatDate(m.actualDate)}
              </td>
              <td className="py-2 pr-3">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_PILL[m.status] ?? "bg-muted text-muted-foreground"}`}
                >
                  {m.status}
                </span>
              </td>
              <td className="py-2 whitespace-nowrap text-muted-foreground">
                {m.variance}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
