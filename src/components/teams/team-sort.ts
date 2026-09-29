import type { FunctionReturnType } from "convex/server"

import type { api } from "../../../convex/_generated/api"
import { COLUMNS, type Column } from "../../../convex/lib/validators"

export type TeamRow = FunctionReturnType<typeof api.teams.list>[number]

export type SortKey = "auto" | "number" | "ourRank" | "opr" | "tier"
export type ConcreteSort = Exclude<SortKey, "auto">

export const SORT_LABELS: Record<SortKey, string> = {
  auto: "Auto",
  number: "Team number",
  ourRank: "Our ranking",
  opr: "OPR",
  tier: "Pick list order",
}
export const SORT_KEYS: readonly SortKey[] = ["auto", "number", "ourRank", "opr", "tier"]

type Cmp = (a: TeamRow, b: TeamRow) => number

/** Ascending (dir 1) or descending (dir -1), nulls always last. */
function nullsLast(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (a - b) * dir
}

const tierIndex = (tier: Column | null) => (tier === null ? null : COLUMNS.indexOf(tier))

const byNumber: Cmp = (a, b) => a.number - b.number
/** avgRank: 1 is best, so ascending. */
const byOurRank: Cmp = (a, b) => nullsLast(a.avgRank, b.avgRank, 1) || byNumber(a, b)
const byOpr: Cmp = (a, b) => nullsLast(a.opr, b.opr, -1) || byNumber(a, b)
/** Exactly as the pick list board shows it: column order, then position within the column. */
const byTier: Cmp = (a, b) =>
  nullsLast(tierIndex(a.tier), tierIndex(b.tier), 1) || nullsLast(a.tierOrder, b.tierOrder, 1) || byNumber(a, b)

const COMPARATORS: Record<ConcreteSort, Cmp> = {
  number: byNumber,
  ourRank: byOurRank,
  opr: byOpr,
  tier: byTier,
}

/** Every team has at least one ranked match. */
export function allRanked(teams: readonly TeamRow[]): boolean {
  return teams.length > 0 && teams.every((t) => t.matchesRanked >= 1)
}

/** "Auto" = team number until every team has been ranked at least once, then our ranking. */
export function resolveSort(sort: SortKey, teams: readonly TeamRow[]): ConcreteSort {
  if (sort !== "auto") return sort
  return allRanked(teams) ? "ourRank" : "number"
}

export function sortTeams(teams: readonly TeamRow[], sort: ConcreteSort): TeamRow[] {
  return [...teams].sort(COMPARATORS[sort])
}

export function matchesSearch(team: TeamRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === "") return true
  return String(team.number).includes(q) || team.nickname.toLowerCase().includes(q)
}

export type ComparePosition = {
  /** 1 = best avgRank among ranked teams. */
  our: number | null
  /** 1 = highest OPR. */
  opr: number | null
  /** opr − our: positive means we rate the team higher than OPR does. */
  delta: number | null
}

/** Competition-style positions (ties share a position: 1, 2, 2, 4). */
function positions(teams: readonly TeamRow[], value: (t: TeamRow) => number | null, dir: 1 | -1) {
  const ranked = teams
    .map((t) => ({ number: t.number, value: value(t) }))
    .filter((t): t is { number: number; value: number } => t.value !== null)
    .sort((a, b) => (a.value - b.value) * dir)
  const out = new Map<number, number>()
  ranked.forEach((t, i) => {
    const prev = ranked[i - 1]
    const tied = prev !== undefined && prev.value === t.value ? out.get(prev.number) : undefined
    out.set(t.number, tied ?? i + 1)
  })
  return out
}

/** Our-rank position vs OPR position for every team (computed over the whole event, not a filter). */
export function comparePositions(teams: readonly TeamRow[]): Map<number, ComparePosition> {
  const our = positions(teams, (t) => t.avgRank, 1)
  const opr = positions(teams, (t) => t.opr, -1)
  return new Map(
    teams.map((t) => {
      const o = our.get(t.number) ?? null
      const p = opr.get(t.number) ?? null
      return [t.number, { our: o, opr: p, delta: o !== null && p !== null ? p - o : null }]
    }),
  )
}

/** "▲3" when we rate a team higher than OPR does, "▼2" when lower, "=" when equal. */
export function formatDelta(delta: number | null): string {
  if (delta === null) return "—"
  if (delta > 0) return `▲${delta}`
  if (delta < 0) return `▼${-delta}`
  return "="
}

export function deltaClass(delta: number | null): string {
  if (delta === null || delta === 0) return "text-muted-foreground"
  return delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
}
