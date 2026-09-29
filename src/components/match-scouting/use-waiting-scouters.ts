import { useQuery } from "convex/react"

import { useNow } from "@/hooks/use-now"
import { isActiveScouter } from "@/lib/presence"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import type { CurrentMatch } from "./match-utils"

/** Names of active scouters who still owe something for this match (ranking, or notes if assigned). */
export function useWaitingScouters(match: CurrentMatch | null, selfId: Id<"users"> | undefined) {
  const rows = useQuery(api.matchScouting.leadPanel, match ? { matchId: match._id } : "skip")
  const now = useNow(1000)
  if (rows === undefined) return undefined
  return rows
    .filter((r) => r.userId !== selfId && isActiveScouter(r, now))
    .filter((r) => (r.assignedTeams.length > 0 ? !r.submittedNotes : !r.submittedRanking))
    .map((r) => r.displayName)
}
