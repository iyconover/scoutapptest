import type { ReactNode } from "react"

/** Standard page title block. Every route uses this at the top. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Standard page body width + spacing. `wide` for boards (pick lists, war games). */
export function PageContainer({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={
        wide
          ? "mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6"
          : "mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6"
      }
    >
      {children}
    </div>
  )
}
