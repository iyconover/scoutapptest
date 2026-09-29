import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { recomputeMatch } from "./lib/aggregates"
import { requireLeadOrAdmin, requireUser } from "./lib/auth"
import { MAX_NOTE_LENGTH } from "./lib/constants"
import { appError } from "./lib/errors"
import {
  eventAssignments,
  getActiveEvent,
  getMatchByNumber,
  listTeams,
  matchTeams,
  requireActiveEvent,
  requireMatchInEvent,
  scouterAssignments,
} from "./lib/event"
import { pageV, rankEntryV, scoutingRoleV } from "./lib/validators"

/** The caller's active assignments whose team plays in `match`. */
async function assignmentsInMatch(
  ctx: QueryCtx | MutationCtx,
  match: Doc<"matches">,
  userId: Id<"users">,
) {
  const teams = new Set(matchTeams(match))
  const mine = await scouterAssignments(ctx, match.eventId, userId)
  return mine.filter((a) => teams.has(a.teamNumber))
}

/** Lead scouts always rank; others are "assigned" when they watch a team in this match. */
function roleFor(event: Doc<"events">, userId: Id<"users">, assignedHere: number) {
  if (event.leadScoutId === userId) return "lead" as const
  return assignedHere > 0 ? ("assigned" as const) : ("ranker" as const)
}

function assertOpen(match: Doc<"matches">) {
  if (match.closed) throw appError("MATCH_CLOSED", `Match ${match.number} is closed.`)
}

export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      matchNumber: v.number(),
      match: v.union(
        v.null(),
        v.object({
          _id: v.id("matches"),
          number: v.number(),
          red: v.array(v.number()),
          blue: v.array(v.number()),
          closed: v.boolean(),
          source: v.union(v.literal("tba"), v.literal("manual")),
        }),
      ),
      myRole: scoutingRoleV,
      myAssignments: v.array(
        v.object({
          assignmentId: v.id("assignments"),
          teamNumber: v.number(),
          instructions: v.string(),
        }),
      ),
      mySubmission: v.union(v.null(), v.object({ ranks: v.array(rankEntryV) })),
      myNotes: v.array(v.object({ teamNumber: v.number(), text: v.string() })),
    }),
  ),
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return null
    const match = await getMatchByNumber(ctx, event._id, event.currentMatchNumber)
    if (match === null) {
      return {
        matchNumber: event.currentMatchNumber,
        match: null,
        myRole: roleFor(event, userId, 0),
        myAssignments: [],
        mySubmission: null,
        myNotes: [],
      }
    }
    const assigned = await assignmentsInMatch(ctx, match, userId)
    const submission = await ctx.db
      .query("matchRankings")
      .withIndex("by_match_scouter", (q) => q.eq("matchId", match._id).eq("scouterId", userId))
      .unique()
    const notes = (
      await ctx.db
        .query("matchNotes")
        .withIndex("by_match_author_team", (q) => q.eq("matchId", match._id).eq("authorId", userId))
        .collect()
    ).map((n) => ({ teamNumber: n.teamNumber, text: n.text }))

    return {
      matchNumber: event.currentMatchNumber,
      match: {
        _id: match._id,
        number: match.number,
        red: match.red,
        blue: match.blue,
        closed: match.closed,
        source: match.source,
      },
      myRole: roleFor(event, userId, assigned.length),
      myAssignments: assigned.map((a) => ({
        assignmentId: a._id,
        teamNumber: a.teamNumber,
        instructions: a.instructions,
      })),
      mySubmission: submission ? { ranks: submission.ranks } : null,
      myNotes: notes,
    }
  },
})

export const submitRanking = mutation({
  args: { matchId: v.id("matches"), ranks: v.array(rankEntryV) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const event = await requireActiveEvent(ctx)
    const match = await requireMatchInEvent(ctx, event, args.matchId)
    assertOpen(match)
    if (roleFor(event, userId, (await assignmentsInMatch(ctx, match, userId)).length) === "assigned") {
      throw appError("ASSIGNED_IN_MATCH", "You're watching assigned teams this match, so you don't rank it.")
    }

    const teams = matchTeams(match)
    const ranked = args.ranks.map((r) => r.teamNumber)
    const rankValues = args.ranks.map((r) => r.rank).sort((a, b) => a - b)
    const valid =
      args.ranks.length === teams.length &&
      new Set(ranked).size === teams.length &&
      ranked.every((t) => teams.includes(t)) &&
      rankValues.every((r, i) => r === i + 1)
    if (!valid) throw appError("INVALID_RANKING", "Rank every team in the match from 1 to 6 exactly once.")

    const existing = await ctx.db
      .query("matchRankings")
      .withIndex("by_match_scouter", (q) => q.eq("matchId", match._id).eq("scouterId", userId))
      .unique()
    if (existing) await ctx.db.patch(existing._id, { ranks: args.ranks })
    else {
      await ctx.db.insert("matchRankings", {
        eventId: event._id,
        matchId: match._id,
        scouterId: userId,
        ranks: args.ranks,
      })
    }
    await recomputeMatch(ctx, match._id)
    return null
  },
})

/** Upsert the caller's notes; an empty text deletes that note. */
export const saveNotes = mutation({
  args: {
    matchId: v.id("matches"),
    notes: v.array(v.object({ teamNumber: v.number(), text: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const event = await requireActiveEvent(ctx)
    const match = await requireMatchInEvent(ctx, event, args.matchId)
    assertOpen(match)

    const teams = new Set(matchTeams(match))
    const assigned = await assignmentsInMatch(ctx, match, userId)
    const assignmentBy = new Map(assigned.map((a) => [a.teamNumber, a._id]))
    const role = roleFor(event, userId, assigned.length)

    for (const note of args.notes) {
      if (!teams.has(note.teamNumber)) {
        throw appError("INVALID_ARGUMENT", `Team ${note.teamNumber} isn't in match ${match.number}.`)
      }
      if (role === "assigned" && !assignmentBy.has(note.teamNumber)) {
        throw appError("FORBIDDEN", "You can only write notes for your assigned teams this match.")
      }
      const text = note.text.trim()
      if (text.length > MAX_NOTE_LENGTH) throw appError("INVALID_ARGUMENT", "Note is too long.")

      const existing = await ctx.db
        .query("matchNotes")
        .withIndex("by_match_author_team", (q) =>
          q.eq("matchId", match._id).eq("authorId", userId).eq("teamNumber", note.teamNumber),
        )
        .unique()
      if (text === "") {
        if (existing) await ctx.db.delete(existing._id)
        continue
      }
      const assignmentId = assignmentBy.get(note.teamNumber)
      if (existing) await ctx.db.patch(existing._id, { text, assignmentId })
      else {
        await ctx.db.insert("matchNotes", {
          eventId: event._id,
          matchId: match._id,
          matchNumber: match.number,
          teamNumber: note.teamNumber,
          authorId: userId,
          text,
          assignmentId,
        })
      }
    }
    await recomputeMatch(ctx, match._id)
    return null
  },
})

export const leadPanel = query({
  args: { matchId: v.id("matches") },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      displayName: v.string(),
      lastSeen: v.union(v.number(), v.null()),
      page: v.union(pageV, v.null()),
      submittedRanking: v.boolean(),
      submittedNotes: v.boolean(),
      assignedTeams: v.array(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const event = await requireActiveEvent(ctx)
    await requireLeadOrAdmin(ctx, event)
    const match = await requireMatchInEvent(ctx, event, args.matchId)
    const teams = new Set(matchTeams(match))

    const profiles = await ctx.db.query("profiles").collect()
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect()
    const rankings = await ctx.db
      .query("matchRankings")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .collect()
    const notes = await ctx.db
      .query("matchNotes")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .collect()
    const assignments = (await eventAssignments(ctx, event._id)).filter((a) => teams.has(a.teamNumber))

    const presenceBy = new Map(presence.map((p) => [p.userId, p]))
    const ranked = new Set(rankings.map((r) => r.scouterId))
    const noted = new Set(notes.map((n) => n.authorId))

    return profiles
      .map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        lastSeen: presenceBy.get(p.userId)?.lastSeen ?? null,
        page: presenceBy.get(p.userId)?.page ?? null,
        submittedRanking: ranked.has(p.userId),
        submittedNotes: noted.has(p.userId),
        assignedTeams: assignments.filter((a) => a.scouterId === p.userId).map((a) => a.teamNumber),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  },
})

export const closeMatch = mutation({
  args: { matchId: v.id("matches") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await requireActiveEvent(ctx)
    const { userId } = await requireLeadOrAdmin(ctx, event)
    const match = await requireMatchInEvent(ctx, event, args.matchId)
    if (match.closed) return null
    await ctx.db.patch(match._id, { closed: true, closedBy: userId })
    if (event.currentMatchNumber === match.number) {
      await ctx.db.patch(event._id, { currentMatchNumber: match.number + 1 })
    }
    return null
  },
})

export const setCurrentMatchNumber = mutation({
  args: { number: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await requireActiveEvent(ctx)
    await requireLeadOrAdmin(ctx, event)
    if (!Number.isInteger(args.number) || args.number < 1 || args.number > 999) {
      throw appError("INVALID_ARGUMENT", "Match number must be between 1 and 999.")
    }
    await ctx.db.patch(event._id, { currentMatchNumber: args.number })
    return null
  },
})

/** For events without a TBA schedule: the lead scout types in the six teams. */
export const setManualTeams = mutation({
  args: { number: v.number(), red: v.array(v.number()), blue: v.array(v.number()) },
  returns: v.id("matches"),
  handler: async (ctx, args) => {
    const event = await requireActiveEvent(ctx)
    await requireLeadOrAdmin(ctx, event)
    if (!Number.isInteger(args.number) || args.number < 1 || args.number > 999) {
      throw appError("INVALID_ARGUMENT", "Match number must be between 1 and 999.")
    }
    const all = [...args.red, ...args.blue]
    if (args.red.length !== 3 || args.blue.length !== 3 || new Set(all).size !== 6) {
      throw appError("INVALID_ARGUMENT", "Enter six different teams, three per alliance.")
    }
    const eventTeams = new Set((await listTeams(ctx, event._id)).map((t) => t.number))
    if (eventTeams.size > 0) {
      const unknown = all.filter((t) => !eventTeams.has(t))
      if (unknown.length > 0) {
        throw appError("INVALID_ARGUMENT", `Not at this event: ${unknown.join(", ")}.`)
      }
    }

    const existing = await getMatchByNumber(ctx, event._id, args.number)
    if (existing === null) {
      return await ctx.db.insert("matches", {
        eventId: event._id,
        number: args.number,
        red: args.red,
        blue: args.blue,
        source: "manual",
        closed: false,
      })
    }
    if (existing.source === "tba") {
      throw appError("FORBIDDEN", "This match comes from the TBA schedule and can't be edited.")
    }
    const hasRankings = await ctx.db
      .query("matchRankings")
      .withIndex("by_match", (q) => q.eq("matchId", existing._id))
      .first()
    if (hasRankings) {
      throw appError("FORBIDDEN", "Rankings were already submitted for this match.")
    }
    await ctx.db.patch(existing._id, { red: args.red, blue: args.blue })
    await recomputeMatch(ctx, existing._id)
    return existing._id
  },
})
