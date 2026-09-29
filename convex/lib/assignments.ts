import { MAX_ASSIGNED_PER_MATCH } from "./constants"

export type ScheduleMatch = {
  number: number
  red: readonly number[]
  blue: readonly number[]
  closed: boolean
}

/**
 * Match numbers (ascending) of unclosed matches with number ≥ currentMatchNumber
 * that include `newTeam` and in which the scouter's assigned teams plus `newTeam`
 * would exceed MAX_ASSIGNED_PER_MATCH teams. `assignedTeams` may already contain `newTeam`.
 */
export function findAssignmentConflicts(
  matches: readonly ScheduleMatch[],
  currentMatchNumber: number,
  assignedTeams: readonly number[],
  newTeam: number,
): number[] {
  const watched = new Set<number>(assignedTeams)
  watched.add(newTeam)

  const conflicts = new Set<number>()
  for (const match of matches) {
    if (match.closed || match.number < currentMatchNumber) continue
    const inMatch = new Set<number>([...match.red, ...match.blue])
    if (!inMatch.has(newTeam)) continue
    let count = 0
    for (const team of watched) if (inMatch.has(team)) count++
    if (count > MAX_ASSIGNED_PER_MATCH) conflicts.add(match.number)
  }
  return [...conflicts].sort((a, b) => a - b)
}
