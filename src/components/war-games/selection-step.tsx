import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { EraserIcon, LockIcon, LockOpenIcon, SearchIcon, SparklesIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useOpenTeam } from "@/hooks/use-open-team"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { Alliance } from "../../../convex/lib/validators"
import { applyDrop, placedTeams, type BoardLocation } from "./board"
import { NonTouchPointerSensor } from "./sensors"
import { TeamCard } from "./team-card"
import {
  DRAFT_METHODS,
  isDraftMethod,
  METHOD_LABELS,
  SLOT_LABELS,
  type WarGameData,
  type WarGameTeam,
} from "./types"
import { useWarGameMutations } from "./use-war-game-mutations"

type DragData = { team: number; source: BoardLocation }
type DropData = { target: BoardLocation }

const slotId = (alliance: number, slot: number) => `slot-${alliance}-${slot}`
const POOL_ID = "pool"

/** Pointer position first (precise on a dense board), then overlap as a fallback. */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

// ---------------------------------------------------------------------------
// Draggable team + droppable slot / pool
// ---------------------------------------------------------------------------

function DraggableTeam({
  id,
  teamNumber,
  team,
  source,
  disabled,
}: {
  id: string
  teamNumber: number
  team: WarGameTeam | undefined
  source: BoardLocation
  disabled: boolean
}) {
  const openTeam = useOpenTeam()
  const data: DragData = { team: teamNumber, source }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data, disabled })
  return (
    <TeamCard
      ref={setNodeRef}
      teamNumber={teamNumber}
      team={team}
      {...attributes}
      {...listeners}
      // dnd-kit's role="button" is redundant on a <button>.
      role={undefined}
      onClick={() => openTeam(teamNumber)}
      className={cn(!disabled && "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    />
  )
}

function SlotView({
  alliance,
  slot,
  teamNumber,
  locked,
  team,
  canEdit,
  onToggleLock,
}: {
  alliance: number
  slot: number
  teamNumber: number | null
  locked: boolean
  team: WarGameTeam | undefined
  canEdit: boolean
  onToggleLock: () => void
}) {
  const location: BoardLocation = { kind: "slot", alliance, slot }
  const dropData: DropData = { target: location }
  const { setNodeRef, isOver, active } = useDroppable({
    id: slotId(alliance, slot),
    data: dropData,
    disabled: !canEdit || locked,
  })
  const label = SLOT_LABELS[slot] ?? `Slot ${slot + 1}`
  const highlight = isOver && active !== null && active.id !== slotId(alliance, slot)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-2 rounded-lg border p-1.5 transition-colors sm:grid-cols-1 sm:gap-1",
        locked ? "border-amber-500/60 bg-amber-500/10" : "bg-muted/30",
        highlight && "border-primary bg-primary/10 ring-2 ring-primary/40",
      )}
    >
      <div className="flex flex-col items-start justify-center gap-0.5 sm:flex-row sm:items-center sm:justify-between">
        <span
          className={cn(
            "pl-0.5 text-xs font-medium text-muted-foreground",
            locked && "text-amber-700 dark:text-amber-300",
          )}
        >
          {label}
        </span>
        {canEdit ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-11 md:size-7",
              locked && "text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200",
            )}
            aria-pressed={locked}
            aria-label={`${locked ? "Unlock" : "Lock"} alliance ${alliance + 1} ${label.toLowerCase()}`}
            onClick={onToggleLock}
          >
            {locked ? <LockIcon /> : <LockOpenIcon className="opacity-60" />}
          </Button>
        ) : (
          locked && <LockIcon className="size-3.5 text-amber-700 dark:text-amber-300" aria-label="Locked" />
        )}
      </div>
      {teamNumber !== null ? (
        <DraggableTeam
          id={slotId(alliance, slot)}
          teamNumber={teamNumber}
          team={team}
          source={location}
          disabled={!canEdit || locked}
        />
      ) : (
        <div className="flex min-h-14 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          {locked ? "Locked empty" : canEdit ? "Drop a team" : "Empty"}
        </div>
      )}
    </div>
  )
}

function AllianceCard({
  index,
  alliance,
  teamsBy,
  canEdit,
  onToggleLock,
}: {
  index: number
  alliance: Alliance
  teamsBy: ReadonlyMap<number, WarGameTeam>
  canEdit: boolean
  onToggleLock: (slot: number) => void
}) {
  return (
    <Card size="sm" className="gap-2">
      <CardHeader>
        <CardTitle>Alliance {index + 1}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1.5 sm:grid-cols-3">
        {alliance.slots.map((t, s) => (
          <SlotView
            key={s}
            alliance={index}
            slot={s}
            teamNumber={t}
            locked={alliance.locked[s] === true}
            team={t === null ? undefined : teamsBy.get(t)}
            canEdit={canEdit}
            onToggleLock={() => onToggleLock(s)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function UnpickedColumn({
  teams,
  teamsBy,
  canEdit,
}: {
  teams: readonly number[]
  teamsBy: ReadonlyMap<number, WarGameTeam>
  canEdit: boolean
}) {
  const [query, setQuery] = useState("")
  const dropData: DropData = { target: { kind: "pool" } }
  const { setNodeRef, isOver, active } = useDroppable({ id: POOL_ID, data: dropData, disabled: !canEdit })
  const fromSlot = (active?.data.current as DragData | undefined)?.source.kind === "slot"
  const q = query.trim().toLowerCase()
  const shown = q
    ? teams.filter((t) => String(t).includes(q) || (teamsBy.get(t)?.nickname ?? "").toLowerCase().includes(q))
    : teams

  return (
    <Card
      ref={setNodeRef}
      size="sm"
      className={cn(
        "gap-2 lg:sticky lg:top-18 lg:max-h-[calc(100dvh-5.5rem)]",
        isOver && fromSlot && "ring-2 ring-primary/60",
      )}
    >
      <CardHeader>
        <CardTitle>Unpicked teams ({teams.length})</CardTitle>
        <CardDescription>By predicted event rank{canEdit ? ". Drag onto a slot, or drop here to remove." : "."}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Filter teams"
            aria-label="Filter unpicked teams"
            autoComplete="off"
            className="h-11 pl-8 md:h-8"
          />
        </div>
        <div
          className={cn(
            "grid min-h-24 grid-cols-2 content-start gap-1.5 rounded-lg sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1",
            isOver && fromSlot && "bg-primary/5",
          )}
        >
          {shown.map((t) => (
            <DraggableTeam
              key={t}
              id={`pool-${t}`}
              teamNumber={t}
              team={teamsBy.get(t)}
              source={{ kind: "pool" }}
              disabled={!canEdit}
            />
          ))}
          {shown.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              {teams.length === 0 ? "Every team is on the board." : "No matching teams."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function DraftControls({ data }: { data: WarGameData }) {
  const { scenario, canEdit } = data
  const { updateSettings, runDraft, clearBoard } = useWarGameMutations()
  const [drafting, setDrafting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmDraft, setConfirmDraft] = useState(false)

  function onMethod(next: string[]) {
    const method = next[0]
    if (!isDraftMethod(method) || method === scenario.method) return
    updateSettings({ warGameId: scenario._id, method }).catch((e: unknown) => toast.error(errorMessage(e)))
  }

  async function onRunDraft() {
    setDrafting(true)
    try {
      await runDraft({ warGameId: scenario._id })
      toast.success("Alliance selection simulated.")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setDrafting(false)
    }
  }

  async function onClear() {
    setClearing(true)
    try {
      await clearBoard({ warGameId: scenario._id })
      toast.success("Selection board cleared.")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setClearing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alliance selection</CardTitle>
        <CardDescription>
          The auto selection follows FRC rules: top seeds pick in order 1→8, round 2 snakes back 8→1, captains can
          be picked (lower seeds move up), and locked slots are kept.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Pick teams by</span>
          {canEdit ? (
            <ToggleGroup
              aria-label="Pick teams by"
              variant="outline"
              spacing={0}
              value={[scenario.method]}
              onValueChange={onMethod}
              className="grid w-full grid-cols-3 sm:flex sm:w-auto"
            >
              {DRAFT_METHODS.map((m) => (
                <ToggleGroupItem
                  key={m}
                  value={m}
                  className="h-auto min-h-11 px-2 whitespace-normal aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 md:min-h-8 md:px-3"
                >
                  {METHOD_LABELS[m]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : (
            <span className="text-sm text-muted-foreground">{METHOD_LABELS[scenario.method]}</span>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {scenario.method !== "manual" && (
              <AlertDialog open={confirmDraft} onOpenChange={setConfirmDraft}>
                <AlertDialogTrigger render={<Button className="h-11 md:h-9" disabled={drafting} />}>
                  {drafting ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                  Run auto selection
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Run auto selection?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Every unlocked slot on the selection board will be refilled by {METHOD_LABELS[scenario.method]}.
                      Locked slots are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-11 sm:h-8">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="h-11 sm:h-8"
                      onClick={() => {
                        setConfirmDraft(false)
                        void onRunDraft()
                      }}
                    >
                      Run auto selection
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant="outline"
              className="h-11 md:h-9"
              disabled={clearing}
              onClick={() => void onClear()}
            >
              {clearing ? <Spinner data-icon="inline-start" /> : <EraserIcon data-icon="inline-start" />}
              Clear selection board
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export function SelectionStep({ data }: { data: WarGameData }) {
  const { scenario, canEdit } = data
  const { setAlliances, toggleLock } = useWarGameMutations()
  const [dragging, setDragging] = useState<DragData | null>(null)

  const sensors = useSensors(
    useSensor(NonTouchPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const teamsBy = new Map(data.teams.map((t) => [t.teamNumber, t]))
  const placed = placedTeams(scenario.alliances)
  const unpicked = [...data.teams]
    .sort((a, b) => a.predictedRank - b.predictedRank)
    .map((t) => t.teamNumber)
    .filter((t) => !placed.has(t))

  function onDragStart({ active }: DragStartEvent) {
    setDragging((active.data.current as DragData | undefined) ?? null)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null)
    const drag = active.data.current as DragData | undefined
    const drop = over?.data.current as DropData | undefined
    if (!drag || !drop) return
    const next = applyDrop(scenario.alliances, drag.team, drag.source, drop.target)
    if (!next) return
    setAlliances({ warGameId: scenario._id, alliances: next }).catch((e: unknown) => toast.error(errorMessage(e)))
  }

  function onToggleLock(alliance: number, slot: number) {
    toggleLock({ warGameId: scenario._id, alliance, slot }).catch((e: unknown) => toast.error(errorMessage(e)))
  }

  return (
    <div className="flex flex-col gap-6">
      <DraftControls data={data} />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="grid gap-3 xl:grid-cols-2">
            {scenario.alliances.map((a, i) => (
              <AllianceCard
                key={i}
                index={i}
                alliance={a}
                teamsBy={teamsBy}
                canEdit={canEdit}
                onToggleLock={(slot) => onToggleLock(i, slot)}
              />
            ))}
          </div>
          <UnpickedColumn teams={unpicked} teamsBy={teamsBy} canEdit={canEdit} />
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <TeamCard
              teamNumber={dragging.team}
              team={teamsBy.get(dragging.team)}
              tabIndex={-1}
              className="w-44 cursor-grabbing shadow-lg ring-2 ring-primary/50"
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
