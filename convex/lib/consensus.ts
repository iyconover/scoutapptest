import { COLUMNS, type Column } from "./validators"

export type ListForMerge = {
  entries: readonly { teamNumber: number; column: Column; order: number }[]
}

export type MergeResult = {
  teamNumber: number
  column: Column
  /** Consensus score (lower is better); null for dnp/uncategorized results. */
  score: number | null
  /** Number of source lists that placed the team in tier1–3 or dnp. */
  votes: number
}

/** Tier columns; tier number = index + 1. */
const TIER_COLUMNS: readonly Column[] = ["tier1", "tier2", "tier3"]

type Tally = { tierVotes: number[]; dnp: number }

/**
 * Consensus merge of several pick lists.
 * - Vote from one list = tier (1–3) + (0-based position within that tier / tier size).
 * - Uncategorized = no vote. DNP counts toward `votes` but not the score.
 * - If DNP placements ≥ 50% of the lists that placed the team → "dnp".
 * - Else score = mean of tier votes; column = tier ⌊score⌋ clamped to 1..3.
 * - Teams with no votes → "uncategorized".
 * Output contains every team in `allTeams`, ordered by column (COLUMNS order),
 * then score ascending (dnp/uncategorized by team number).
 */
export function mergePickLists(
  lists: readonly ListForMerge[],
  allTeams: readonly number[],
): MergeResult[] {
  const tallies = new Map<number, Tally>()
  const tallyFor = (teamNumber: number): Tally => {
    let tally = tallies.get(teamNumber)
    if (!tally) {
      tally = { tierVotes: [], dnp: 0 }
      tallies.set(teamNumber, tally)
    }
    return tally
  }

  for (const list of lists) {
    // A team contributes at most one vote per list (its first entry).
    const seen = new Set<number>()
    const entries = list.entries.filter((entry) => {
      if (seen.has(entry.teamNumber)) return false
      seen.add(entry.teamNumber)
      return true
    })

    for (const entry of entries) {
      if (entry.column === "dnp") tallyFor(entry.teamNumber).dnp++
    }

    TIER_COLUMNS.forEach((column, tierIndex) => {
      const tier = tierIndex + 1
      const inTier = entries
        .filter((entry) => entry.column === column)
        .sort((a, b) => a.order - b.order)
      inTier.forEach((entry, index) => {
        tallyFor(entry.teamNumber).tierVotes.push(tier + index / inTier.length)
      })
    })
  }

  const results: MergeResult[] = []
  const emitted = new Set<number>()
  for (const teamNumber of allTeams) {
    if (emitted.has(teamNumber)) continue
    emitted.add(teamNumber)

    const tally = tallies.get(teamNumber)
    const votes = tally ? tally.tierVotes.length + tally.dnp : 0
    if (!tally || votes === 0) {
      results.push({ teamNumber, column: "uncategorized", score: null, votes: 0 })
      continue
    }
    if (tally.dnp * 2 >= votes) {
      results.push({ teamNumber, column: "dnp", score: null, votes })
      continue
    }
    let sum = 0
    for (const vote of tally.tierVotes) sum += vote
    const score = sum / tally.tierVotes.length
    const tier = Math.min(3, Math.max(1, Math.floor(score)))
    const column = TIER_COLUMNS[tier - 1] ?? "tier3"
    results.push({ teamNumber, column, score, votes })
  }

  const columnIndex = (column: Column): number => COLUMNS.indexOf(column)
  return results.sort((a, b) => {
    const byColumn = columnIndex(a.column) - columnIndex(b.column)
    if (byColumn !== 0) return byColumn
    if (a.score !== null && b.score !== null && a.score !== b.score) return a.score - b.score
    return a.teamNumber - b.teamNumber
  })
}
