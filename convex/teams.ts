import { v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { query, type QueryCtx } from "./_generated/server"
import { displayNames, requireUser } from "./lib/auth"
import { getActiveEvent, getTeam, listMatches, listTeams, matchTeams } from "./lib/event"
import { buildHistoryRows, historyRowV } from "./lib/history"
import { columnV, pitFields, type Column } from "./lib/validators"

async function primaryListId(ctx: QueryCtx, eventId: Id<"events">) {
  const list = await ctx.db
    .query("pickLists")
    .withIndex("by_event_kind", (q) => q.eq("eventId", eventId).eq("kind", "primary"))
    .first()
  return list?._id ?? null
}

async function entriesFor(ctx: QueryCtx, listId: Id<"pickLists"> | null) {
  if (listId === null) return []
  return await ctx.db
    .query("pickListEntries")
    .withIndex("by_list_team", (q) => q.eq("listId", listId))
    .collect()
}

async function columnsFor(ctx: QueryCtx, listId: Id<"pickLists"> | null) {
  const entries = await entriesFor(ctx, listId)
  return new Map<number, Column>(entries.map((e) => [e.teamNumber, e.column]))
}

export const list = query({
  args: { tierListId: v.optional(v.id("pickLists")) },
  returns: v.array(
    v.object({
      number: v.number(),
      nickname: v.string(),
      pitScouted: v.boolean(),
      reportCount: v.number(),
      avgRank: v.union(v.number(), v.null()),
      matchesRanked: v.number(),
      opr: v.union(v.number(), v.null()),
      eventRank: v.union(v.number(), v.null()),
      tier: v.union(columnV, v.null()),
      /** Position within `tier` on that pick list (fractional; ascending = higher on the list). */
      tierOrder: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return []
    const eventId = event._id

    const teams = await listTeams(ctx, eventId)
    const aggregates = await ctx.db
      .query("teamAggregates")
      .withIndex("by_event_team", (q) => q.eq("eventId", eventId))
      .collect()
    const insights = await ctx.db
      .query("teamInsights")
      .withIndex("by_event_team", (q) => q.eq("eventId", eventId))
      .collect()
    const pits = await ctx.db
      .query("pitReports")
      .withIndex("by_event_team", (q) => q.eq("eventId", eventId))
      .collect()

    let listId = args.tierListId ?? null
    if (listId !== null) {
      const chosen = await ctx.db.get(listId)
      if (chosen === null || chosen.eventId !== eventId) listId = null
    }
    const tiers = new Map(
      (await entriesFor(ctx, listId ?? (await primaryListId(ctx, eventId)))).map((e) => [e.teamNumber, e]),
    )

    const aggBy = new Map(aggregates.map((a) => [a.teamNumber, a]))
    const insightBy = new Map(insights.map((i) => [i.teamNumber, i]))
    const pitSet = new Set(pits.map((p) => p.teamNumber))

    return teams.map((t) => {
      const agg = aggBy.get(t.number)
      const insight = insightBy.get(t.number)
      return {
        number: t.number,
        nickname: t.nickname,
        pitScouted: pitSet.has(t.number),
        reportCount: agg?.reportCount ?? 0,
        avgRank: agg?.avgRank ?? null,
        matchesRanked: agg?.matchesRanked ?? 0,
        opr: insight?.opr ?? null,
        eventRank: insight?.rank ?? null,
        tier: tiers.get(t.number)?.column ?? null,
        tierOrder: tiers.get(t.number)?.order ?? null,
      }
    })
  },
})

export const detail = query({
  args: { teamNumber: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      team: v.object({
        number: v.number(),
        nickname: v.string(),
        city: v.union(v.string(), v.null()),
        stateProv: v.union(v.string(), v.null()),
        country: v.union(v.string(), v.null()),
        tbaUrl: v.string(),
      }),
      insights: v.union(
        v.null(),
        v.object({
          rank: v.union(v.number(), v.null()),
          rankingScore: v.union(v.number(), v.null()),
          matchesPlayed: v.number(),
          opr: v.union(v.number(), v.null()),
          dpr: v.union(v.number(), v.null()),
          ccwm: v.union(v.number(), v.null()),
        }),
      ),
      pit: v.union(v.null(), v.object({ ...pitFields, photoUrls: v.array(v.string()) })),
      avgRank: v.union(v.number(), v.null()),
      matchesRanked: v.number(),
      opr: v.union(v.number(), v.null()),
      notes: v.array(
        v.object({
          matchNumber: v.number(),
          authorName: v.string(),
          text: v.string(),
          fromAssignment: v.boolean(),
          createdAt: v.number(),
        }),
      ),
      tier: v.object({ primary: v.union(columnV, v.null()), mine: v.union(columnV, v.null()) }),
      record: v.object({ wins: v.number(), losses: v.number(), ties: v.number() }),
      matches: v.array(historyRowV),
    }),
  ),
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return null
    const eventId = event._id
    const team = await getTeam(ctx, eventId, args.teamNumber)
    if (team === null) return null

    const insight = await ctx.db
      .query("teamInsights")
      .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", team.number))
      .unique()
    const agg = await ctx.db
      .query("teamAggregates")
      .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", team.number))
      .unique()
    const pitDoc = await ctx.db
      .query("pitReports")
      .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", team.number))
      .unique()
    let pit = null
    if (pitDoc) {
      const urls = await Promise.all(pitDoc.photoIds.map((id) => ctx.storage.getUrl(id)))
      pit = {
        trench: pitDoc.trench,
        bump: pitDoc.bump,
        turret: pitDoc.turret,
        dumper: pitDoc.dumper,
        singleStream: pitDoc.singleStream,
        humanPlayerOnly: pitDoc.humanPlayerOnly,
        climbL1: pitDoc.climbL1,
        climbL2: pitDoc.climbL2,
        climbL3: pitDoc.climbL3,
        drivetrain: pitDoc.drivetrain,
        notes: pitDoc.notes,
        photoIds: pitDoc.photoIds,
        photoUrls: urls.filter((u): u is string => u !== null),
      }
    }

    const names = await displayNames(ctx)
    const noteDocs = await ctx.db
      .query("matchNotes")
      .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", team.number))
      .collect()
    const notes = noteDocs
      .map((n) => ({
        matchNumber: n.matchNumber,
        authorName: names.get(n.authorId) ?? "Unknown",
        text: n.text,
        fromAssignment: n.assignmentId !== undefined,
        createdAt: n._creationTime,
      }))
      .sort((a, b) => a.matchNumber - b.matchNumber || a.createdAt - b.createdAt)

    const primary = await columnsFor(ctx, await primaryListId(ctx, eventId))
    const myList = await ctx.db
      .query("pickLists")
      .withIndex("by_event_owner", (q) => q.eq("eventId", eventId).eq("ownerId", userId))
      .first()
    const mine = await columnsFor(ctx, myList?._id ?? null)

    const teamMatches = (await listMatches(ctx, eventId)).filter((m) =>
      matchTeams(m).includes(team.number),
    )
    let record = { wins: 0, losses: 0, ties: 0 }
    if (insight && insight.matchesPlayed > 0) {
      record = { wins: insight.wins, losses: insight.losses, ties: insight.ties }
    } else {
      for (const m of teamMatches) {
        if (m.redScore === undefined || m.blueScore === undefined) continue
        const ours = m.red.includes(team.number) ? m.redScore : m.blueScore
        const theirs = m.red.includes(team.number) ? m.blueScore : m.redScore
        if (ours > theirs) record.wins++
        else if (ours < theirs) record.losses++
        else record.ties++
      }
    }

    return {
      team: {
        number: team.number,
        nickname: team.nickname,
        city: team.city ?? null,
        stateProv: team.stateProv ?? null,
        country: team.country ?? null,
        tbaUrl: `https://www.thebluealliance.com/team/${team.number}/${event.tbaKey.slice(0, 4)}`,
      },
      insights: insight
        ? {
            rank: insight.rank ?? null,
            rankingScore: insight.rankingScore ?? null,
            matchesPlayed: insight.matchesPlayed,
            opr: insight.opr ?? null,
            dpr: insight.dpr ?? null,
            ccwm: insight.ccwm ?? null,
          }
        : null,
      pit,
      avgRank: agg?.avgRank ?? null,
      matchesRanked: agg?.matchesRanked ?? 0,
      opr: insight?.opr ?? null,
      notes,
      tier: { primary: primary.get(team.number) ?? null, mine: mine.get(team.number) ?? null },
      record,
      matches: await buildHistoryRows(ctx, eventId, teamMatches),
    }
  },
})
