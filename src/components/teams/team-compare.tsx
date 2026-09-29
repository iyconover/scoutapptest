import { useState } from "react"

import { deltaClass, formatDelta, type ComparePosition, type TeamRow } from "@/components/teams/team-sort"
import { useOpenTeam } from "@/hooks/use-open-team"
import { formatOpr, formatRank } from "@/lib/format"
import { cn } from "@/lib/utils"

const NO_POSITION: ComparePosition = { our: null, opr: null, delta: null }

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
 * Two lists side by side: teams ordered by our ranking and by OPR.
 * Delta (▲ = we rate them higher than OPR does) shows on our-ranking side only.
 * Hovering or focusing a team highlights it in both lists.
 */
export function TeamCompare({
  teams,
  positions,
}: {
  teams: TeamRow[]
  positions: Map<number, ComparePosition>
}) {
  const [active, setActive] = useState<number | null>(null)
  const get = (t: TeamRow) => positions.get(t.number) ?? NO_POSITION

  const ours = byPosition(teams, (t) => get(t).our)
  const opr = byPosition(teams, (t) => get(t).opr)

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4">
      <CompareColumn
        title="Our ranking"
        rows={ours}
        position={(t) => get(t).our}
        value={(t) => formatRank(t.avgRank)}
        delta={(t) => get(t).delta}
        active={active}
        onActive={setActive}
      />
      <CompareColumn
        title="Blue Alliance OPR"
        rows={opr}
        position={(t) => get(t).opr}
        value={(t) => formatOpr(t.opr)}
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
