import { createContext, useContext } from "react"

/** Team numbers matching the board's search box; cards ring themselves when included. */
export const HighlightContext = createContext<ReadonlySet<number>>(new Set())

export function useIsHighlighted(teamNumber: number): boolean {
  return useContext(HighlightContext).has(teamNumber)
}

/** Number prefix ("11" → 1153) or nickname substring, case-insensitive. */
export function matchTeams(
  entries: readonly { teamNumber: number; nickname: string }[],
  query: string,
): Set<number> {
  const q = query.trim().toLowerCase()
  if (q === "") return new Set()
  return new Set(
    entries
      .filter((e) => String(e.teamNumber).startsWith(q) || e.nickname.toLowerCase().includes(q))
      .map((e) => e.teamNumber),
  )
}
