import { AllianceChip } from "@/components/alliance-chip"
import { TeamLink } from "@/components/team-link"
import { cn } from "@/lib/utils"
import type { CurrentMatch } from "./match-utils"

/** Red and blue alliances as two rows of chips. `highlight` teams get a ring. */
export function MatchTeams({
  match,
  highlight,
  size = "default",
}: {
  match: Pick<CurrentMatch, "red" | "blue">
  highlight?: ReadonlySet<number>
  size?: "default" | "lg"
}) {
  return (
    <div className="flex flex-col gap-2">
      {(["red", "blue"] as const).map((color) => (
        <div key={color} className="flex items-center gap-2">
          <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground uppercase">{color}</span>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {match[color].map((teamNumber) => (
              <AllianceChip
                key={teamNumber}
                color={color}
                className={cn(
                  "justify-center p-0",
                  size === "lg" ? "text-lg" : "text-base",
                  highlight?.has(teamNumber) && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
              >
                <TeamLink teamNumber={teamNumber} className="flex min-h-11 w-full items-center justify-center">
                  {teamNumber}
                </TeamLink>
              </AllianceChip>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
