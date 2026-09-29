import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
  type PointerSensorOptions,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon, NotebookPenIcon } from "lucide-react"
import { useState, type PointerEvent as ReactPointerEvent } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { allianceClasses } from "@/lib/alliance"
import { cn } from "@/lib/utils"
import { MAX_NOTE_LENGTH } from "../../../convex/lib/constants"
import { slotLabel, type TeamSlot } from "./match-utils"

/** Mouse/pen only: touch goes through the TouchSensor (long-press delay) so taps and scrolls don't drag. */
class NonTouchPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!event.isPrimary || event.button !== 0 || event.pointerType === "touch") return false
        onActivation?.({ event })
        return true
      },
    },
  ]
}

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** Sortable 1–6 ranking with drag handles, up/down buttons and per-team notes. */
export function RankingList({
  slots,
  order,
  onOrderChange,
  notes,
  onNoteChange,
  disabled = false,
}: {
  slots: TeamSlot[]
  order: number[]
  onOrderChange: (order: number[]) => void
  notes: Record<number, string>
  onNoteChange: (teamNumber: number, text: string) => void
  disabled?: boolean
}) {
  const sensors = useSensors(
    useSensor(NonTouchPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const slotBy = new Map(slots.map((s) => [s.teamNumber, s]))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = order.indexOf(Number(active.id))
    const to = order.indexOf(Number(over.id))
    if (from < 0 || to < 0) return
    onOrderChange(arrayMove(order, from, to))
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta
    if (to < 0 || to >= order.length) return
    onOrderChange(arrayMove(order, index, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "To pick up a team, press space or enter. Use the arrow keys to move it, then press space or enter to drop it.",
        },
      }}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ol className="flex flex-col gap-2" aria-label="Team ranking, best first">
          {order.map((teamNumber, index) => {
            const slot = slotBy.get(teamNumber)
            if (!slot) return null
            return (
              <RankCard
                key={teamNumber}
                slot={slot}
                rank={index + 1}
                isFirst={index === 0}
                isLast={index === order.length - 1}
                onMove={(delta) => move(index, delta)}
                note={notes[teamNumber] ?? ""}
                onNoteChange={(text) => onNoteChange(teamNumber, text)}
                disabled={disabled}
              />
            )
          })}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function RankCard({
  slot,
  rank,
  isFirst,
  isLast,
  onMove,
  note,
  onNoteChange,
  disabled,
}: {
  slot: TeamSlot
  rank: number
  isFirst: boolean
  isLast: boolean
  onMove: (delta: -1 | 1) => void
  note: string
  onNoteChange: (text: string) => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: slot.teamNumber, disabled })
  const [noteOpen, setNoteOpen] = useState(() => note.trim() !== "")
  const hasNote = note.trim() !== ""
  const label = slotLabel(slot)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative rounded-xl bg-card", isDragging && "z-10 shadow-lg ring-2 ring-ring")}
    >
      <div className={cn("rounded-xl border-2 p-2", allianceClasses[slot.color])}>
        <div className="flex items-stretch gap-2">
          <div className="flex w-12 shrink-0 items-center justify-center font-heading text-4xl font-bold tabular-nums">
            <span className="sr-only">Rank </span>
            {rank}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="font-heading text-2xl font-semibold text-foreground tabular-nums">
                  {slot.teamNumber}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-medium text-foreground">{slot.nickname}</span>
                  <span className="truncate text-xs font-medium uppercase">{label}</span>
                </span>
              </div>
              <button
                type="button"
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                disabled={disabled}
                aria-label={`Drag team ${slot.teamNumber}, rank ${rank}`}
                className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-foreground/70 outline-none hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
              >
                <GripVerticalIcon className="size-6" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="h-11 min-w-0 flex-1 justify-start px-2 text-foreground"
                aria-expanded={noteOpen}
                onClick={() => setNoteOpen((o) => !o)}
              >
                <NotebookPenIcon />
                <span className="truncate">{noteOpen ? "Hide note" : hasNote ? "Edit note" : "Add note"}</span>
                {hasNote && !noteOpen && <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden />}
              </Button>
              <Button
                variant="outline"
                className="size-11 shrink-0"
                aria-label={`Move team ${slot.teamNumber} up`}
                disabled={disabled || isFirst}
                onClick={() => onMove(-1)}
              >
                <ChevronUpIcon className="size-5" />
              </Button>
              <Button
                variant="outline"
                className="size-11 shrink-0"
                aria-label={`Move team ${slot.teamNumber} down`}
                disabled={disabled || isLast}
                onClick={() => onMove(1)}
              >
                <ChevronDownIcon className="size-5" />
              </Button>
            </div>
          </div>
        </div>
        {noteOpen && (
          <Textarea
            className="mt-2 bg-background text-foreground"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={`Notes on ${slot.teamNumber} (optional)`}
            maxLength={MAX_NOTE_LENGTH}
            disabled={disabled}
            aria-label={`Notes on team ${slot.teamNumber}`}
          />
        )}
      </div>
    </li>
  )
}
