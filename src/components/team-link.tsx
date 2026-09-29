import type { ReactNode } from "react"

import { useOpenTeam } from "@/hooks/use-open-team"
import { cn } from "@/lib/utils"

/** Button that opens the global team detail modal. */
export function TeamLink({
  teamNumber,
  children,
  className,
}: {
  teamNumber: number
  children?: ReactNode
  className?: string
}) {
  const openTeam = useOpenTeam()
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        openTeam(teamNumber)
      }}
      className={cn("font-medium underline-offset-4 hover:underline", className)}
    >
      {children ?? teamNumber}
    </button>
  )
}
