/**
 * The ONLY write paths into derived tables (matchTeamRanks, teamAggregates),
 * plus pick list bootstrapping shared by import, sync and profile creation.
 */
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { listTeams, matchTeams } from "./event"
import { matchAverage, teamAverage } from "./ranking"

/** Rebuild per-match averages for a match's teams, then their team rollups. */
export async function recomputeMatch(ctx: MutationCtx, matchId: Id<"matches">) {
  const match = await ctx.db.get(matchId)
  if (match === null) return
  const rankings = await ctx.db
    .query("matchRankings")
    .withIndex("by_match", (q) => q.eq("matchId", matchId))
    .collect()
  const existing = await ctx.db
    .query("matchTeamRanks")
    .withIndex("by_match", (q) => q.eq("matchId", matchId))
    .collect()
  for (const row of existing) await ctx.db.delete(row._id)

  const teams = matchTeams(match)
  for (const teamNumber of teams) {
    const ranks = rankings.flatMap((r) =>
      r.ranks.filter((e) => e.teamNumber === teamNumber).map((e) => e.rank),
    )
    const avgRank = matchAverage(ranks)
    if (avgRank === null) continue
    await ctx.db.insert("matchTeamRanks", {
      eventId: match.eventId,
      matchId,
      matchNumber: match.number,
      teamNumber,
      avgRank,
      count: ranks.length,
    })
  }
  // Also refresh teams whose old rows were just removed (e.g. manual team edits).
  const affected = new Set([...teams, ...existing.map((r) => r.teamNumber)])
  for (const teamNumber of affected) await recomputeTeam(ctx, match.eventId, teamNumber)
}

export async function recomputeTeam(ctx: MutationCtx, eventId: Id<"events">, teamNumber: number) {
  const perMatch = await ctx.db
    .query("matchTeamRanks")
    .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", teamNumber))
    .collect()
  const notes = await ctx.db
    .query("matchNotes")
    .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", teamNumber))
    .collect()
  const avgRank = teamAverage(perMatch.map((r) => r.avgRank))
  const reportCount =
    perMatch.reduce((sum, r) => sum + r.count, 0) +
    notes.filter((n) => n.assignmentId !== undefined).length

  const row = {
    eventId,
    teamNumber,
    avgRank: avgRank ?? undefined,
    matchesRanked: perMatch.length,
    reportCount,
  }
  const existing = await ctx.db
    .query("teamAggregates")
    .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", teamNumber))
    .unique()
  if (existing) await ctx.db.replace(existing._id, row)
  else await ctx.db.insert("teamAggregates", row)
}

/** Give every pick list of the event an "uncategorized" entry for each team it lacks. */
export async function ensureListEntries(ctx: MutationCtx, eventId: Id<"events">) {
  const teamNumbers = (await listTeams(ctx, eventId)).map((t) => t.number)
  for (const kind of ["primary", "personal"] as const) {
    const lists = await ctx.db
      .query("pickLists")
      .withIndex("by_event_kind", (q) => q.eq("eventId", eventId).eq("kind", kind))
      .collect()
    for (const list of lists) await fillListEntries(ctx, list._id, teamNumbers)
  }
}

/** Insert uncategorized entries (after the last existing one) for missing teams. */
export async function fillListEntries(
  ctx: MutationCtx,
  listId: Id<"pickLists">,
  teamNumbers: readonly number[],
) {
  const entries = await ctx.db
    .query("pickListEntries")
    .withIndex("by_list_team", (q) => q.eq("listId", listId))
    .collect()
  const have = new Set(entries.map((e) => e.teamNumber))
  let order = Math.max(
    0,
    ...entries.filter((e) => e.column === "uncategorized").map((e) => e.order),
  )
  for (const teamNumber of [...teamNumbers].sort((a, b) => a - b)) {
    if (have.has(teamNumber)) continue
    order += 1
    await ctx.db.insert("pickListEntries", { listId, teamNumber, column: "uncategorized", order })
  }
}

/** The event's primary list, created if missing. */
export async function ensurePrimaryList(ctx: MutationCtx, eventId: Id<"events">) {
  const existing = await ctx.db
    .query("pickLists")
    .withIndex("by_event_kind", (q) => q.eq("eventId", eventId).eq("kind", "primary"))
    .first()
  if (existing) return existing._id
  const listId = await ctx.db.insert("pickLists", { eventId, kind: "primary", name: "Primary" })
  const teams = await listTeams(ctx, eventId)
  await fillListEntries(ctx, listId, teams.map((t) => t.number))
  return listId
}

/** A default personal list for the user in this event, if they have none. */
export async function ensurePersonalList(
  ctx: MutationCtx,
  eventId: Id<"events">,
  userId: Id<"users">,
) {
  const existing = await ctx.db
    .query("pickLists")
    .withIndex("by_event_owner", (q) => q.eq("eventId", eventId).eq("ownerId", userId))
    .first()
  if (existing) return existing._id
  const listId = await ctx.db.insert("pickLists", {
    eventId,
    kind: "personal",
    ownerId: userId,
    name: "My list",
  })
  const teams = await listTeams(ctx, eventId)
  await fillListEntries(ctx, listId, teams.map((t) => t.number))
  return listId
}
