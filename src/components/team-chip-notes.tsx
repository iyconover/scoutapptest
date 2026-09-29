import { MessageSquareTextIcon, UsersIcon } from "lucide-react"
import { useState, type MouseEvent } from "react"

import type { TeamCell } from "@/components/matches/types"
import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsDesktop } from "@/hooks/use-media-query"
import { useOpenTeam } from "@/hooks/use-open-team"
import { allianceClasses, type AllianceColor } from "@/lib/alliance"
import { formatRank } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Keep clicks (which bubble through portals in React) away from a clickable match row. */
const stop = (event: MouseEvent) => event.stopPropagation()

/**
 * A red/blue team chip in a match row. Desktop: hover shows that team's notes for this match.
 * Phone: tap opens the same content in a popover. Either way, "View team" opens team detail.
 */
export function TeamChipNotes({
  cell,
  color,
  matchNumber,
  highlighted = false,
  className,
}: {
  cell: TeamCell
  color: AllianceColor
  matchNumber: number
  highlighted?: boolean
  className?: string
}) {
  const isDesktop = useIsDesktop()
  const openTeam = useOpenTeam()
  const [open, setOpen] = useState(false)

  const viewTeam = () => {
    setOpen(false)
    openTeam(cell.teamNumber)
  }

  const chipClass = cn(
    "flex min-h-11 w-full min-w-0 flex-col items-center justify-center rounded-md border px-1.5 py-1 leading-tight transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-10",
    allianceClasses[color],
    color === "red" ? "hover:bg-red-500/20" : "hover:bg-blue-500/20",
    highlighted && "ring-2 ring-foreground/70 font-bold",
    className,
  )
  const label = `Team ${cell.teamNumber}, our average ${formatRank(cell.avgRank)}${
    cell.notes.length > 0 ? `, ${cell.notes.length} notes` : ""
  }`
  const chipBody = (
    <>
      <span className={cn("text-sm tabular-nums", highlighted ? "font-bold underline underline-offset-2" : "font-semibold")}>
        {cell.teamNumber}
      </span>
      <span className="flex items-center gap-1 text-[11px] font-normal tabular-nums opacity-80">
        {formatRank(cell.avgRank)}
        {cell.notes.length > 0 && <MessageSquareTextIcon className="size-3" aria-hidden />}
      </span>
    </>
  )

  const content = (
    <ChipNotesContent cell={cell} color={color} matchNumber={matchNumber} onViewTeam={viewTeam} />
  )

  if (isDesktop) {
    return (
      <HoverCard open={open} onOpenChange={setOpen}>
        <HoverCardTrigger
          delay={250}
          closeDelay={200}
          render={<button type="button" aria-label={label} />}
          className={chipClass}
          onClick={(event) => {
            event.stopPropagation()
            viewTeam()
          }}
        >
          {chipBody}
        </HoverCardTrigger>
        <HoverCardContent className="w-72" onClick={stop}>
          {content}
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={label} className={chipClass} onClick={stop}>
        {chipBody}
      </PopoverTrigger>
      <PopoverContent className="w-[min(18rem,calc(100vw-2rem))]" onClick={stop}>
        {content}
      </PopoverContent>
    </Popover>
  )
}

function ChipNotesContent({
  cell,
  color,
  matchNumber,
  onViewTeam,
}: {
  cell: TeamCell
  color: AllianceColor
  matchNumber: number
  onViewTeam: () => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading font-semibold">
            <span className={cn("mr-1.5 inline-block size-2 rounded-full", color === "red" ? "bg-red-500" : "bg-blue-500")} />
            Team {cell.teamNumber} · Q{matchNumber}
          </span>
          <span className="text-xs text-muted-foreground">
            Our avg ranking this match: <span className="font-medium text-foreground tabular-nums">{formatRank(cell.avgRank)}</span>
          </span>
        </div>
      </div>
      {cell.notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes</p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {cell.notes.map((note, index) => (
            <li key={index} className="rounded-md bg-muted/60 px-2 py-1.5">
              <p className="text-xs font-medium text-muted-foreground">{note.authorName}</p>
              <p className="text-sm break-words whitespace-pre-wrap">{note.text}</p>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" className="h-10 md:h-8" onClick={onViewTeam}>
        <UsersIcon data-icon="inline-start" />
        View team
      </Button>
    </div>
  )
}
