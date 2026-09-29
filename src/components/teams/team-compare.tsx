import { deltaClass, formatDelta, type ComparePosition, type TeamRow } from "@/components/teams/team-sort"
import { TeamLink } from "@/components/team-link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsDesktop } from "@/hooks/use-media-query"
import { useOpenTeam } from "@/hooks/use-open-team"
import { formatOpr, formatRank } from "@/lib/format"
import { cn } from "@/lib/utils"

const NO_POSITION: ComparePosition = { our: null, opr: null, delta: null }

const pos = (n: number | null) => (n === null ? "—" : `#${n}`)

/** Our-ranking position vs OPR position, with the delta (▲ = we rate them higher than OPR does). */
export function TeamCompare({
  teams,
  positions,
}: {
  teams: TeamRow[]
  positions: Map<number, ComparePosition>
}) {
  const isDesktop = useIsDesktop()
  const openTeam = useOpenTeam()

  if (isDesktop) {
    return (
      <div className="rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20 pl-3">Team</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Our pos.</TableHead>
              <TableHead className="text-right">Our avg rank</TableHead>
              <TableHead className="text-right">OPR pos.</TableHead>
              <TableHead className="text-right">OPR</TableHead>
              <TableHead className="pr-3 text-right">Delta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((t) => {
              const p = positions.get(t.number) ?? NO_POSITION
              return (
                <TableRow key={t.number} onClick={() => openTeam(t.number)} className="cursor-pointer">
                  <TableCell className="pl-3 font-semibold tabular-nums">
                    <TeamLink teamNumber={t.number} />
                  </TableCell>
                  <TableCell className="max-w-56 truncate">{t.nickname}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{pos(p.our)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{formatRank(t.avgRank)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{pos(p.opr)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{formatOpr(t.opr)}</TableCell>
                  <TableCell className={cn("pr-3 text-right font-semibold tabular-nums", deltaClass(p.delta))}>
                    {formatDelta(p.delta)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {teams.map((t) => {
        const p = positions.get(t.number) ?? NO_POSITION
        return (
          <li key={t.number}>
            <button
              type="button"
              onClick={() => openTeam(t.number)}
              className="flex min-h-11 w-full flex-col gap-2 rounded-xl bg-card p-3 text-left text-card-foreground ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-heading text-base font-semibold tabular-nums">{t.number}</span>
                <span className="truncate text-sm text-muted-foreground">{t.nickname}</span>
              </span>
              <span className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Our pos." value={pos(p.our)} sub={formatRank(t.avgRank)} />
                <Metric label="OPR pos." value={pos(p.opr)} sub={formatOpr(t.opr)} />
                <span className="flex flex-col items-center justify-center rounded-lg bg-muted/50 py-1">
                  <span className="text-[11px] text-muted-foreground">Delta</span>
                  <span className={cn("text-lg font-semibold tabular-nums", deltaClass(p.delta))}>
                    {formatDelta(p.delta)}
                  </span>
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <span className="flex flex-col items-center rounded-lg bg-muted/50 py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-lg leading-tight font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-muted-foreground tabular-nums">{sub}</span>
    </span>
  )
}
