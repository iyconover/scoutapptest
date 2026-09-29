import { ExternalLinkIcon, LockIcon } from "lucide-react"
import type { MouseEvent } from "react"

import { matchWinner, openTba, type HistoryRow, type MatchWinner, type TeamCell } from "@/components/matches/types"
import { TeamChipNotes } from "@/components/team-chip-notes"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsDesktop } from "@/hooks/use-media-query"
import type { AllianceColor } from "@/lib/alliance"
import { formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * TBA-style match list. Phones: one card per match (red over blue). Desktop: a table.
 * Clicking a match opens it on The Blue Alliance; team chips show that match's notes.
 */
export function MatchList({ rows, highlightTeam }: { rows: HistoryRow[]; highlightTeam?: number }) {
  const isDesktop = useIsDesktop()
  if (isDesktop) return <MatchTable rows={rows} highlightTeam={highlightTeam} />
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row._id}>
          <MatchCard row={row} highlightTeam={highlightTeam} />
        </li>
      ))}
    </ul>
  )
}

/** Mouse/touch convenience: the whole row opens TBA. Keyboard users use the explicit link. */
function rowClick(row: HistoryRow) {
  return (event: MouseEvent) => {
    if (event.defaultPrevented) return
    openTba(row.tbaUrl)
  }
}

function TbaLink({ url, number }: { url: string; number: number }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      aria-label={`Open Q${number} on The Blue Alliance`}
      className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:size-7"
    >
      <ExternalLinkIcon className="size-4" />
    </a>
  )
}

function ClosedBadge() {
  return (
    <Badge variant="secondary" className="gap-1">
      <LockIcon />
      Closed
    </Badge>
  )
}

function Score({ value, win, className }: { value: number | null; win: boolean; className?: string }) {
  return (
    <span className={cn("tabular-nums", win ? "font-bold text-foreground" : "text-muted-foreground", className)}>
      {value ?? "—"}
    </span>
  )
}

function scoresKnown(row: HistoryRow) {
  return row.redScore !== null && row.blueScore !== null
}

export function MatchCard({ row, highlightTeam }: { row: HistoryRow; highlightTeam?: number }) {
  const winner = matchWinner(row)
  const time = formatTime(row.scheduledTime)
  return (
    <div
      onClick={rowClick(row)}
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-card p-3 text-card-foreground ring-1 ring-foreground/10",
        row.tbaUrl !== null && "cursor-pointer active:bg-muted/40",
      )}
    >
      <div className="flex min-h-7 items-center gap-2">
        <span className="font-heading text-base font-semibold tabular-nums">Q{row.number}</span>
        {time && <span className="text-xs text-muted-foreground">{time}</span>}
        {row.closed && <ClosedBadge />}
        <span className="flex-1" />
        {row.tbaUrl !== null && <TbaLink url={row.tbaUrl} number={row.number} />}
      </div>
      <AllianceStrip color="red" cells={row.red} row={row} winner={winner} highlightTeam={highlightTeam} />
      <AllianceStrip color="blue" cells={row.blue} row={row} winner={winner} highlightTeam={highlightTeam} />
    </div>
  )
}

function AllianceStrip({
  color,
  cells,
  row,
  winner,
  highlightTeam,
}: {
  color: AllianceColor
  cells: TeamCell[]
  row: HistoryRow
  winner: MatchWinner
  highlightTeam?: number
}) {
  const score = color === "red" ? row.redScore : row.blueScore
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg p-1.5",
        color === "red" ? "bg-red-500/5" : "bg-blue-500/5",
      )}
    >
      <span className="sr-only">{color === "red" ? "Red alliance" : "Blue alliance"}</span>
      <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
        {cells.map((cell) => (
          <TeamChipNotes
            key={cell.teamNumber}
            cell={cell}
            color={color}
            matchNumber={row.number}
            highlighted={cell.teamNumber === highlightTeam}
          />
        ))}
      </div>
      {scoresKnown(row) && (
        <Score value={score} win={winner === color} className="w-10 shrink-0 text-right text-lg" />
      )}
    </div>
  )
}

export function MatchTable({ rows, highlightTeam }: { rows: HistoryRow[]; highlightTeam?: number }) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-32">Match</TableHead>
            <TableHead colSpan={3} className="text-center text-red-700 dark:text-red-300">
              Red alliance
            </TableHead>
            <TableHead colSpan={3} className="text-center text-blue-700 dark:text-blue-300">
              Blue alliance
            </TableHead>
            <TableHead colSpan={2} className="w-28 text-center">
              Scores
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const winner = matchWinner(row)
            const known = scoresKnown(row)
            const time = formatTime(row.scheduledTime)
            return (
              <TableRow
                key={row._id}
                onClick={rowClick(row)}
                className={cn(row.tbaUrl !== null && "cursor-pointer")}
              >
                <TableCell className="py-1.5">
                  <div className="flex items-center gap-1">
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5 font-semibold tabular-nums">
                        Q{row.number}
                        {row.closed && (
                          <LockIcon className="size-3.5 text-muted-foreground" aria-label="Closed" />
                        )}
                      </span>
                      {time && <span className="truncate text-xs text-muted-foreground">{time}</span>}
                    </div>
                    <span className="flex-1" />
                    {row.tbaUrl !== null && <TbaLink url={row.tbaUrl} number={row.number} />}
                  </div>
                </TableCell>
                {row.red.map((cell) => (
                  <TableCell key={`r${cell.teamNumber}`} className="px-1 py-1.5">
                    <TeamChipNotes
                      cell={cell}
                      color="red"
                      matchNumber={row.number}
                      highlighted={cell.teamNumber === highlightTeam}
                    />
                  </TableCell>
                ))}
                {row.blue.map((cell) => (
                  <TableCell key={`b${cell.teamNumber}`} className="px-1 py-1.5">
                    <TeamChipNotes
                      cell={cell}
                      color="blue"
                      matchNumber={row.number}
                      highlighted={cell.teamNumber === highlightTeam}
                    />
                  </TableCell>
                ))}
                <TableCell className="bg-red-500/5 text-center">
                  {known ? <Score value={row.redScore} win={winner === "red"} /> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="bg-blue-500/5 text-center">
                  {known ? <Score value={row.blueScore} win={winner === "blue"} /> : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
