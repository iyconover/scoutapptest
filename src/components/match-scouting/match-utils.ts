import type { FunctionReturnType } from "convex/server"

import type { AllianceColor } from "@/lib/alliance"
import type { api } from "../../../convex/_generated/api"
import type { ScoutingRole } from "../../../convex/lib/validators"

export type CurrentScouting = NonNullable<FunctionReturnType<typeof api.matchScouting.current>>
export type CurrentMatch = NonNullable<CurrentScouting["match"]>
export type LeadPanelRow = FunctionReturnType<typeof api.matchScouting.leadPanel>[number]

export interface TeamSlot {
  teamNumber: number
  nickname: string
  color: AllianceColor
  /** 1–3 within the alliance. */
  position: number
}

/** The six teams in schedule order: red 1–3, then blue 1–3. */
export function matchSlots(match: Pick<CurrentMatch, "red" | "blue" | "nicknames">): TeamSlot[] {
  const names = new Map(match.nicknames.map((n) => [n.teamNumber, n.nickname]))
  const slot = (color: AllianceColor) => (teamNumber: number, i: number) => ({
    teamNumber,
    nickname: names.get(teamNumber) ?? "",
    color,
    position: i + 1,
  })
  return [...match.red.map(slot("red")), ...match.blue.map(slot("blue"))]
}

export function slotLabel(slot: TeamSlot): string {
  return `${slot.color === "red" ? "Red" : "Blue"} ${slot.position}`
}

/** True when `order` contains exactly the given teams, once each. */
export function isPermutationOf(order: readonly number[], teams: readonly number[]): boolean {
  if (order.length !== teams.length) return false
  const set = new Set(order)
  return set.size === teams.length && teams.every((t) => set.has(t))
}

/** Starting order: the previous submission if valid, else schedule order. */
export function defaultOrder(match: CurrentMatch, submission: CurrentScouting["mySubmission"]): number[] {
  const teams = [...match.red, ...match.blue]
  if (submission) {
    const fromSubmission = [...submission.ranks].sort((a, b) => a.rank - b.rank).map((r) => r.teamNumber)
    if (isPermutationOf(fromSubmission, teams)) return fromSubmission
  }
  return teams
}

export function sameOrder(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i])
}

/** Server-side note text per team (the server stores trimmed text). */
export function serverNoteMap(notes: CurrentScouting["myNotes"]): Map<number, string> {
  return new Map(notes.map((n) => [n.teamNumber, n.text]))
}

/** Notes whose (trimmed) draft text differs from the server; "" deletes a note. */
export function changedNotes(
  teams: readonly number[],
  draftNotes: Record<number, string> | undefined,
  server: Map<number, string>,
): { teamNumber: number; text: string }[] {
  const changed: { teamNumber: number; text: string }[] = []
  for (const teamNumber of teams) {
    const draft = draftNotes?.[teamNumber]
    if (draft === undefined) continue
    const text = draft.trim()
    if (text !== (server.get(teamNumber) ?? "")) changed.push({ teamNumber, text })
  }
  return changed
}

export const ROLE_LABELS: Record<ScoutingRole, string> = {
  lead: "Lead scout",
  ranker: "Ranker",
  assigned: "Assigned scout",
}

export const ROLE_EXPLANATIONS: Record<ScoutingRole, string> = {
  lead: "Rank all six teams, then run the match: track scouters, close the match and move everyone on.",
  ranker: "Rank all six teams from best (1) to worst (6). Notes are optional.",
  assigned: "Watch your assigned teams and write notes on them. You don't rank this match.",
}
