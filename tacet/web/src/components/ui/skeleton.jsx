import { cn } from '../../lib/utils.js';

/** Pulse placeholder block. */
export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded bg-white/[0.05]', className)} />;
}

export function SkeletonRows({ rows = 6, className }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 5, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card px-4 py-3.5">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="mt-2 h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}
