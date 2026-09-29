import { useMutation, useQuery } from "convex/react"
import { CheckIcon, LockIcon, MinusIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { AllianceChip } from "@/components/alliance-chip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useNow } from "@/hooks/use-now"
import { errorMessage } from "@/lib/errors"
import { isActiveScouter } from "@/lib/presence"
import { cn } from "@/lib/utils"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { ManualTeamsForm } from "./manual-teams-form"
import type { CurrentMatch, CurrentScouting, LeadPanelRow } from "./match-utils"

type Stats = { active: number; ranked: number; noted: number }

function statsFor(rows: LeadPanelRow[], now: number): Stats {
  return {
    active: rows.filter((r) => isActiveScouter(r, now)).length,
    ranked: rows.filter((r) => r.submittedRanking).length,
    noted: rows.filter((r) => r.submittedNotes).length,
  }
}

function StatsLine({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {[
        { label: "Active", value: stats.active },
        { label: "Ranked", value: stats.ranked },
        { label: "With notes", value: stats.noted },
      ].map((s) => (
        <div key={s.label} className="rounded-lg bg-muted/60 px-2 py-2">
          <div className="font-heading text-2xl font-semibold tabular-nums">{s.value}</div>
          <div className="text-xs text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/** Compact counts for the landing page. */
export function LeadSummary({ matchId }: { matchId: Id<"matches"> | null }) {
  const rows = useQuery(api.matchScouting.leadPanel, matchId ? { matchId } : "skip")
  const now = useNow(1000)
  if (matchId === null) {
    return <p className="text-sm text-muted-foreground">Enter the teams for this match to start scouting.</p>
  }
  if (rows === undefined) return <Skeleton className="h-16 w-full" />
  return <StatsLine stats={statsFor(rows, now)} />
}

/** Everything the lead scout needs to run the current match. */
export function LeadTools({ current }: { current: CurrentScouting }) {
  const match = current.match
  return (
    <div className="flex flex-col gap-5">
      {match && <ScouterStatus match={match} />}
      {match && (
        <>
          <Separator />
          <CloseMatchSection match={match} />
        </>
      )}
      <Separator />
      <ChangeMatchNumber currentNumber={current.matchNumber} />
      {match?.source === "manual" && (
        <>
          <Separator />
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Edit teams</h3>
            <p className="text-xs text-muted-foreground">You can change the teams until someone submits a ranking.</p>
            <ManualTeamsForm
              key={`${match._id}:${[...match.red, ...match.blue].join(",")}`}
              matchNumber={match.number}
              match={match}
            />
          </section>
        </>
      )}
    </div>
  )
}

function ScouterStatus({ match }: { match: CurrentMatch }) {
  const rows = useQuery(api.matchScouting.leadPanel, { matchId: match._id })
  const now = useNow(1000)
  const [showAll, setShowAll] = useState(false)

  if (rows === undefined) {
    return (
      <section className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </section>
    )
  }

  const redSet = new Set(match.red)
  const decorated = rows.map((r) => ({ ...r, active: isActiveScouter(r, now) }))
  const relevant = (r: (typeof decorated)[number]) =>
    r.active || r.submittedRanking || r.submittedNotes || r.assignedTeams.length > 0
  const sorted = [...decorated].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.displayName.localeCompare(b.displayName),
  )
  const visible = showAll ? sorted : sorted.filter(relevant)
  const hidden = sorted.length - visible.length

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Scouters · match {match.number}</h3>
      <StatsLine stats={statsFor(rows, now)} />
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody is scouting this match yet.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {visible.map((r) => (
            <li key={r.userId} className="flex flex-col gap-1.5 px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn("size-2.5 shrink-0 rounded-full", r.active ? "bg-green-500" : "bg-muted-foreground/40")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">{r.displayName}</span>
                <span className="sr-only">{r.active ? "Active" : "Not active"}</span>
                <StatusMark done={r.submittedRanking} label="Ranking" />
                <StatusMark done={r.submittedNotes} label="Notes" />
              </div>
              {r.assignedTeams.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-4.5">
                  <span className="text-xs text-muted-foreground">Watching</span>
                  {r.assignedTeams.map((t) => (
                    <AllianceChip key={t} color={redSet.has(t) ? "red" : "blue"} className="text-xs">
                      {t}
                    </AllianceChip>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {(hidden > 0 || showAll) && (
        <Button variant="ghost" className="h-11" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Hide inactive users" : `Show ${hidden} inactive ${hidden === 1 ? "user" : "users"}`}
        </Button>
      )}
    </section>
  )
}

function StatusMark({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs",
        done ? "bg-green-500/15 text-green-700 dark:text-green-300" : "text-muted-foreground",
      )}
    >
      {done ? <CheckIcon className="size-3" /> : <MinusIcon className="size-3" />}
      {label}
      <span className="sr-only">{done ? " submitted" : " not submitted"}</span>
    </span>
  )
}

function CloseMatchSection({ match }: { match: CurrentMatch }) {
  const closeMatch = useMutation(api.matchScouting.closeMatch)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function onConfirm() {
    setPending(true)
    try {
      await closeMatch({ matchId: match._id })
      toast.success(`Match ${match.number} closed`)
      setOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  if (match.closed) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LockIcon className="size-4" /> Match {match.number} is closed.
      </p>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" className="h-11 w-full" />}>
        <LockIcon /> Close match {match.number}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close match {match.number}?</AlertDialogTitle>
          <AlertDialogDescription>
            Nobody can submit or change rankings and notes for this match afterwards. Everyone moves on to match{" "}
            {match.number + 1}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 sm:h-8" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="h-11 sm:h-8"
            onClick={() => void onConfirm()}
            disabled={pending}
          >
            {pending && <Spinner />}
            Close match
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ChangeMatchNumber({ currentNumber }: { currentNumber: number }) {
  const setCurrentMatchNumber = useMutation(api.matchScouting.setCurrentMatchNumber)
  const [value, setValue] = useState("")
  const [pending, setPending] = useState(false)
  const parsed = /^\d{1,3}$/.test(value) ? Number(value) : null
  const valid = parsed !== null && parsed >= 1 && parsed !== currentNumber

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid || parsed === null) return
    setPending(true)
    try {
      await setCurrentMatchNumber({ number: parsed })
      toast.success(`Everyone is now on match ${parsed}`)
      setValue("")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-2">
      <Label htmlFor="lead-match-number" className="font-semibold">
        Change match number
      </Label>
      <div className="flex gap-2">
        <Input
          id="lead-match-number"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={3}
          placeholder={String(currentNumber)}
          className="h-11 flex-1 text-lg tabular-nums"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          disabled={pending}
        />
        <Button type="submit" variant="secondary" className="h-11 px-5" disabled={!valid || pending}>
          {pending && <Spinner />}
          Set
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Moves every scouter to that match right away.</p>
    </form>
  )
}
