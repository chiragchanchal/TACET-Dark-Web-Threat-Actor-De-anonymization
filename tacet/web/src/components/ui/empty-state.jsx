import { cn } from '../../lib/utils.js';

/** Icon + title + description placeholder for empty result sets. */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white/[0.02]">
          <Icon className="h-4 w-4 text-zinc-600" />
        </div>
      )}
      <div className="text-[13px] font-medium text-zinc-300">{title}</div>
      {description && <div className="max-w-md text-[12px] leading-relaxed text-zinc-600">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
