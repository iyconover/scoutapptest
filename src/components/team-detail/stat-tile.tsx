import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Compact labelled number for the team detail header grid. */
export function StatTile({
  label,
  value,
  sub,
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2", className)}>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="truncate font-heading text-lg leading-tight font-semibold tabular-nums">{value}</span>
      {sub !== undefined && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}
