import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  CircleCheckBigIcon,
  CircleIcon,
  EllipsisVerticalIcon,
  GripVerticalIcon,
  MoveRightIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { TeamLink } from "@/components/team-link"
import { deltaClass, formatDelta } from "@/components/teams/team-sort"
import { useTeamDeltas } from "@/components/teams/use-team-deltas"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatRank } from "@/lib/format"
import { cn } from "@/lib/utils"
import { COLUMN_LABELS, COLUMNS, type Column } from "../../../convex/lib/validators"
import type { PickListEntry } from "./board-utils"
import { useIsHighlighted } from "./highlight"

export type CardMoveTarget = { column: Column; position: "top" | "bottom" }

/** Presentational team card, shared by the sortable item and the drag overlay. */
export function TeamCardView({
  entry,
  handle,
  onToggleSelected,
  onMove,
  overlay = false,
}: {
  entry: PickListEntry
  /** Drag handle (editors only). */
  handle?: ReactNode
  onToggleSelected?: () => void
  /** Present only when the viewer can edit the list. */
  onMove?: (target: CardMoveTarget) => void
  overlay?: boolean
}) {
  const { teamNumber, nickname, avgRank, selected, column } = entry
  const delta = useTeamDeltas().get(teamNumber)?.delta ?? null
  const highlighted = useIsHighlighted(teamNumber) && !overlay
  return (
    <div
      data-team={overlay ? undefined : teamNumber}
      className={cn(
        "flex items-stretch rounded-lg bg-card text-card-foreground ring-1 ring-foreground/10 transition-shadow",
        overlay ? "cursor-grabbing shadow-lg ring-2 ring-ring/50" : "shadow-xs",
        highlighted && "bg-primary/10 ring-2 ring-primary",
      )}
    >
      {handle}
      <TeamLink
        teamNumber={teamNumber}
        className={cn(
          "group/team flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center gap-0.5 py-2 text-left font-normal hover:no-underline",
          !handle && "pl-3",
          selected && "opacity-40",
        )}
      >
        <span className="flex w-full items-baseline gap-2">
          <span
            className={cn(
              "text-base font-bold tabular-nums underline-offset-4 group-hover/team:underline",
              selected && "line-through",
            )}
          >
            {teamNumber}
          </span>
          <span className="ml-auto shrink-0 pr-1 text-xs text-muted-foreground tabular-nums">
            Avg {formatRank(avgRank)}
            {delta !== null && (
              <span className={cn("ml-1.5 font-semibold", deltaClass(delta))} title="Our rank vs OPR position">
                {formatDelta(delta)}
              </span>
            )}
          </span>
        </span>
        <span className="w-full truncate text-xs text-muted-foreground">{nickname || "—"}</span>
      </TeamLink>
      <div className="flex shrink-0 items-center pr-1">
        {onToggleSelected && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:size-8"
                  aria-pressed={selected}
                  aria-label={selected ? `Unmark ${teamNumber} as selected` : `Mark ${teamNumber} as selected`}
                  onClick={onToggleSelected}
                />
              }
            >
              {selected ? (
                <CircleCheckBigIcon className="text-primary" />
              ) : (
                <CircleIcon className="text-muted-foreground" />
              )}
            </TooltipTrigger>
            <TooltipContent>{selected ? "Unmark selected" : "Mark selected (already picked)"}</TooltipContent>
          </Tooltip>
        )}
        {onMove && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:size-8"
                  aria-label={`Move team ${teamNumber}`}
                />
              }
            >
              <EllipsisVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem className="min-h-10 md:min-h-8" onClick={() => onMove({ column, position: "top" })}>
                  <ArrowUpToLineIcon />
                  Move to top
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-10 md:min-h-8"
                  onClick={() => onMove({ column, position: "bottom" })}
                >
                  <ArrowDownToLineIcon />
                  Move to bottom
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Move to column</DropdownMenuLabel>
                {COLUMNS.filter((c) => c !== column).map((c) => (
                  <DropdownMenuItem
                    key={c}
                    className="min-h-10 md:min-h-8"
                    onClick={() => onMove({ column: c, position: "bottom" })}
                  >
                    <MoveRightIcon />
                    {COLUMN_LABELS[c]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

/** Visual-only grip used in the drag overlay (the real handle lives in the sortable item). */
export function GripIcon() {
  return (
    <span className="flex w-8 shrink-0 items-center justify-center text-muted-foreground">
      <GripVerticalIcon className="size-4" />
    </span>
  )
}
