import { useQuery } from "convex/react"
import { useMemo } from "react"

import { comparePositions, type ComparePosition } from "@/components/teams/team-sort"
import { api } from "../../../convex/_generated/api"

/** Our-rank vs OPR positions for every team (same numbers as the Teams → Compare view). */
export function useTeamDeltas(): Map<number, ComparePosition> {
  const teams = useQuery(api.teams.list, {})
  return useMemo(() => comparePositions(teams ?? []), [teams])
}
