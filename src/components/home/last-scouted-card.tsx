import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ArrowRightIcon, HistoryIcon } from "lucide-react"
import { Link } from "react-router"

import { TeamLink } from "@/components/team-link"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { allianceClasses, type AllianceColor } from "@/lib/alliance"
import { formatRank } from "@/lib/format"
import { cn } from "@/lib/utils"

import { api } from "../../../convex/_generated/api"

type HistoryRow = FunctionReturnType<typeof api.matches.history>[number]
type TeamCell = HistoryRow["red"][number]

function AllianceCells({
  color,
  cells,
  score,
  won,
}: {
  color: AllianceColor
  cells: TeamCell[]
  score: number | null
  won: boolean
}) {
  return (
    <div className={cn("flex items-stretch gap-2 rounded-lg border p-1.5", allianceClasses[color])}>
      <div className="grid flex-1 grid-cols-3 gap-1.5">
        {cells.map((cell) => (
          <TeamLink
            key={cell.teamNumber}
            teamNumber={cell.teamNumber}
            className="flex min-h-11 flex-col items-center justify-center rounded-md bg-background/60 px-1 py-1 hover:no-underline"
          >
            <span className="font-semibold tabular-nums">{cell.teamNumber}</span>
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {formatRank(cell.avgRank)}
            </span>
          </TeamLink>
        ))}
      </div>
      {score !== null && (
        <div
          className={cn(
            "flex w-12 shrink-0 items-center justify-center text-lg tabular-nums",
            won ? "font-bold" : "font-medium opacity-80",
          )}
        >
          {score}
        </div>
      )}
    </div>
  )
}

export function LastScoutedCard() {
  const history = useQuery(api.matches.history)

  if (history === undefined) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    )
  }

  const row = history.findLast((r) => [...r.red, ...r.blue].some((cell) => cell.avgRank !== null))

  return (
    <Card>
      <CardHeader>
        <CardDescription>Most recently scouted</CardDescription>
        <CardTitle className="text-lg">{row ? `Qualification ${row.number}` : "No matches yet"}</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link to="/matches" />} nativeButton={false}>
            History
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {row ? (
          <div className="flex flex-col gap-2">
            <AllianceCells
              color="red"
              cells={row.red}
              score={row.redScore}
              won={row.redScore !== null && row.blueScore !== null && row.redScore > row.blueScore}
            />
            <AllianceCells
              color="blue"
              cells={row.blue}
              score={row.blueScore}
              won={row.redScore !== null && row.blueScore !== null && row.blueScore > row.redScore}
            />
            <p className="text-xs text-muted-foreground">Our scouters' average rank this match (1 = best).</p>
          </div>
        ) : (
          <Empty className="p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HistoryIcon />
              </EmptyMedia>
              <EmptyTitle>Nothing scouted yet</EmptyTitle>
              <EmptyDescription>Rankings will show up here once scouters submit a match.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
