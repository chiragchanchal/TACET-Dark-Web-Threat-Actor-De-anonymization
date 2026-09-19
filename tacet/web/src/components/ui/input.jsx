import { cn } from '../../lib/utils.js';

function Input({ className, type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-none transition-colors',
        'placeholder:text-muted-foreground/70 hover:border-zinc-600 focus-visible:border-sky-500/70 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
