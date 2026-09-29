import type { FunctionReturnType } from "convex/server"

import type { api } from "../../../convex/_generated/api"

export type Assignment = FunctionReturnType<typeof api.assignments.list>[number]
export type Profile = FunctionReturnType<typeof api.users.listProfiles>[number]
export type Team = FunctionReturnType<typeof api.teams.list>[number]

/** "Q12, Q18" */
export function formatQuals(matchNumbers: number[]): string {
  return matchNumbers.map((n) => `Q${n}`).join(", ")
}
