import { EyeIcon } from "lucide-react"

import { TeamLink } from "@/components/team-link"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { allianceClasses } from "@/lib/alliance"
import { cn } from "@/lib/utils"
import { MAX_NOTE_LENGTH } from "../../../convex/lib/constants"
import { MatchTeams } from "./match-teams"
import { slotLabel, type CurrentMatch, type CurrentScouting, type TeamSlot } from "./match-utils"

/** Assigned scouters: all six teams for context, notes only for their assigned teams. */
export function AssignedNotes({
  match,
  slots,
  assignments,
  notes,
  onNoteChange,
  disabled = false,
}: {
  match: CurrentMatch
  slots: TeamSlot[]
  assignments: CurrentScouting["myAssignments"]
  notes: Record<number, string>
  onNoteChange: (teamNumber: number, text: string) => void
  disabled?: boolean
}) {
  const slotBy = new Map(slots.map((s) => [s.teamNumber, s]))
  const assigned = new Set(assignments.map((a) => a.teamNumber))

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-xl border bg-card p-3">
        <h2 className="text-sm font-semibold">All teams this match</h2>
        <MatchTeams match={match} highlight={assigned} />
        <p className="text-xs text-muted-foreground">Circled teams are yours to watch.</p>
      </section>

      {assignments.map((a) => {
        const slot = slotBy.get(a.teamNumber)
        const id = `assigned-note-${a.teamNumber}`
        return (
          <section
            key={a.assignmentId}
            className={cn(
              "flex flex-col gap-3 rounded-xl border-2 p-3",
              slot ? allianceClasses[slot.color] : "border-border",
            )}
          >
            <div className="flex items-baseline gap-2">
              <TeamLink teamNumber={a.teamNumber} className="font-heading text-3xl font-semibold text-foreground tabular-nums">
                {a.teamNumber}
              </TeamLink>
              {slot?.nickname && <span className="truncate text-sm font-medium text-foreground">{slot.nickname}</span>}
              {slot && <span className="text-xs font-medium uppercase">{slotLabel(slot)}</span>}
            </div>
            <div className="flex gap-2 rounded-lg bg-background/70 p-3 text-foreground">
              <EyeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm whitespace-pre-wrap">
                <span className="font-semibold">Watch for: </span>
                {a.instructions.trim() || "No specific instructions. Note anything that stands out."}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id} className="text-foreground">
                Your notes on {a.teamNumber}
              </Label>
              <Textarea
                id={id}
                className="min-h-28 bg-background text-foreground"
                value={notes[a.teamNumber] ?? ""}
                onChange={(e) => onNoteChange(a.teamNumber, e.target.value)}
                placeholder="What did you see?"
                maxLength={MAX_NOTE_LENGTH}
                disabled={disabled}
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}
