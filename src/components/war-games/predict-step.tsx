import { ArrowDownIcon, ArrowUpIcon, MinusIcon, PlusIcon, RotateCcwIcon, TrophyIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { AllianceChip } from "@/components/alliance-chip"
import { TeamLink } from "@/components/team-link"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AllianceColor } from "@/lib/alliance"
import { errorMessage } from "@/lib/errors"
import { formatEventRank } from "@/lib/format"
import { cn } from "@/lib/utils"
import { MAX_RP, type WarGameData, type WarGamePrediction } from "./types"
import { useWarGameMutations } from "./use-war-game-mutations"

// ---------------------------------------------------------------------------
// RP stepper + match card
// ---------------------------------------------------------------------------

function RPStepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number
  onChange: (value: number) => void
  disabled: boolean
  label: string
}) {
  if (disabled) {
    return (
      <span className="min-w-12 text-center text-lg font-semibold tabular-nums" aria-label={label}>
        {value}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">RP</span>
      </span>
    )
  }
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={label}>
      <Button
        variant="outline"
        size="icon"
        className="size-11 md:size-9"
        aria-label={`Decrease ${label}`}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon />
      </Button>
      <span className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="size-11 md:size-9"
        aria-label={`Increase ${label}`}
        disabled={value >= MAX_RP}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon />
      </Button>
    </div>
  )
}

function AllianceRow({
  color,
  teams,
  value,
  onChange,
  canEdit,
  matchNumber,
}: {
  color: AllianceColor
  teams: readonly number[]
  value: number
  onChange: (value: number) => void
  canEdit: boolean
  matchNumber: number
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap gap-1">
        {teams.map((t) => (
          <AllianceChip key={t} color={color} className="px-0">
            <TeamLink teamNumber={t} className="min-h-7 px-2" />
          </AllianceChip>
        ))}
      </div>
      <RPStepper
        value={value}
        onChange={onChange}
        disabled={!canEdit}
        label={`Q${matchNumber} ${color} RP`}
      />
    </div>
  )
}

function MatchPredictionCard({
  prediction,
  canEdit,
  onChange,
}: {
  prediction: WarGamePrediction
  canEdit: boolean
  onChange: (redRP: number, blueRP: number) => void
}) {
  const p = prediction
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading font-semibold">Q{p.number}</span>
          {p.manual ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Suggested {p.suggested.redRP}–{p.suggested.blueRP}
              <Badge variant="default">Edited</Badge>
            </span>
          ) : (
            <Badge variant="secondary">Suggested</Badge>
          )}
        </div>
        <AllianceRow
          color="red"
          teams={p.red}
          value={p.redRP}
          canEdit={canEdit}
          matchNumber={p.number}
          onChange={(v) => onChange(v, p.blueRP)}
        />
        <AllianceRow
          color="blue"
          teams={p.blue}
          value={p.blueRP}
          canEdit={canEdit}
          matchNumber={p.number}
          onChange={(v) => onChange(p.redRP, v)}
        />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// RP settings
// ---------------------------------------------------------------------------

function parseRP(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= 0 && n <= MAX_RP ? n : null
}

function RPSettingsForm({ data }: { data: WarGameData }) {
  const { scenario, canEdit } = data
  const { updateSettings } = useWarGameMutations()
  const [win, setWin] = useState(String(scenario.winRP))
  const [tie, setTie] = useState(String(scenario.tieRP))
  const [pending, setPending] = useState(false)
  const winRP = parseRP(win)
  const tieRP = parseRP(tie)
  const dirty = winRP !== scenario.winRP || tieRP !== scenario.tieRP
  const valid = winRP !== null && tieRP !== null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid || !dirty || pending) return
    setPending(true)
    try {
      await updateSettings({ warGameId: scenario._id, winRP, tieRP })
      toast.success("RP settings saved.")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="war-game-win-rp">Win RP</Label>
        <Input
          id="war-game-win-rp"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_RP}
          step={1}
          value={win}
          onChange={(e) => setWin(e.currentTarget.value)}
          disabled={!canEdit}
          aria-invalid={winRP === null}
          className="h-11 w-24 md:h-9"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="war-game-tie-rp">Tie RP</Label>
        <Input
          id="war-game-tie-rp"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_RP}
          step={1}
          value={tie}
          onChange={(e) => setTie(e.currentTarget.value)}
          disabled={!canEdit}
          aria-invalid={tieRP === null}
          className="h-11 w-24 md:h-9"
        />
      </div>
      {canEdit && (
        <Button type="submit" variant="outline" className="h-11 md:h-9" disabled={!valid || !dirty || pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Save
        </Button>
      )}
    </form>
  )
}

function RPSettingsCard({ data }: { data: WarGameData }) {
  const { scenario } = data
  return (
    <Card>
      <CardHeader>
        <CardTitle>RP settings</CardTitle>
        <CardDescription>
          Suggestions assume the alliance with the higher summed OPR wins, plus each team’s average bonus RP so far.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Re-mount when the saved values change so the inputs pick them up. */}
        <RPSettingsForm key={`${scenario.winRP}:${scenario.tieRP}`} data={data} />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Predicted standings
// ---------------------------------------------------------------------------

function Movement({ current, predicted }: { current: number | null; predicted: number }) {
  if (current === null) return <span className="text-muted-foreground">New</span>
  const delta = current - predicted
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className="text-muted-foreground">
        {current} → {predicted}
      </span>
      {delta > 0 ? (
        <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400" aria-label={`Up ${delta}`}>
          <ArrowUpIcon className="size-4" />
          {delta}
        </span>
      ) : delta < 0 ? (
        <span className="inline-flex items-center text-red-600 dark:text-red-400" aria-label={`Down ${-delta}`}>
          <ArrowDownIcon className="size-4" />
          {-delta}
        </span>
      ) : (
        <MinusIcon className="size-4 text-muted-foreground" aria-label="No change" />
      )}
    </span>
  )
}

function StandingsCard({ data }: { data: WarGameData }) {
  const nicknames = new Map(data.teams.map((t) => [t.teamNumber, t.nickname]))
  const rows = [...data.standings].sort((a, b) => a.predictedRank - b.predictedRank)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Predicted final rankings</CardTitle>
        <CardDescription>Ranking score after every unplayed match goes as predicted above.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 sm:px-(--card-spacing)">
        {rows.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No teams at this event yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 pl-4 sm:pl-2">Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">RS</TableHead>
                <TableHead className="pr-4 sm:pr-2">Current → predicted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.teamNumber}>
                  <TableCell className="pl-4 font-semibold tabular-nums sm:pl-2">
                    {formatEventRank(s.predictedRank)}
                  </TableCell>
                  <TableCell className="max-w-[12rem] sm:max-w-none">
                    <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <TeamLink teamNumber={s.teamNumber} className="w-fit tabular-nums" />
                      <span className="truncate text-xs text-muted-foreground sm:text-sm">
                        {nicknames.get(s.teamNumber) ?? ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.predictedRS.toFixed(2)}</TableCell>
                  <TableCell className="pr-4 sm:pr-2">
                    <Movement current={s.currentRank} predicted={s.predictedRank} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

function ResetAllButton({ data }: { data: WarGameData }) {
  const { resetPredictions } = useWarGameMutations()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const editedCount = data.predictions.filter((p) => p.manual).length

  async function onReset() {
    setPending(true)
    try {
      await resetPredictions({ warGameId: data.scenario._id })
      toast.success("All matches reset to suggestions.")
      setOpen(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="outline" className="h-11 md:h-8" disabled={editedCount === 0 || pending} />}
      >
        <RotateCcwIcon data-icon="inline-start" />
        Reset all to suggestions
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset all predictions?</AlertDialogTitle>
          <AlertDialogDescription>
            Your edits to {editedCount} {editedCount === 1 ? "match" : "matches"} will be replaced by the current
            suggestions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 md:h-8">Cancel</AlertDialogCancel>
          <AlertDialogAction className="h-11 md:h-8" disabled={pending} onClick={() => void onReset()}>
            {pending && <Spinner data-icon="inline-start" />}
            Reset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function PredictStep({ data }: { data: WarGameData }) {
  const { setPrediction } = useWarGameMutations()
  const { canEdit, scenario } = data
  const predictions = [...data.predictions].sort((a, b) => a.number - b.number)

  function onChange(p: WarGamePrediction, redRP: number, blueRP: number) {
    if (redRP === p.redRP && blueRP === p.blueRP) return
    // Saved on every tap; the optimistic update keeps the stepper instant.
    setPrediction({ warGameId: scenario._id, matchId: p.matchId, redRP, blueRP }).catch((e: unknown) =>
      toast.error(errorMessage(e)),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {predictions.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrophyIcon />
            </EmptyMedia>
            <EmptyTitle>Rankings are final</EmptyTitle>
            <EmptyDescription>All qualification matches have been played — rankings are final.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-heading text-lg font-semibold">Unplayed matches</h2>
              <p className="text-sm text-muted-foreground">
                {canEdit
                  ? "Adjust the ranking points each alliance earns. Changes save automatically."
                  : "Predicted ranking points for each remaining match."}
              </p>
            </div>
            {canEdit && <ResetAllButton data={data} />}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {predictions.map((p) => (
              <MatchPredictionCard
                key={p.matchId}
                prediction={p}
                canEdit={canEdit}
                onChange={(red, blue) => onChange(p, red, blue)}
              />
            ))}
          </div>
        </section>
      )}

      <div className={cn("grid gap-6", "lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start")}>
        <RPSettingsCard data={data} />
        <StandingsCard data={data} />
      </div>
    </div>
  )
}
