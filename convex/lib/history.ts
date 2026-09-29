import { v, type Infer } from "convex/values"

import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { displayNames } from "./auth"

export const teamCellV = v.object({
  teamNumber: v.number(),
  avgRank: v.union(v.number(), v.null()),
  notes: v.array(v.object({ authorName: v.string(), text: v.string() })),
})
export type TeamCell = Infer<typeof teamCellV>

export const historyRowV = v.object({
  _id: v.id("matches"),
  tbaKey: v.union(v.string(), v.null()),
  tbaUrl: v.union(v.string(), v.null()),
  number: v.number(),
  scheduledTime: v.union(v.number(), v.null()),
  closed: v.boolean(),
  redScore: v.union(v.number(), v.null()),
  blueScore: v.union(v.number(), v.null()),
  red: v.array(teamCellV),
  blue: v.array(teamCellV),
})
export type HistoryRow = Infer<typeof historyRowV>

export function tbaMatchUrl(tbaKey: string | undefined) {
  return tbaKey ? `https://www.thebluealliance.com/match/${tbaKey}` : null
}

/** History rows for `matches` (any subset of one event), with per-match averages + notes. */
export async function buildHistoryRows(
  ctx: QueryCtx,
  eventId: Id<"events">,
  matches: readonly Doc<"matches">[],
): Promise<HistoryRow[]> {
  const ranks = await ctx.db
    .query("matchTeamRanks")
    .withIndex("by_event_team", (q) => q.eq("eventId", eventId))
    .collect()
  const notes = await ctx.db
    .query("matchNotes")
    .withIndex("by_event_team", (q) => q.eq("eventId", eventId))
    .collect()
  const names = await displayNames(ctx)

  const key = (matchId: Id<"matches">, team: number) => `${matchId}:${team}`
  const rankBy = new Map(ranks.map((r) => [key(r.matchId, r.teamNumber), r.avgRank]))
  const notesBy = new Map<string, { authorName: string; text: string }[]>()
  for (const n of notes) {
    const k = key(n.matchId, n.teamNumber)
    const list = notesBy.get(k) ?? []
    list.push({ authorName: names.get(n.authorId) ?? "Unknown", text: n.text })
    notesBy.set(k, list)
  }

  const cell = (matchId: Id<"matches">, teamNumber: number): TeamCell => ({
    teamNumber,
    avgRank: rankBy.get(key(matchId, teamNumber)) ?? null,
    notes: notesBy.get(key(matchId, teamNumber)) ?? [],
  })

  return [...matches]
    .sort((a, b) => a.number - b.number)
    .map((m) => ({
      _id: m._id,
      tbaKey: m.tbaKey ?? null,
      tbaUrl: tbaMatchUrl(m.tbaKey),
      number: m.number,
      scheduledTime: m.scheduledTime ?? null,
      closed: m.closed,
      redScore: m.redScore ?? null,
      blueScore: m.blueScore ?? null,
      red: m.red.map((t) => cell(m._id, t)),
      blue: m.blue.map((t) => cell(m._id, t)),
    }))
}
