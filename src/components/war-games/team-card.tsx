import type { ComponentProps } from "react"

import { formatEventRank, formatOpr, formatRank } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { WarGameTeam } from "./types"

/** Compact team card used on the alliance board and in the unpicked list. */
export function TeamCard({
  teamNumber,
  team,
  className,
  ...props
}: {
  teamNumber: number
  team: WarGameTeam | undefined
} & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={`Team ${teamNumber}${team?.nickname ? ` ${team.nickname}` : ""}`}
      className={cn(
        "flex min-h-14 w-full min-w-0 flex-col gap-0.5 rounded-md border bg-card px-2 py-1.5 text-left text-card-foreground",
        "outline-none select-none [-webkit-touch-callout:none] touch-manipulation focus-visible:ring-3 focus-visible:ring-ring/50",
        "hover:bg-muted/60",
        className,
      )}
      {...props}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-semibold tabular-nums">{teamNumber}</span>
        <span className="text-xs text-muted-foreground tabular-nums" title="Event rank">
          {formatEventRank(team?.eventRank)}
        </span>
      </span>
      <span className="truncate text-xs text-muted-foreground">{team?.nickname || " "}</span>
      <span className="flex gap-2 text-xs tabular-nums">
        <span title="Our average ranking (1 = best)">
          <span className="text-muted-foreground">Avg</span> {formatRank(team?.avgRank)}
        </span>
        <span title="OPR">
          <span className="text-muted-foreground">OPR</span> {formatOpr(team?.opr)}
        </span>
      </span>
    </button>
  )
}
