import type { FunctionReturnType } from "convex/server"

import type { api } from "../../../convex/_generated/api"

/** One match row, exactly as returned by `matches.history` (also `teams.detail.matches`). */
export type HistoryRow = FunctionReturnType<typeof api.matches.history>[number]
/** One team in a match row: our per-match average + that match's notes. */
export type TeamCell = HistoryRow["red"][number]

export type MatchWinner = "red" | "blue" | "tie" | null

/** Winner from final scores; null until both scores are known. */
export function matchWinner(row: Pick<HistoryRow, "redScore" | "blueScore">): MatchWinner {
  if (row.redScore === null || row.blueScore === null) return null
  if (row.redScore > row.blueScore) return "red"
  if (row.blueScore > row.redScore) return "blue"
  return "tie"
}

/** Open a match on The Blue Alliance in a new tab. */
export function openTba(url: string | null) {
  if (url !== null) window.open(url, "_blank", "noopener,noreferrer")
}
