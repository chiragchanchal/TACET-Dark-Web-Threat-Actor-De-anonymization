export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-[17px] font-semibold tracking-tight text-zinc-100">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{children}</div>
  );
}
