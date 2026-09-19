import { cn } from '../../lib/utils.js';

function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-card backdrop-blur-2xl text-card-foreground shadow-2xl ring-1 ring-white/5 transition-all duration-300', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 px-5 pt-4 pb-2', className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return <h2 className={cn('text-sm font-semibold tracking-tight text-zinc-100', className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <p className={cn('text-[13px] text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div className={cn('px-5 pb-5 pt-2', className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center px-5 py-3 border-t border-border', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
