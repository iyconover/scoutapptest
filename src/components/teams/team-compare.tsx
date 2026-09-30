import { useMemo, useState } from "react"

import {
  COMPARE_LABELS,
  deltaClass,
  formatDelta,
  metricPositions,
  type CompareMetric,
  type TeamRow,
} from "@/components/teams/team-sort"
import { useOpenTeam } from "@/hooks/use-open-team"
import { formatOpr, formatRank } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { Column } from "../../../convex/lib/validators"

const TIER_SHORT: Record<Column, string> = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
  dnp: "DNP",
  uncategorized: "—",
}

function formatMetric(t: TeamRow, metric: CompareMetric): string {
  switch (metric) {
    case "eventRank":
      return t.eventRank === null ? "—" : `#${t.eventRank}`
    case "ourRank":
      return formatRank(t.avgRank)
    case "opr":
      return formatOpr(t.opr)
    case "tier":
      return t.tier === null ? "—" : TIER_SHORT[t.tier]
  }
}

/** Ascending by position, unpositioned teams last (by team number). */
function byPosition(teams: TeamRow[], position: (t: TeamRow) => number | null) {
  return [...teams].sort((a, b) => {
    const pa = position(a)
    const pb = position(b)
    if (pa === null && pb === null) return a.number - b.number
    if (pa === null) return 1
    if (pb === null) return -1
    return pa - pb || a.number - b.number
  })
}

/**
 * Two lists side by side, each ordered by a chosen metric.
 * Delta (▲ = the left metric rates them higher than the right one) shows on the left side only.
 * Positions come from `allTeams` so a search filter doesn't renumber them.
 * Hovering or focusing a team highlights it in both lists.
 */
export function TeamCompare({
  teams,
  allTeams,
  left,
  right,
}: {
  teams: TeamRow[]
  allTeams: TeamRow[]
  left: CompareMetric
  right: CompareMetric
}) {
  const [active, setActive] = useState<number | null>(null)
  const leftPos = useMemo(() => metricPositions(allTeams, left), [allTeams, left])
  const rightPos = useMemo(() => metricPositions(allTeams, right), [allTeams, right])
  const pos = (m: Map<number, number>, t: TeamRow) => m.get(t.number) ?? null
  const delta = (t: TeamRow) => {
    const l = pos(leftPos, t)
    const r = pos(rightPos, t)
    return l !== null && r !== null ? r - l : null
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <CompareColumn
        title={COMPARE_LABELS[left]}
        rows={byPosition(teams, (t) => pos(leftPos, t))}
        position={(t) => pos(leftPos, t)}
        value={(t) => formatMetric(t, left)}
        delta={delta}
        active={active}
        onActive={setActive}
      />
      <CompareColumn
        title={COMPARE_LABELS[right]}
        rows={byPosition(teams, (t) => pos(rightPos, t))}
        position={(t) => pos(rightPos, t)}
        value={(t) => formatMetric(t, right)}
        active={active}
        onActive={setActive}
      />
    </div>
  )
}
function CompareColumn({
  title,
  rows,
  position,
  value,
  delta,
  active,
  onActive,
}: {
  title: string
  rows: TeamRow[]
  position: (t: TeamRow) => number | null
  value: (t: TeamRow) => string
  delta?: (t: TeamRow) => number | null
  active: number | null
  onActive: (team: number | null) => void
}) {
  const openTeam = useOpenTeam()
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="px-1 font-heading text-sm font-semibold">{title}</h2>
      <ol className="flex flex-col gap-1.5" onMouseLeave={() => onActive(null)}>
        {rows.map((t) => {
          const p = position(t)
          const d = delta?.(t)
          return (
            <li key={t.number}>
              <button
                type="button"
                onClick={() => openTeam(t.number)}
                onMouseEnter={() => onActive(t.number)}
                onFocus={() => onActive(t.number)}
                onBlur={() => onActive(null)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-lg bg-card px-2 py-1.5 text-left ring-1 ring-foreground/10 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-3",
                  active === t.number && "bg-muted ring-2 ring-ring",
                )}
              >
                <span className="w-7 shrink-0 text-xs text-muted-foreground tabular-nums sm:w-8 sm:text-sm">
                  {p === null ? "—" : `#${p}`}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-semibold tabular-nums">{t.number}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:block">{t.nickname}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  <span className="text-sm tabular-nums">{value(t)}</span>
                  {d !== undefined && (
                    <span className={cn("text-xs font-semibold tabular-nums", deltaClass(d))}>{formatDelta(d)}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
