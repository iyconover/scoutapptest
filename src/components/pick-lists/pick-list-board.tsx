import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
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
import { GripVerticalIcon } from "lucide-react"
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { Id } from "../../../convex/_generated/dataModel"
import { orderBetween } from "../../../convex/lib/ordering"
import { COLUMN_LABELS, COLUMNS, type Column } from "../../../convex/lib/validators"
import { groupEntries, isColumn, type BoardColumns, type PickListEntry } from "./board-utils"
import { GripIcon, TeamCardView, type CardMoveTarget } from "./team-card"
import { useMoveEntry, useSetSelected } from "./use-pick-list-mutations"

/** Mouse/pen only: touch goes through the TouchSensor (long-press) so taps and scrolling don't start a drag. */
class MousePointerSensor extends PointerSensor {
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

const COLUMN_ACCENT: Record<Column, string> = {
  tier1: "border-t-emerald-500",
  tier2: "border-t-sky-500",
  tier3: "border-t-amber-500",
  dnp: "border-t-destructive",
  uncategorized: "border-t-border",
}

/** Five-column kanban. Editors drag cards (or use the card menu); everyone can mark teams selected. */
export function PickListBoard({
  listId,
  entries,
  canEdit,
}: {
  listId: Id<"pickLists">
  entries: PickListEntry[]
  canEdit: boolean
}) {
  const moveEntry = useMoveEntry()
  const setSelected = useSetSelected()

  const serverColumns = useMemo(() => groupEntries(entries), [entries])
  const byTeam = useMemo(() => new Map(entries.map((e) => [e.teamNumber, e])), [entries])

  // Local override only while a drag is in progress; the (optimistically updated) query takes over on drop.
  const dragRef = useRef<BoardColumns | null>(null)
  const [dragColumns, setDragColumns] = useState<BoardColumns | null>(null)
  const [activeTeam, setActiveTeam] = useState<number | null>(null)
  const columns = dragColumns ?? serverColumns

  const columnRefs = useRef<Partial<Record<Column, HTMLElement | null>>>({})

  const sensors = useSensors(
    useSensor(MousePointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function updateDrag(next: BoardColumns | null) {
    dragRef.current = next
    setDragColumns(next)
  }

  function findColumn(id: string | number, cols: BoardColumns): Column | null {
    if (isColumn(id)) return id
    const team = Number(id)
    return COLUMNS.find((c) => cols[c].includes(team)) ?? null
  }

  async function commitMove(teamNumber: number, column: Column, order: number) {
    try {
      await moveEntry({ listId, teamNumber, column, order })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  /** Compute the fractional order from the neighbours at `index` in `items` (which already contains the team). */
  function orderAt(items: number[], index: number) {
    const prev = items[index - 1]
    const next = items[index + 1]
    return orderBetween(
      prev === undefined ? undefined : byTeam.get(prev)?.order,
      next === undefined ? undefined : byTeam.get(next)?.order,
    )
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveTeam(Number(active.id))
    updateDrag(serverColumns)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const cols = dragRef.current
    if (!cols || !over) return
    const from = findColumn(active.id, cols)
    const to = findColumn(over.id, cols)
    if (!from || !to || from === to) return

    const team = Number(active.id)
    const target = cols[to]
    let index = target.length
    if (!isColumn(over.id)) {
      const overIndex = target.indexOf(Number(over.id))
      const translated = active.rect.current.translated
      const below = translated !== null && translated.top > over.rect.top + over.rect.height / 2
      if (overIndex >= 0) index = overIndex + (below ? 1 : 0)
    }
    updateDrag({
      ...cols,
      [from]: cols[from].filter((t) => t !== team),
      [to]: [...target.slice(0, index), team, ...target.slice(index)],
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const cols = dragRef.current
    setActiveTeam(null)
    const team = Number(active.id)
    const original = byTeam.get(team)
    if (!cols || !over || !original) {
      updateDrag(null)
      return
    }
    const column = findColumn(active.id, cols)
    if (!column) {
      updateDrag(null)
      return
    }
    let items = cols[column]
    if (!isColumn(over.id) && findColumn(over.id, cols) === column) {
      const from = items.indexOf(team)
      const to = items.indexOf(Number(over.id))
      if (from >= 0 && to >= 0 && from !== to) items = arrayMove(items, from, to)
    }
    const index = items.indexOf(team)

    const serverItems = serverColumns[column]
    const serverIndex = serverItems.indexOf(team)
    const unchanged =
      original.column === column &&
      serverItems[serverIndex - 1] === items[index - 1] &&
      serverItems[serverIndex + 1] === items[index + 1]
    if (!unchanged) void commitMove(team, column, orderAt(items, index))
    // Clear the override in the same tick as the optimistic update so the board doesn't jump.
    updateDrag(null)
  }

  function handleDragCancel() {
    setActiveTeam(null)
    updateDrag(null)
  }

  function handleMenuMove(team: number, { column, position }: CardMoveTarget) {
    const items = serverColumns[column].filter((t) => t !== team)
    const next = position === "top" ? [team, ...items] : [...items, team]
    const index = position === "top" ? 0 : next.length - 1
    const original = byTeam.get(team)
    if (original && original.column === column && serverColumns[column][index] === team) return
    void commitMove(team, column, orderAt(next, index))
  }

  async function toggleSelected(entry: PickListEntry) {
    try {
      await setSelected({ teamNumber: entry.teamNumber, selected: !entry.selected })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const activeEntry = activeTeam === null ? undefined : byTeam.get(activeTeam)

  return (
    <div className="flex flex-col gap-3">
      {/* Phones: jump between the horizontally scrolling columns. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:hidden" role="group" aria-label="Jump to column">
        {COLUMNS.map((c) => (
          <Button
            key={c}
            variant="outline"
            className="h-11 shrink-0"
            onClick={() =>
              columnRefs.current[c]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })
            }
          >
            {COLUMN_LABELS[c]}
            <span className="text-muted-foreground tabular-nums">{columns[c].length}</span>
          </Button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "To pick up a team, press space or enter. Use the arrow keys to move it within or between columns, then press space or enter to drop it.",
          },
        }}
      >
        <div
          className={cn(
            "-mx-4 grid snap-x scroll-px-4 auto-cols-[minmax(min(82vw,17rem),1fr)] grid-flow-col gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6",
            activeTeam === null && "snap-mandatory",
          )}
        >
          {COLUMNS.map((column) => (
            <BoardColumn
              key={column}
              column={column}
              teams={columns[column]}
              canEdit={canEdit}
              sectionRef={(el) => {
                columnRefs.current[column] = el
              }}
            >
              {columns[column].map((team) => {
                const entry = byTeam.get(team)
                if (!entry) return null
                return (
                  <SortableTeamCard
                    key={team}
                    entry={entry}
                    canEdit={canEdit}
                    onToggleSelected={() => void toggleSelected(entry)}
                    onMove={(target) => handleMenuMove(team, target)}
                  />
                )
              })}
            </BoardColumn>
          ))}
        </div>
        <DragOverlay>
          {activeEntry ? <TeamCardView entry={activeEntry} handle={<GripIcon />} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function BoardColumn({
  column,
  teams,
  canEdit,
  sectionRef,
  children,
}: {
  column: Column
  teams: number[]
  canEdit: boolean
  sectionRef: (el: HTMLElement | null) => void
  children: ReactNode
}) {
  // The column itself is a droppable so empty columns accept drops.
  const { setNodeRef, isOver } = useDroppable({ id: column, disabled: !canEdit })
  const labelId = `pick-column-${column}`
  return (
    <section
      ref={sectionRef}
      aria-labelledby={labelId}
      className={cn(
        "flex min-w-0 snap-start flex-col rounded-xl border-t-4 bg-muted/50 ring-1 ring-foreground/5 dark:bg-muted/30",
        COLUMN_ACCENT[column],
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1">
        <h2 id={labelId} className="text-sm font-semibold">
          {COLUMN_LABELS[column]}
        </h2>
        <Badge variant="secondary" className="tabular-nums" aria-label={`${teams.length} teams`}>
          {teams.length}
        </Badge>
      </header>
      <SortableContext id={column} items={teams} strategy={verticalListSortingStrategy} disabled={!canEdit}>
        <ul
          ref={setNodeRef}
          className={cn(
            "flex min-h-28 flex-1 flex-col gap-2 rounded-b-xl p-2 transition-colors",
            isOver && "bg-primary/5",
          )}
        >
          {children}
          {teams.length === 0 && (
            <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {canEdit ? "Drop teams here" : "No teams"}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  )
}

function SortableTeamCard({
  entry,
  canEdit,
  onToggleSelected,
  onMove,
}: {
  entry: PickListEntry
  canEdit: boolean
  onToggleSelected: () => void
  onMove: (target: CardMoveTarget) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.teamNumber, disabled: !canEdit })

  const handle = canEdit ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Drag team ${entry.teamNumber}`}
      className="flex w-8 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-l-lg text-muted-foreground outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
    >
      <GripVerticalIcon className="size-4" />
    </button>
  ) : undefined

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-30")}
    >
      <TeamCardView
        entry={entry}
        handle={handle}
        onToggleSelected={onToggleSelected}
        onMove={canEdit ? onMove : undefined}
      />
    </li>
  )
}
