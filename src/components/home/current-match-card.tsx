import { useQuery } from "convex/react"
import { ArrowRightIcon } from "lucide-react"
import { Link } from "react-router"

import { AllianceChip } from "@/components/alliance-chip"
import { TeamLink } from "@/components/team-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { AllianceColor } from "@/lib/alliance"

import { api } from "../../../convex/_generated/api"
import type { ScoutingRole } from "../../../convex/lib/validators"

const ROLE_LABELS: Record<ScoutingRole, string> = {
  lead: "Lead scout",
  assigned: "Watching assigned teams",
  ranker: "Ranking",
}

function AllianceRow({ color, teams }: { color: AllianceColor; teams: readonly number[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {teams.map((team) => (
        <AllianceChip key={team} color={color} className="h-10 justify-center px-1">
          <TeamLink teamNumber={team} className="flex h-full w-full items-center justify-center" />
        </AllianceChip>
      ))}
    </div>
  )
}

export function CurrentMatchCard() {
  const current = useQuery(api.matchScouting.current)

  if (current === undefined) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-2 h-12 w-full" />
        </CardContent>
      </Card>
    )
  }
  if (current === null) return null

  const { match, myRole, myAssignments } = current
  const assignedTeams = myAssignments.map((a) => a.teamNumber)

  return (
    <Card>
      <CardHeader>
        <CardDescription>Current match</CardDescription>
        <CardTitle className="text-lg">Qualification {current.matchNumber}</CardTitle>
        {match?.closed && (
          <CardAction>
            <Badge variant="outline">Closed</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {match ? (
          <div className="flex flex-col gap-2">
            <AllianceRow color="red" teams={match.red} />
            <AllianceRow color="blue" teams={match.blue} />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-center text-muted-foreground">
            Teams for this match haven't been set yet.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Your role:</span>
          <Badge variant={myRole === "lead" ? "default" : "secondary"}>{ROLE_LABELS[myRole]}</Badge>
          {myRole === "assigned" && assignedTeams.length > 0 && (
            <span className="text-muted-foreground">({assignedTeams.join(", ")})</span>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button size="lg" className="h-12 w-full text-base" render={<Link to="/match-scouting" />} nativeButton={false}>
          Go to match scouting
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  )
}
