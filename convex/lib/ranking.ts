/** Pure rank-averaging helpers. No database access. */
import type { RankEntry } from "./validators"

/** Arithmetic mean; `null` for an empty input. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  let sum = 0
  for (const value of values) sum += value
  return sum / values.length
}

/** Mean of the ranks a team received from each scouter in one match. */
export function matchAverage(ranks: readonly number[]): number | null {
  return mean(ranks)
}

/** Mean of a team's per-match averages. */
export function teamAverage(matchAverages: readonly number[]): number | null {
  return mean(matchAverages)
}

export type RankingSubmission = { scouterId: string; ranks: readonly RankEntry[] }

/** teamNumber → mean rank that `scouterId` alone gave the team across their submissions. */
export function personalAverages(
  rankings: readonly RankingSubmission[],
  scouterId: string,
): Map<number, number> {
  const ranksByTeam = new Map<number, number[]>()
  for (const submission of rankings) {
    if (submission.scouterId !== scouterId) continue
    for (const { teamNumber, rank } of submission.ranks) {
      const list = ranksByTeam.get(teamNumber)
      if (list) list.push(rank)
      else ranksByTeam.set(teamNumber, [rank])
    }
  }

  const result = new Map<number, number>()
  for (const [teamNumber, ranks] of ranksByTeam) {
    const avg = mean(ranks)
    if (avg !== null) result.set(teamNumber, avg)
  }
  return result
}
