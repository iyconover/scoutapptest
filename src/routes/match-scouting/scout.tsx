import { useMutation, useQuery } from "convex/react"
import { ArrowLeftIcon, CheckIcon, ClipboardListIcon, LockIcon, ShieldIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { AssignedNotes } from "@/components/match-scouting/assigned-notes"
import { LeadTools } from "@/components/match-scouting/lead-panel"
import { ManualTeamsForm } from "@/components/match-scouting/manual-teams-form"
import {
  changedNotes,
  defaultOrder,
  isPermutationOf,
  matchSlots,
  ROLE_LABELS,
  sameOrder,
  serverNoteMap,
  type CurrentMatch,
  type CurrentScouting,
} from "@/components/match-scouting/match-utils"
import { RankingList } from "@/components/match-scouting/ranking-list"
import { SubmitBar } from "@/components/match-scouting/submit-bar"
import { NoEvent } from "@/components/no-event"
import { PageContainer, PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useIsDesktop } from "@/hooks/use-media-query"
import { errorCode, errorMessage } from "@/lib/errors"
import { useScoutingDraft } from "@/stores/scouting-draft"
import { api } from "../../../convex/_generated/api"

export function MatchScoutRoute() {
  const current = useQuery(api.matchScouting.current)
  useMatchChangeNotice(current)

  if (current === undefined) return <ScoutSkeleton />
  if (current === null) {
    return (
      <PageContainer>
        <NoEvent />
      </PageContainer>
    )
  }

  const match = current.match
  if (match === null) {
    return (
      <ScoutShell current={current}>
        {current.myRole === "lead" ? (
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-lg font-semibold">Enter the teams for match {current.matchNumber}</h2>
              <p className="text-sm text-muted-foreground">
                There's no schedule for this match yet. Everyone else is waiting for you to enter the six teams.
              </p>
            </div>
            <ManualTeamsForm key={`new:${current.matchNumber}`} matchNumber={current.matchNumber} match={null} />
          </section>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Spinner />
              </EmptyMedia>
              <EmptyTitle>Waiting for the lead scout to enter the teams for match {current.matchNumber}</EmptyTitle>
              <EmptyDescription>This page updates by itself as soon as the teams are in.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </ScoutShell>
    )
  }

  if (match.closed) {
    return (
      <ScoutShell current={current}>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LockIcon />
            </EmptyMedia>
            <EmptyTitle>Match {match.number} is closed</EmptyTitle>
            <EmptyDescription>
              Waiting for match {match.number + 1}… This page switches over as soon as the lead scout moves on.
            </EmptyDescription>
          </EmptyHeader>
          {current.mySubmission && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-300">
              <CheckIcon className="size-4" /> Your ranking was submitted
            </p>
          )}
        </Empty>
      </ScoutShell>
    )
  }

  return current.myRole === "assigned" ? (
    <AssignedForm key={match._id} current={current} match={match} />
  ) : (
    <RankingForm key={match._id} current={current} match={match} />
  )
}

/** Toast when the lead scout moves everyone to another match while this page is open. */
function useMatchChangeNotice(current: CurrentScouting | null | undefined) {
  const matchNumber = current?.matchNumber
  const isLead = current?.myRole === "lead"
  const prev = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (matchNumber === undefined) return
    if (prev.current !== undefined && prev.current !== matchNumber && !isLead) {
      toast.info(`Now on match ${matchNumber}`, { description: "The lead scout moved everyone to a new match." })
    }
    prev.current = matchNumber
  }, [matchNumber, isLead])
}

/** Header + (for the lead) lead tools in a side column on desktop or a bottom sheet on mobile. */
function ScoutShell({
  current,
  children,
  bar,
}: {
  current: CurrentScouting
  children: ReactNode
  bar?: ReactNode
}) {
  const isDesktop = useIsDesktop()
  const event = useQuery(api.events.active)
  const isLead = current.myRole === "lead"
  const leadName = event?.leadScout?.displayName

  const header = (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        className="-ml-2 h-11 self-start px-2 text-muted-foreground"
        render={<Link to="/match-scouting" />}
        nativeButton={false}
      >
        <ArrowLeftIcon /> Match scouting
      </Button>
      <PageHeader
        title={`Qualification ${current.matchNumber}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={isLead ? "default" : "secondary"}>{ROLE_LABELS[current.myRole]}</Badge>
            {current.match?.source === "manual" && <Badge variant="outline">Entered manually</Badge>}
            {!isLead && <span>{leadName ? `Lead scout: ${leadName}` : "No lead scout assigned"}</span>}
          </span>
        }
        actions={
          isLead && !isDesktop ? (
            <Sheet>
              <SheetTrigger render={<Button variant="outline" className="h-11" />}>
                <ShieldIcon /> Lead tools
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85svh] gap-0">
                <SheetHeader className="pr-12">
                  <SheetTitle>Lead tools</SheetTitle>
                  <SheetDescription>Run match {current.matchNumber} for everyone.</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                  <LeadTools current={current} />
                </div>
              </SheetContent>
            </Sheet>
          ) : undefined
        }
      />
    </div>
  )

  return (
    <PageContainer>
      {header}
      {isLead && isDesktop ? (
        <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-4">{children}</div>
          <aside className="sticky top-20 flex max-h-[calc(100svh-13rem)] flex-col overflow-y-auto gap-3 rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 font-heading font-semibold">
              <ShieldIcon className="size-4" /> Lead tools
            </h2>
            <LeadTools current={current} />
          </aside>
        </div>
      ) : (
        <div className="flex flex-col gap-4">{children}</div>
      )}
      {bar}
    </PageContainer>
  )
}

function submitErrorDescription(error: unknown): string | undefined {
  switch (errorCode(error)) {
    case "MATCH_CLOSED":
      return "The lead scout closed this match before your submission arrived."
    case "ASSIGNED_IN_MATCH":
      return "You're watching assigned teams this match. The page has switched to notes."
    case "INVALID_RANKING":
      return "The teams in this match changed. Check the order and submit again."
    case "FORBIDDEN":
      return "You don't have permission to do that for this match."
    default:
      return undefined
  }
}

function RankingForm({ current, match }: { current: CurrentScouting; match: CurrentMatch }) {
  const matchId = match._id
  const submitRanking = useMutation(api.matchScouting.submitRanking)
  const saveNotes = useMutation(api.matchScouting.saveNotes)
  const draft = useScoutingDraft((s) => s.drafts[matchId])
  const setOrder = useScoutingDraft((s) => s.setOrder)
  const setNote = useScoutingDraft((s) => s.setNote)
  const clearDraft = useScoutingDraft((s) => s.clearDraft)
  const [pending, setPending] = useState(false)

  const slots = matchSlots(match)
  const teams = slots.map((s) => s.teamNumber)
  const submission = current.mySubmission
  const submittedOrder = submission ? defaultOrder(match, submission) : null
  const draftOrderValid = draft !== undefined && isPermutationOf(draft.order, teams)
  const order = draftOrderValid ? draft.order : defaultOrder(match, submission)
  const confirmed = submission !== null || (draftOrderValid && draft.confirmed)

  const serverNotes = serverNoteMap(current.myNotes)
  const notes: Record<number, string> = {}
  for (const t of teams) notes[t] = draft?.notes[t] ?? serverNotes.get(t) ?? ""
  const noteChanges = changedNotes(teams, draft?.notes, serverNotes)
  const orderChanged = submittedOrder === null || !sameOrder(order, submittedOrder)
  const hasChanges = orderChanged || noteChanges.length > 0
  const upToDate = submission !== null && !hasChanges

  async function onSubmit() {
    if (!confirmed || !hasChanges) return
    setPending(true)
    let rankingSaved = false
    try {
      if (orderChanged) {
        await submitRanking({ matchId, ranks: order.map((teamNumber, i) => ({ teamNumber, rank: i + 1 })) })
      }
      rankingSaved = true
      if (noteChanges.length > 0) await saveNotes({ matchId, notes: noteChanges })
      clearDraft(matchId)
      toast.success(submission ? "Ranking updated" : "Ranking submitted", {
        description: "You can update it until the match is closed.",
      })
    } catch (err) {
      if (rankingSaved && orderChanged) {
        toast.error("Your ranking was saved, but your notes weren't.", { description: errorMessage(err) })
      } else {
        toast.error(errorMessage(err), { description: submitErrorDescription(err) })
      }
    } finally {
      setPending(false)
    }
  }

  let status: ReactNode
  if (upToDate) {
    status = (
      <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-300">
        <CheckIcon className="size-4" /> Submitted — you can update until the match is closed
      </span>
    )
  } else if (!confirmed) {
    status = "Drag teams into order (or use the arrows), or confirm the order below."
  } else if (submission) {
    status = "You have unsaved changes."
  }

  const submitLabel = upToDate ? "Submitted" : submission ? "Update ranking" : "Submit ranking"

  return (
    <ScoutShell
      current={current}
      bar={
        <SubmitBar status={status}>
          {!confirmed && (
            <Button
              variant="outline"
              className="h-12 flex-1 text-base"
              onClick={() => setOrder(matchId, order)}
              disabled={pending}
            >
              <CheckIcon /> This order is correct
            </Button>
          )}
          <Button
            className="h-12 flex-1 text-base"
            onClick={() => void onSubmit()}
            disabled={!confirmed || !hasChanges || pending}
          >
            {pending ? <Spinner /> : upToDate ? <CheckIcon /> : null}
            {submitLabel}
          </Button>
        </SubmitBar>
      }
    >
      <p className="text-sm text-muted-foreground">
        Rank the teams from <span className="font-semibold text-foreground">1 (best)</span> to{" "}
        <span className="font-semibold text-foreground">6 (worst)</span>. Hold and drag the handle, or use the arrows.
        Notes are optional.
      </p>
      <RankingList
        slots={slots}
        order={order}
        onOrderChange={(next) => setOrder(matchId, next)}
        notes={notes}
        onNoteChange={(teamNumber, text) => setNote(matchId, teamNumber, text)}
        disabled={pending}
      />
    </ScoutShell>
  )
}

function AssignedForm({ current, match }: { current: CurrentScouting; match: CurrentMatch }) {
  const matchId = match._id
  const saveNotes = useMutation(api.matchScouting.saveNotes)
  const draft = useScoutingDraft((s) => s.drafts[matchId])
  const setNote = useScoutingDraft((s) => s.setNote)
  const clearDraft = useScoutingDraft((s) => s.clearDraft)
  const [pending, setPending] = useState(false)

  const slots = matchSlots(match)
  const assignedTeams = current.myAssignments.map((a) => a.teamNumber)
  const serverNotes = serverNoteMap(current.myNotes)
  const notes: Record<number, string> = {}
  for (const t of assignedTeams) notes[t] = draft?.notes[t] ?? serverNotes.get(t) ?? ""
  const noteChanges = changedNotes(assignedTeams, draft?.notes, serverNotes)
  const hasChanges = noteChanges.length > 0
  const savedCount = assignedTeams.filter((t) => serverNotes.has(t)).length

  async function onSubmit() {
    if (!hasChanges) return
    setPending(true)
    try {
      await saveNotes({ matchId, notes: noteChanges })
      clearDraft(matchId)
      toast.success("Notes saved", { description: "You can edit them until the match is closed." })
    } catch (err) {
      toast.error(errorMessage(err), { description: submitErrorDescription(err) })
    } finally {
      setPending(false)
    }
  }

  let status: ReactNode
  if (hasChanges) status = "You have unsaved notes."
  else if (savedCount > 0) {
    status = (
      <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-300">
        <CheckIcon className="size-4" /> Notes saved — you can edit until the match is closed
      </span>
    )
  } else status = "Write notes on your assigned teams, then save."

  return (
    <ScoutShell
      current={current}
      bar={
        <SubmitBar status={status}>
          <Button className="h-12 flex-1 text-base" onClick={() => void onSubmit()} disabled={!hasChanges || pending}>
            {pending ? <Spinner /> : <ClipboardListIcon />}
            Save notes
          </Button>
        </SubmitBar>
      }
    >
      <AssignedNotes
        match={match}
        slots={slots}
        assignments={current.myAssignments}
        notes={notes}
        onNoteChange={(teamNumber, text) => setNote(matchId, teamNumber, text)}
        disabled={pending}
      />
    </ScoutShell>
  )
}

function ScoutSkeleton() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </PageContainer>
  )
}
