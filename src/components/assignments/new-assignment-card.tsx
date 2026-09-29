import { useMutation, useQuery } from "convex/react"
import { AlertTriangleIcon, UserPlusIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/errors"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { MAX_NOTE_LENGTH } from "../../../convex/lib/constants"
import { formatQuals, type Assignment, type Profile, type Team } from "./types"

/** Form for assigning a scouter to watch a team, with a live conflict preview. */
export function NewAssignmentCard({
  profiles,
  teams,
  assignments,
}: {
  profiles: Profile[]
  teams: Team[]
  assignments: Assignment[]
}) {
  const [scouterId, setScouterId] = useState<Id<"users"> | null>(null)
  const [teamNumber, setTeamNumber] = useState<number | null>(null)
  const [instructions, setInstructions] = useState("")
  /** Set when the instructions were prefilled from an existing assignment. */
  const [prefilledFrom, setPrefilledFrom] = useState<Id<"assignments"> | null>(null)
  const [pending, setPending] = useState(false)

  const create = useMutation(api.assignments.create)
  const preview = useQuery(
    api.assignments.previewConflicts,
    scouterId !== null && teamNumber !== null ? { scouterId, teamNumber } : "skip",
  )

  const countByScouter = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of assignments) counts.set(a.scouterId, (counts.get(a.scouterId) ?? 0) + 1)
    return counts
  }, [assignments])

  const assigneesByTeam = useMemo(() => {
    const names = new Map<number, string[]>()
    for (const a of assignments) names.set(a.teamNumber, [...(names.get(a.teamNumber) ?? []), a.scouterName])
    return names
  }, [assignments])

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.number - b.number), [teams])

  const scouterItems = profiles.map((p) => ({ value: p.userId as string, label: p.displayName }))
  const teamItems = sortedTeams.map((t) => ({ value: String(t.number), label: teamLabel(t) }))

  const findExisting = (s: Id<"users"> | null, t: number | null) =>
    s === null || t === null ? undefined : assignments.find((a) => a.scouterId === s && a.teamNumber === t)

  const existing = findExisting(scouterId, teamNumber)
  const scouterName = profiles.find((p) => p.userId === scouterId)?.displayName ?? "This scouter"
  // Re-assigning an existing pair only updates instructions, so the server skips the conflict check.
  const conflicts = existing ? [] : (preview?.matchNumbers ?? [])
  const checking = scouterId !== null && teamNumber !== null && !existing && preview === undefined
  const canSubmit = scouterId !== null && teamNumber !== null && !checking && conflicts.length === 0 && !pending

  /** Prefill instructions when the chosen pair already exists; clear them again when it no longer does. */
  const onPairChange = (s: Id<"users"> | null, t: number | null) => {
    const match = findExisting(s, t)
    if (match) {
      setInstructions(match.instructions)
      setPrefilledFrom(match._id)
    } else if (prefilledFrom !== null) {
      setInstructions("")
      setPrefilledFrom(null)
    }
  }

  const onScouterChange = (value: string | null) => {
    const next = value === null ? null : (value as Id<"users">)
    setScouterId(next)
    onPairChange(next, teamNumber)
  }

  const onTeamChange = (value: string | null) => {
    const next = value === null ? null : Number(value)
    setTeamNumber(next)
    onPairChange(scouterId, next)
  }

  const onSubmit = async () => {
    if (scouterId === null || teamNumber === null) return
    setPending(true)
    try {
      await create({ scouterId, teamNumber, instructions })
      toast.success(
        existing ? `Updated instructions for ${scouterName} · ${teamNumber}` : `Assigned ${teamNumber} to ${scouterName}`,
      )
      setTeamNumber(null)
      setInstructions("")
      setPrefilledFrom(null)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New assignment</CardTitle>
        <CardDescription>
          The scouter takes notes on this team instead of ranking during its matches. At most two of a scouter's
          teams can play in the same match.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="assignment-scouter">Scouter</Label>
            <Select items={scouterItems} value={scouterId ?? null} onValueChange={onScouterChange}>
              <SelectTrigger id="assignment-scouter" className="w-full data-[size=default]:h-11">
                <SelectValue placeholder="Choose a scouter" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => {
                  const count = countByScouter.get(p.userId) ?? 0
                  return (
                    <SelectItem key={p.userId} value={p.userId} className="py-2.5">
                      <span className="truncate">{p.displayName}</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {count === 0 ? "No teams" : `${count} team${count === 1 ? "" : "s"}`}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="assignment-team">Team</Label>
            <Select
              items={teamItems}
              value={teamNumber === null ? null : String(teamNumber)}
              onValueChange={onTeamChange}
              disabled={teams.length === 0}
            >
              <SelectTrigger id="assignment-team" className="w-full data-[size=default]:h-11">
                <SelectValue placeholder={teams.length === 0 ? "No teams imported" : "Choose a team"} />
              </SelectTrigger>
              <SelectContent>
                {sortedTeams.map((t) => {
                  const assignees = assigneesByTeam.get(t.number)
                  return (
                    <SelectItem key={t.number} value={String(t.number)} className="py-2.5">
                      <span className="truncate">{teamLabel(t)}</span>
                      {assignees && (
                        <span className="ml-auto max-w-32 truncate text-xs text-muted-foreground">
                          {assignees.join(", ")}
                        </span>
                      )}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="assignment-instructions">Instructions</Label>
          <Textarea
            id="assignment-instructions"
            placeholder="What should they look for?"
            value={instructions}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(e) => setInstructions(e.target.value)}
            className="min-h-24"
          />
        </div>

        {existing && (
          <p className="text-sm text-muted-foreground">
            {scouterName} is already assigned to {existing.teamNumber}. Saving updates their instructions.
          </p>
        )}

        {conflicts.length > 0 && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-medium">{scouterName}</span> would be watching 3+ teams in{" "}
              {formatQuals(conflicts)}. Choose another scouter.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {checking && (
            <>
              <Spinner /> Checking the schedule…
            </>
          )}
          {!checking && scouterId !== null && teamNumber !== null && conflicts.length === 0 && !existing && (
            <Badge variant="secondary">No conflicts</Badge>
          )}
        </div>
        <Button className="h-11 w-full sm:w-auto" disabled={!canSubmit} onClick={() => void onSubmit()}>
          {pending ? <Spinner /> : <UserPlusIcon />}
          {existing ? "Update" : "Assign"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function teamLabel(team: Team) {
  return team.nickname ? `${team.number} · ${team.nickname}` : String(team.number)
}
