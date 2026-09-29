import { useMutation } from "convex/react"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/errors"

import { api } from "../../../convex/_generated/api"
import { MAX_NOTE_LENGTH } from "../../../convex/lib/constants"
import type { Assignment } from "./types"

/** One assigned team: chip, instructions with inline edit, and remove. */
export function AssignmentRow({ assignment }: { assignment: Assignment }) {
  const updateInstructions = useMutation(api.assignments.updateInstructions)
  const remove = useMutation(api.assignments.remove)

  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  const editing = draft !== null

  const onSave = async () => {
    if (draft === null) return
    setSaving(true)
    try {
      await updateInstructions({ assignmentId: assignment._id, instructions: draft })
      toast.success(`Instructions saved for ${assignment.teamNumber}`)
      setDraft(null)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const onRemove = async () => {
    setRemoving(true)
    try {
      await remove({ assignmentId: assignment._id })
      toast.success(`Removed ${assignment.teamNumber} from ${assignment.scouterName}`)
      setConfirmOpen(false)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2">
        <TeamLink
          teamNumber={assignment.teamNumber}
          className="inline-flex min-h-11 min-w-16 items-center justify-center rounded-md border bg-muted px-2.5 font-semibold tabular-nums md:min-h-8"
        />
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{assignment.nickname}</span>
        {!editing && (
          <Button
            variant="ghost"
            size="icon"
            className="size-11 md:size-8"
            aria-label={`Edit instructions for ${assignment.teamNumber}`}
            onClick={() => setDraft(assignment.instructions)}
          >
            <PencilIcon />
          </Button>
        )}
        <AlertDialog open={confirmOpen} onOpenChange={(open) => !removing && setConfirmOpen(open)}>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-11 text-destructive hover:text-destructive md:size-8"
                aria-label={`Remove ${assignment.teamNumber} from ${assignment.scouterName}`}
              />
            }
          >
            <Trash2Icon />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove assignment?</AlertDialogTitle>
              <AlertDialogDescription>
                {assignment.scouterName} will go back to ranking during {assignment.teamNumber}'s matches. Notes they
                already wrote are kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-11 sm:h-8" disabled={removing}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                className="h-11 sm:h-8"
                disabled={removing}
                onClick={() => void onRemove()}
              >
                {removing && <Spinner />}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label={`Instructions for ${assignment.teamNumber}`}
            placeholder="What should they look for?"
            value={draft}
            maxLength={MAX_NOTE_LENGTH}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="h-11 md:h-8" disabled={saving} onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              className="h-11 md:h-8"
              disabled={saving || draft.trim() === assignment.instructions}
              onClick={() => void onSave()}
            >
              {saving && <Spinner />}
              Save
            </Button>
          </div>
        </div>
      ) : assignment.instructions ? (
        <p className="text-sm whitespace-pre-wrap">{assignment.instructions}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No instructions yet.</p>
      )}
    </li>
  )
}
