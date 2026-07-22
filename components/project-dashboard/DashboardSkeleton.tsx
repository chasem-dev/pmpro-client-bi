/**
 * Loading skeletons that mirror the dashboard widget layout, with a shimmer
 * sweep (keyframes in app/globals.css).
 */

/** Shimmering placeholder block. */
function Sk({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`relative overflow-hidden rounded-md bg-slate-200/80 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent ${className}`}
    />
  );
}

function SkeletonCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-brand-border bg-card p-4 shadow-sm ${className}`}
    >
      <Sk className="mb-4 h-3 w-40" />
      {children}
    </div>
  );
}

// Fixed pseudo-random widths/heights so the skeleton looks organic but
// renders identically on server and client.
const PHASE_BAR_WIDTHS = ["62%", "38%", "74%", "51%", "83%", "29%", "67%"];
const STATUS_BAR_HEIGHTS = ["55%", "85%", "35%"];

export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* % Complete stat */}
      <SkeletonCard>
        <div className="flex flex-col gap-3 pb-2">
          <Sk className="h-10 w-28" />
          <Sk className="h-3 w-full rounded-full" />
          <Sk className="h-2.5 w-56 max-w-full" />
        </div>
      </SkeletonCard>

      {/* Late activities stat */}
      <SkeletonCard>
        <div className="flex flex-col gap-3 pb-2">
          <Sk className="h-12 w-20" />
          <Sk className="h-2.5 w-48 max-w-full" />
        </div>
      </SkeletonCard>

      {/* Phase chart: label + horizontal bar rows */}
      <SkeletonCard className="sm:col-span-2">
        <div className="space-y-2.5">
          {PHASE_BAR_WIDTHS.map((width, i) => (
            <div key={i} className="flex items-center gap-3">
              <Sk className="h-3 w-32 shrink-0" />
              <Sk className="h-4" style={{ width }} />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Status chart: vertical bars + legend */}
      <SkeletonCard>
        <div className="flex h-44 items-end justify-center gap-10 px-4">
          {STATUS_BAR_HEIGHTS.map((height, i) => (
            <Sk key={i} className="w-14" style={{ height }} />
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-4">
          <Sk className="h-2.5 w-20" />
          <Sk className="h-2.5 w-20" />
          <Sk className="h-2.5 w-20" />
        </div>
      </SkeletonCard>

      {/* Milestone table: header + rows */}
      <SkeletonCard>
        <div className="space-y-3">
          <div className="flex gap-4">
            <Sk className="h-3 w-32" />
            <Sk className="h-3 w-16" />
            <Sk className="h-3 w-16" />
            <Sk className="h-3 w-14" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Sk className="h-3.5 w-36" />
              <Sk className="h-3.5 w-14" />
              <Sk className="h-3.5 w-14" />
              <Sk className="h-4 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Phase/status stacked chart: horizontal bar rows */}
      <SkeletonCard className="sm:col-span-2">
        <div className="space-y-2.5">
          {PHASE_BAR_WIDTHS.map((width, i) => (
            <div key={i} className="flex items-center gap-3">
              <Sk className="h-3 w-32 shrink-0" />
              <Sk className="h-4" style={{ width }} />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Variance table: header + rows */}
      <SkeletonCard className="sm:col-span-2">
        <div className="space-y-3">
          <div className="flex gap-4">
            <Sk className="h-3 w-40" />
            <Sk className="h-3 w-24" />
            <Sk className="h-3 w-16" />
            <Sk className="h-3 w-16" />
            <Sk className="h-3 w-14" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Sk className="h-3.5 w-48" />
              <Sk className="h-3.5 w-24" />
              <Sk className="h-4 w-20 rounded-full" />
              <Sk className="h-3.5 w-16" />
              <Sk className="h-3.5 w-10" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Start variance scatter */}
      <SkeletonCard>
        <Sk className="h-44 w-full" />
      </SkeletonCard>

      {/* Remaining duration: horizontal bar rows */}
      <SkeletonCard>
        <div className="space-y-2.5">
          {PHASE_BAR_WIDTHS.slice(0, 5).map((width, i) => (
            <div key={i} className="flex items-center gap-3">
              <Sk className="h-3 w-28 shrink-0" />
              <Sk className="h-4" style={{ width }} />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
