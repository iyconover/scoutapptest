import type { FunctionReturnType } from "convex/server"
import { CheckIcon, ImageIcon } from "lucide-react"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { api } from "../../../convex/_generated/api"

export type PitStatusRow = FunctionReturnType<typeof api.pit.statusGrid>[number]

/** Big tappable tile on the pit dashboard; opens the team's pit form. */
export function PitTeamTile({ team }: { team: PitStatusRow }) {
  return (
    <Link
      to={`/pit/${team.teamNumber}`}
      aria-label={`Team ${team.teamNumber} ${team.nickname}, ${team.scouted ? "scouted" : "not scouted"}`}
      className={cn(
        "flex h-full min-h-32 flex-col gap-2 rounded-xl border p-3 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
        team.scouted ? "border-border bg-card hover:bg-muted" : "border-dashed border-primary/50 bg-card hover:bg-muted",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-heading text-3xl font-bold tabular-nums leading-none tracking-tight">
          {team.teamNumber}
        </span>
        {team.photoCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`${team.photoCount} photos`}>
            <ImageIcon className="size-3.5" />
            {team.photoCount}
          </span>
        )}
      </div>
      <span className="line-clamp-2 text-sm text-muted-foreground">{team.nickname || "Unnamed team"}</span>
      <div className="mt-auto">
        {team.scouted ? (
          <Badge>
            <CheckIcon data-icon="inline-start" />
            Scouted
          </Badge>
        ) : (
          <Badge variant="outline">Not Scouted</Badge>
        )}
      </div>
    </Link>
  )
}
