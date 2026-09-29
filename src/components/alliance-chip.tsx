import type { ReactNode } from "react"

import { allianceClasses, type AllianceColor } from "@/lib/alliance"
import { cn } from "@/lib/utils"

/** Red/blue tinted pill for a team number (or any content). */
export function AllianceChip({
  color,
  children,
  className,
}: {
  color: AllianceColor
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-semibold tabular-nums",
        allianceClasses[color],
        className,
      )}
    >
      {children}
    </span>
  )
}
