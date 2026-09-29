import type { FunctionReturnType } from "convex/server"

import type { api } from "../../../convex/_generated/api"
import type { DraftMethod } from "../../../convex/lib/validators"

export type WarGameData = NonNullable<FunctionReturnType<typeof api.warGames.get>>
export type WarGameScenario = WarGameData["scenario"]
export type WarGameTeam = WarGameData["teams"][number]
export type WarGamePrediction = WarGameData["predictions"][number]
export type WarGameListItem = FunctionReturnType<typeof api.warGames.list>[number]

export const METHOD_LABELS: Record<DraftMethod, string> = {
  ourRank: "Our ranking",
  opr: "Blue Alliance OPR",
  manual: "Manual order",
}

export const DRAFT_METHODS: readonly DraftMethod[] = ["ourRank", "opr", "manual"]

export function isDraftMethod(value: unknown): value is DraftMethod {
  return value === "ourRank" || value === "opr" || value === "manual"
}

export const SLOT_LABELS = ["Captain", "Pick 1", "Pick 2"] as const

/** Server limit for predicted RP and RP settings. */
export const MAX_RP = 20
