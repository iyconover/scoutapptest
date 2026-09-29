import { useQuery } from "convex/react"
import { ArrowRightIcon, CheckCircle2Icon, CircleDashedIcon, EyeIcon, LockIcon, ShieldIcon } from "lucide-react"
import { Link } from "react-router"

import { LeadSummary } from "@/components/match-scouting/lead-panel"
import { MatchTeams } from "@/components/match-scouting/match-teams"
import { ROLE_EXPLANATIONS, ROLE_LABELS, type CurrentScouting } from "@/components/match-scouting/match-utils"
import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { TeamLink } from "@/components/team-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "../../../convex/_generated/api"

export function MatchScoutingIndexRoute() {
  const current = useQuery(api.matchScouting.current)
  const event = useQuery(api.events.active)

  if (current === undefined) return <LandingSkeleton />
  if (current === null) {
    return (
      <PageContainer>
        <PageHeader title="Match Scouting" />
        <NoEvent />
      </PageContainer>
    )
  }

  const { match, myRole, matchNumber } = current
  const isLead = myRole === "lead"
  const leadName = event?.leadScout?.displayName

  return (
    <PageContainer>
      <PageHeader title="Match Scouting" description={event?.name} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardDescription>Current match</CardDescription>
            <CardTitle className="flex flex-wrap items-center gap-3">
              <span className="font-heading text-5xl font-bold tabular-nums">{matchNumber}</span>
              <span className="text-base text-muted-foreground">Qualification</span>
              {match?.closed && (
                <Badge variant="secondary">
                  <LockIcon /> Closed
                </Badge>
              )}
              {match?.source === "manual" && <Badge variant="outline">Entered manually</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {match ? (
              <MatchTeams match={match} size="lg" highlight={new Set(current.myAssignments.map((a) => a.teamNumber))} />
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {isLead
                  ? `No schedule for match ${matchNumber} yet. Enter the six teams to start it.`
                  : `Waiting for the lead scout to enter the teams for match ${matchNumber}.`}
                {event && !event.hasSchedule && " This event has no published schedule, so teams are entered each match."}
              </p>
            )}
            {match?.closed && (
              <p className="text-sm text-muted-foreground">
                This match is closed. Waiting for the lead scout to move on to match {matchNumber + 1}.
              </p>
            )}
            <p className="flex items-center gap-2 text-sm">
              <ShieldIcon className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Lead scout:</span>
              <span className="font-medium">{isLead ? "You" : (leadName ?? "Not assigned yet")}</span>
            </p>
            <StartButton current={current} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Your role this match</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <Badge variant={isLead ? "default" : "secondary"} className="h-6 px-2.5 text-sm">
                {ROLE_LABELS[myRole]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">{ROLE_EXPLANATIONS[myRole]}</p>
            {myRole === "assigned" && current.myAssignments.length > 0 && (
              <ul className="flex flex-col gap-2">
                {current.myAssignments.map((a) => (
                  <li key={a.assignmentId} className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
                    <EyeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <TeamLink teamNumber={a.teamNumber} className="font-semibold tabular-nums" />
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {a.instructions.trim() || "No specific instructions."}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {match && <MyStatus current={current} />}
          </CardContent>
        </Card>

        {isLead ? (
          <Card>
            <CardHeader>
              <CardDescription>Lead panel</CardDescription>
              <CardTitle>Match {matchNumber} progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <LeadSummary matchId={match?._id ?? null} />
              <Button variant="outline" className="h-11" render={<Link to="/match-scouting/scout" />} nativeButton={false}>
                Open lead tools <ArrowRightIcon />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <StandingAssignments />
        )}

        {isLead && <StandingAssignments />}
      </div>
    </PageContainer>
  )
}

function StartButton({ current }: { current: CurrentScouting }) {
  const { match, matchNumber, myRole, mySubmission, myNotes } = current
  let label: string
  if (match === null) label = myRole === "lead" ? `Enter teams for match ${matchNumber}` : "Waiting for teams…"
  else if (match.closed) label = `View match ${matchNumber}`
  else if (myRole === "assigned") label = myNotes.length > 0 ? "Update my notes" : `Start scouting match ${matchNumber}`
  else label = mySubmission ? "Update my ranking" : `Start scouting match ${matchNumber}`

  return (
    <Button
      size="lg"
      className="h-14 w-full text-base"
      variant={mySubmission && !match?.closed ? "secondary" : "default"}
      render={<Link to="/match-scouting/scout" />}
      nativeButton={false}
    >
      {label} <ArrowRightIcon />
    </Button>
  )
}

function MyStatus({ current }: { current: CurrentScouting }) {
  const noteCount = current.myNotes.length
  const items: { done: boolean; label: string }[] = []
  if (current.myRole !== "assigned") {
    items.push({
      done: current.mySubmission !== null,
      label: current.mySubmission ? "Ranking submitted" : "Ranking not submitted yet",
    })
  }
  items.push({
    done: noteCount > 0,
    label: noteCount > 0 ? `${noteCount} ${noteCount === 1 ? "note" : "notes"} saved` : "No notes yet",
  })

  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          {item.done ? (
            <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400" />
          ) : (
            <CircleDashedIcon className="size-4 text-muted-foreground" />
          )}
          <span className={item.done ? "font-medium" : "text-muted-foreground"}>
            {item.label}
            {item.done && <span className="sr-only"> (done)</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

function StandingAssignments() {
  const assignments = useQuery(api.assignments.mine)
  return (
    <Card>
      <CardHeader>
        <CardDescription>Your standing assignments</CardDescription>
        <CardTitle>Teams to watch</CardTitle>
      </CardHeader>
      <CardContent>
        {assignments === undefined ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no assigned teams. You'll rank every match you scout.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assignments.map((a) => (
              <li key={a._id} className="flex flex-col gap-0.5 rounded-lg border p-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <TeamLink teamNumber={a.teamNumber} className="font-semibold tabular-nums" />
                  {a.nickname && <span className="truncate text-muted-foreground">{a.nickname}</span>}
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {a.instructions.trim() || "No specific instructions."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function LandingSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </PageContainer>
  )
}
