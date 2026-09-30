import { PitBadge, TierBadge } from "@/components/teams/team-badges"
import type { TeamRow } from "@/components/teams/team-sort"
import { TeamLink } from "@/components/team-link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsDesktop } from "@/hooks/use-media-query"
import { useOpenTeam } from "@/hooks/use-open-team"
import { formatOpr, formatRank } from "@/lib/format"

/** Team list: cards on phones, a table on desktop. Tapping a team opens its detail modal. */
export function TeamList({
  teams,
  showTier,
  primary,
}: {
  teams: TeamRow[]
  showTier: boolean
  /** Which metric the phone cards show large (the one being sorted by). */
  primary: "rank" | "opr" | "eventRank"
}) {
  const isDesktop = useIsDesktop()
  return isDesktop ? (
    <TeamTable teams={teams} showTier={showTier} />
  ) : (
    <TeamCards teams={teams} showTier={showTier} primary={primary} />
  )
}

function formatEventRank(rank: number | null) {
  return rank === null ? "—" : `#${rank}`
}

function reports(n: number) {
  return `${n} ${n === 1 ? "report" : "reports"}`
}

function TeamCards({ teams, showTier, primary }: { teams: TeamRow[]; showTier: boolean; primary: "rank" | "opr" | "eventRank" }) {
  const openTeam = useOpenTeam()
  return (
    <ul className="flex flex-col gap-2">
      {teams.map((t) => (
        <li key={t.number}>
          <button
            type="button"
            onClick={() => openTeam(t.number)}
            className="flex min-h-16 w-full items-center gap-3 rounded-xl bg-card p-3 text-left text-card-foreground ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted"
          >
            <span className="w-14 shrink-0 font-heading text-lg font-semibold tabular-nums">{t.number}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate font-medium">{t.nickname}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <PitBadge scouted={t.pitScouted} />
                <span>{reports(t.reportCount)}</span>
                {showTier && <TierBadge tier={t.tier} />}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end">
              {primary === "eventRank" ? (
                <>
                  <span className="text-lg font-semibold tabular-nums">{formatEventRank(t.eventRank)}</span>
                  <span className="text-[11px] text-muted-foreground">event rank</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    avg {formatRank(t.avgRank)} · OPR {formatOpr(t.opr)}
                  </span>
                </>
              ) : primary === "opr" ? (
                <>
                  <span className="text-lg font-semibold tabular-nums">{formatOpr(t.opr)}</span>
                  <span className="text-[11px] text-muted-foreground">OPR</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">avg {formatRank(t.avgRank)}</span>
                </>
              ) : (
                <>
                  <span className="text-lg font-semibold tabular-nums">{formatRank(t.avgRank)}</span>
                  <span className="text-[11px] text-muted-foreground">our avg</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">OPR {formatOpr(t.opr)}</span>
                </>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function TeamTable({ teams, showTier }: { teams: TeamRow[]; showTier: boolean }) {
  const openTeam = useOpenTeam()
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-20 pl-3">Team</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Pit</TableHead>
            <TableHead className="text-right">Reports</TableHead>
            <TableHead className="text-right">Event rank</TableHead>
            <TableHead className="text-right">Our avg rank</TableHead>
            <TableHead className="text-right">OPR</TableHead>
            {showTier && <TableHead className="pr-3">Tier</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((t) => (
            <TableRow key={t.number} onClick={() => openTeam(t.number)} className="cursor-pointer">
              <TableCell className="pl-3 font-semibold tabular-nums">
                <TeamLink teamNumber={t.number} />
              </TableCell>
              <TableCell className="max-w-64 truncate">{t.nickname}</TableCell>
              <TableCell>
                <PitBadge scouted={t.pitScouted} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{t.reportCount}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEventRank(t.eventRank)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatRank(t.avgRank)}
                {t.matchesRanked > 0 && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">({t.matchesRanked})</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatOpr(t.opr)}</TableCell>
              {showTier && (
                <TableCell className="pr-3">
                  <TierBadge tier={t.tier} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
