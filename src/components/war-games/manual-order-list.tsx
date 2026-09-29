import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
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
import { toast } from "sonner"

import { TeamLink } from "@/components/team-link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { errorMessage } from "@/lib/errors"
import { formatOpr, formatRank } from "@/lib/format"
import { cn } from "@/lib/utils"
import { fullManualOrder } from "./board"
import { NonTouchPointerSensor } from "./sensors"
import type { WarGameData, WarGameTeam } from "./types"
import { useWarGameMutations } from "./use-war-game-mutations"

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })
const itemId = (team: number) => `order-${team}`
const teamFromId = (id: string | number) => Number(String(id).replace("order-", ""))

function SortableRow({ position, teamNumber, team }: { position: number; teamNumber: number; team?: WarGameTeam }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: itemId(teamNumber),
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-md border bg-card pr-2",
        isDragging && "relative z-10 shadow-lg",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Reorder team ${teamNumber}`}
        className="flex size-11 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-l-md text-muted-foreground outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <span className="w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{position}</span>
      <TeamLink teamNumber={teamNumber} className="min-h-11 shrink-0 tabular-nums" />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{team?.nickname}</span>
      <span className="hidden shrink-0 gap-3 text-xs tabular-nums sm:flex">
        <span>
          <span className="text-muted-foreground">Avg</span> {formatRank(team?.avgRank)}
        </span>
        <span>
          <span className="text-muted-foreground">OPR</span> {formatOpr(team?.opr)}
        </span>
      </span>
    </li>
  )
}

/** Drag-sortable desirability order used by the "Manual order" draft method. */
export function ManualOrderList({ data }: { data: WarGameData }) {
  const { updateSettings } = useWarGameMutations()
  const { scenario, canEdit } = data
  const byRank = [...data.teams].sort((a, b) => a.predictedRank - b.predictedRank)
  const teamsBy = new Map(data.teams.map((t) => [t.teamNumber, t]))
  const order = fullManualOrder(
    scenario.manualOrder,
    byRank.map((t) => t.teamNumber),
  )

  const sensors = useSensors(
    useSensor(NonTouchPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = order.indexOf(teamFromId(active.id))
    const to = order.indexOf(teamFromId(over.id))
    if (from < 0 || to < 0) return
    const manualOrder = arrayMove(order, from, to)
    updateSettings({ warGameId: scenario._id, manualOrder }).catch((e: unknown) => toast.error(errorMessage(e)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual pick order</CardTitle>
        <CardDescription>
          {canEdit
            ? "Drag teams into the order alliances should pick them. Captains still come from predicted rank."
            : "The order alliances pick teams in this scenario."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {order.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams at this event yet.</p>
        ) : canEdit ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={order.map(itemId)} strategy={verticalListSortingStrategy}>
              <ol className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto overscroll-contain pr-1">
                {order.map((t, i) => (
                  <SortableRow key={t} position={i + 1} teamNumber={t} team={teamsBy.get(t)} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        ) : (
          <ol className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto pr-1">
            {order.map((t, i) => (
              <li key={t} className="flex min-h-11 items-center gap-2 rounded-md border bg-card px-2">
                <span className="w-7 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <TeamLink teamNumber={t} className="min-h-11 shrink-0 tabular-nums" />
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{teamsBy.get(t)?.nickname}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
