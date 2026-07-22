import type { ReactNode } from "react";

/** Shared card chrome for dashboard widgets, matching the app panel style. */
export function DashboardCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-brand-border bg-card p-4 shadow-sm ${className}`}
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}
