import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { draftAlliances, refreshCaptains } from "./lib/allianceDraft"
import { displayNames, requireUser, type Caller } from "./lib/auth"
import { ALLIANCE_COUNT, ALLIANCE_SIZE, DEFAULT_TIE_RP, DEFAULT_WIN_RP } from "./lib/constants"
import { appError } from "./lib/errors"
import { getActiveEvent, listMatches, listTeams, requireActiveEvent } from "./lib/event"
import { predictStandings, suggestRP, type PredictedStanding, type TeamStats } from "./lib/rpPrediction"
import { loadTeamStats } from "./lib/stats"
import { allianceV, draftMethodV, type Alliance, type DraftMethod } from "./lib/validators"

const MAX_RP = 20

function emptyAlliances(): Alliance[] {
  return Array.from({ length: ALLIANCE_COUNT }, () => ({
    slots: Array<number | null>(ALLIANCE_SIZE).fill(null),
    locked: Array<boolean>(ALLIANCE_SIZE).fill(false),
  }))
}

function canEdit(wg: Doc<"warGames">, caller: Caller) {
  return wg.createdBy === caller.userId || caller.profile.role === "admin"
}

async function requireWarGame(ctx: QueryCtx, warGameId: Id<"warGames">, edit: boolean) {
  const caller = await requireUser(ctx)
  const event = await requireActiveEvent(ctx)
  const wg = await ctx.db.get(warGameId)
  if (wg === null || wg.eventId !== event._id) throw appError("NOT_FOUND", "Scenario not found.")
  if (edit && !canEdit(wg, caller)) throw appError("FORBIDDEN", "Only the creator or an admin can edit this.")
  return { caller, event, wg }
}

function checkRP(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_RP) {
    throw appError("INVALID_ARGUMENT", `RP must be a whole number from 0 to ${MAX_RP}.`)
  }
}

/** Everything derived for a scenario: per-match predictions and predicted standings. */
async function evaluate(ctx: QueryCtx, wg: Doc<"warGames">) {
  const stats = await loadTeamStats(ctx, wg.eventId)
  const unplayed = (await listMatches(ctx, wg.eventId)).filter(
    (m) => m.redScore === undefined || m.blueScore === undefined,
  )
  const stored = await ctx.db
    .query("warGamePredictions")
    .withIndex("by_warGame_match", (q) => q.eq("warGameId", wg._id))
    .collect()
  const storedBy = new Map(stored.map((p) => [p.matchId, p]))
  const config = { winRP: wg.winRP, tieRP: wg.tieRP }

  const predictions = unplayed.map((m) => {
    const suggested = suggestRP(m, stats, config)
    const manual = storedBy.get(m._id)
    return {
      matchId: m._id,
      number: m.number,
      red: m.red,
      blue: m.blue,
      redRP: manual?.redRP ?? suggested.redRP,
      blueRP: manual?.blueRP ?? suggested.blueRP,
      manual: manual !== undefined,
      suggested,
    }
  })
  const standings = predictStandings([...stats.values()], predictions)
  return { stats, predictions, standings, seedOrder: seedOrderFor([...stats.values()], predictions.length, standings) }
}

/** Captain order: final event rankings once every qual is played, predicted standings before that. */
function seedOrderFor(stats: readonly TeamStats[], unplayed: number, standings: readonly PredictedStanding[]) {
  if (unplayed === 0 && stats.length > 0 && stats.every((s) => s.rank !== null)) {
    return [...stats].sort((a, b) => a.rank! - b.rank! || a.teamNumber - b.teamNumber).map((s) => s.teamNumber)
  }
  return standings.map((s) => s.teamNumber)
}

/** Board with every unlocked pick emptied and unlocked captain slots filled by seed. Locked teams stay put. */
async function captainsOnly(ctx: QueryCtx, wg: Doc<"warGames">) {
  const { seedOrder } = await evaluate(ctx, wg)
  return draftAlliances({ seedOrder, pickOrder: [], alliances: wg.alliances })
}

/** Desirability order for the auto draft. Unknown values fall back to predicted rank. */
function pickOrderFor(
  method: DraftMethod,
  manualOrder: readonly number[],
  standings: readonly PredictedStanding[],
  stats: ReadonlyMap<number, TeamStats>,
) {
  const bySeed = standings.map((s) => s.teamNumber)
  const known = (value: (t: number) => number | null, direction: 1 | -1) => {
    const withValue = bySeed.filter((t) => value(t) !== null)
    withValue.sort((a, b) => direction * (value(a)! - value(b)!))
    return [...withValue, ...bySeed.filter((t) => value(t) === null)]
  }
  if (method === "ourRank") return known((t) => stats.get(t)?.avgRank ?? null, 1)
  if (method === "opr") return known((t) => stats.get(t)?.opr ?? null, -1)
  const inEvent = new Set(bySeed)
  const manual = [...new Set(manualOrder)].filter((t) => inEvent.has(t))
  const listed = new Set(manual)
  return [...manual, ...bySeed.filter((t) => !listed.has(t))]
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("warGames"),
      name: v.string(),
      createdByName: v.string(),
      method: draftMethodV,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return []
    const names = await displayNames(ctx)
    const rows = await ctx.db
      .query("warGames")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect()
    return rows
      .map((w) => ({
        _id: w._id,
        name: w.name,
        createdByName: names.get(w.createdBy) ?? "Unknown",
        method: w.method,
        createdAt: w._creationTime,
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
  },
})

export const get = query({
  /** A plain string so a malformed id from the URL returns null instead of throwing. */
  args: { warGameId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      scenario: v.object({
        _id: v.id("warGames"),
        name: v.string(),
        createdByName: v.string(),
        method: draftMethodV,
        manualOrder: v.array(v.number()),
        winRP: v.number(),
        tieRP: v.number(),
        alliances: v.array(allianceV),
      }),
      predictions: v.array(
        v.object({
          matchId: v.id("matches"),
          number: v.number(),
          red: v.array(v.number()),
          blue: v.array(v.number()),
          redRP: v.number(),
          blueRP: v.number(),
          manual: v.boolean(),
          suggested: v.object({ redRP: v.number(), blueRP: v.number() }),
        }),
      ),
      standings: v.array(
        v.object({
          teamNumber: v.number(),
          currentRank: v.union(v.number(), v.null()),
          predictedRank: v.number(),
          predictedRS: v.number(),
        }),
      ),
      teams: v.array(
        v.object({
          teamNumber: v.number(),
          nickname: v.string(),
          eventRank: v.union(v.number(), v.null()),
          predictedRank: v.number(),
          avgRank: v.union(v.number(), v.null()),
          opr: v.union(v.number(), v.null()),
        }),
      ),
      canEdit: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return null
    const warGameId = ctx.db.normalizeId("warGames", args.warGameId)
    const wg = warGameId ? await ctx.db.get(warGameId) : null
    if (wg === null || wg.eventId !== event._id) return null

    const { stats, predictions, standings, seedOrder } = await evaluate(ctx, wg)
    const nicknames = new Map((await listTeams(ctx, event._id)).map((t) => [t.number, t.nickname]))
    const names = await displayNames(ctx)
    return {
      scenario: {
        _id: wg._id,
        name: wg.name,
        createdByName: names.get(wg.createdBy) ?? "Unknown",
        method: wg.method,
        manualOrder: wg.manualOrder,
        winRP: wg.winRP,
        tieRP: wg.tieRP,
        // Captains follow the current seeds; only locked captains are pinned.
        alliances: refreshCaptains(wg.alliances, seedOrder),
      },
      predictions,
      standings,
      teams: standings.map((s) => ({
        teamNumber: s.teamNumber,
        nickname: nicknames.get(s.teamNumber) ?? "",
        eventRank: stats.get(s.teamNumber)?.rank ?? null,
        predictedRank: s.predictedRank,
        avgRank: stats.get(s.teamNumber)?.avgRank ?? null,
        opr: stats.get(s.teamNumber)?.opr ?? null,
      })),
      canEdit: canEdit(wg, caller),
    }
  },
})

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function cleanName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 60) {
    throw appError("INVALID_ARGUMENT", "Names must be 1–60 characters.")
  }
  return trimmed
}

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("warGames"),
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const event = await requireActiveEvent(ctx)
    const stats = await loadTeamStats(ctx, event._id)
    const byRank = [...stats.values()].sort(
      (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.teamNumber - b.teamNumber,
    )
    const id = await ctx.db.insert("warGames", {
      eventId: event._id,
      name: cleanName(args.name),
      createdBy: userId,
      method: "ourRank",
      manualOrder: byRank.map((s) => s.teamNumber),
      winRP: DEFAULT_WIN_RP,
      tieRP: DEFAULT_TIE_RP,
      alliances: emptyAlliances(),
    })
    const wg = (await ctx.db.get(id))!
    await ctx.db.patch(id, { alliances: await captainsOnly(ctx, wg) })
    return id
  },
})

export const rename = mutation({
  args: { warGameId: v.id("warGames"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wg } = await requireWarGame(ctx, args.warGameId, true)
    await ctx.db.patch(wg._id, { name: cleanName(args.name) })
    return null
  },
})

export const remove = mutation({
  args: { warGameId: v.id("warGames") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wg } = await requireWarGame(ctx, args.warGameId, true)
    const predictions = await ctx.db
      .query("warGamePredictions")
      .withIndex("by_warGame_match", (q) => q.eq("warGameId", wg._id))
      .collect()
    for (const p of predictions) await ctx.db.delete(p._id)
    await ctx.db.delete(wg._id)
    return null
  },
})

/** Manual override for one unplayed match. */
export const setPrediction = mutation({
  args: { warGameId: v.id("warGames"), matchId: v.id("matches"), redRP: v.number(), blueRP: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wg } = await requireWarGame(ctx, args.warGameId, true)
    const match = await ctx.db.get(args.matchId)
    if (match === null || match.eventId !== wg.eventId) throw appError("NOT_FOUND", "Match not found.")
    checkRP(args.redRP)
    checkRP(args.blueRP)
    const existing = await ctx.db
      .query("warGamePredictions")
      .withIndex("by_warGame_match", (q) => q.eq("warGameId", wg._id).eq("matchId", match._id))
      .unique()
    const row = { warGameId: wg._id, matchId: match._id, redRP: args.redRP, blueRP: args.blueRP, manual: true }
    if (existing) await ctx.db.replace(existing._id, row)
    else await ctx.db.insert("warGamePredictions", row)
    return null
  },
})

/** Drop every manual override so all matches use the live suggestion again. */
export const resetPredictions = mutation({
  args: { warGameId: v.id("warGames") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wg } = await requireWarGame(ctx, args.warGameId, true)
    const predictions = await ctx.db
      .query("warGamePredictions")
      .withIndex("by_warGame_match", (q) => q.eq("warGameId", wg._id))
      .collect()
    for (const p of predictions) await ctx.db.delete(p._id)
    return null
  },
})

export const updateSettings = mutation({
  args: {
    warGameId: v.id("warGames"),
    method: v.optional(draftMethodV),
    winRP: v.optional(v.number()),
    tieRP: v.optional(v.number()),
    manualOrder: v.optional(v.array(v.number())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wg } = await requireWarGame(ctx, args.warGameId, true)
    if (args.winRP !== undefined) checkRP(args.winRP)
    if (args.tieRP !== undefined) checkRP(args.tieRP)
    if (args.manualOrder !== undefined) {
      const teams = new Set((await listTeams(ctx, wg.eventId)).map((t) => t.number))
      if (new Set(args.manualOrder).size !== args.manualOrder.length || args.manualOrder.some((t) => !teams.has(t))) {
        throw appError("INVALID_ARGUMENT", "Manual order must list event teams once each.")
      }
    }
    // Switching to manual starts the board over: captains by seed, every pick empty.
    const alliances = args.method === "manual" && wg.method !== "manual" ? await captainsOnly(ctx, wg) : undefined
    await ctx.db.patch(wg._id, {
      ...(args.method !== undefined && { method: args.method }),
      ...(alliances !== undefined && { alliances }),
      ...(args.winRP !== undefined && { winRP: args.winRP }),
      ...(args.tieRP !== undefined && { tieRP: args.tieRP }),
      ...(args.manualOrder !== undefined && { manualOrder: args.manualOrder }),
    })
    return null
  },
})

/** Auto-fill every unlocked slot using FRC selection rules and the scenario's method. */
export const runDraft = mutation({
  args: { warGameId: v.id("warGames") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wg } = await requireWarGame(ctx, args.warGameId, true)
    const { stats, standings, seedOrder } = await evaluate(ctx, wg)
    const alliances = draftAlliances({
      seedOrder,
      pickOrder: pickOrderFor(wg.method, wg.manualOrder, standings, stats),
      alliances: wg.alliances,
    })
    await ctx.db.patch(wg._id, { alliances })
    return null
  },
})

/** Clear the board back to captains only; locked slots are kept. */
export const clearBoard = mutation({
  args: { warGameId: v.id("warGames") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wg } = await requireWarGame(ctx, args.warGameId, true)
    await ctx.db.patch(wg._id, { alliances: await captainsOnly(ctx, wg) })
    return null
  },
})

/** Save the board after a drag. */
export const setAlliances = mutation({
  args: { warGameId: v.id("warGames"), alliances: v.array(allianceV) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wg } = await requireWarGame(ctx, args.warGameId, true)
    const shapeOk =
      args.alliances.length === ALLIANCE_COUNT &&
      args.alliances.every((a) => a.slots.length === ALLIANCE_SIZE && a.locked.length === ALLIANCE_SIZE)
    if (!shapeOk) throw appError("INVALID_ARGUMENT", `Expected ${ALLIANCE_COUNT} alliances of ${ALLIANCE_SIZE}.`)
    const placed = args.alliances.flatMap((a) => a.slots).filter((t): t is number => t !== null)
    const teams = new Set((await listTeams(ctx, wg.eventId)).map((t) => t.number))
    if (new Set(placed).size !== placed.length) throw appError("INVALID_ARGUMENT", "A team can only be placed once.")
    if (placed.some((t) => !teams.has(t))) throw appError("INVALID_ARGUMENT", "Unknown team on the board.")
    const { seedOrder } = await evaluate(ctx, wg)
    await ctx.db.patch(wg._id, { alliances: refreshCaptains(args.alliances, seedOrder) })
    return null
  },
})

export const toggleLock = mutation({
  args: { warGameId: v.id("warGames"), alliance: v.number(), slot: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { wg } = await requireWarGame(ctx, args.warGameId, true)
    const target = wg.alliances[args.alliance]
    if (!target || !Number.isInteger(args.slot) || args.slot < 0 || args.slot >= ALLIANCE_SIZE) {
      throw appError("INVALID_ARGUMENT", "No such alliance slot.")
    }
    // Lock what the board shows, so a captain is pinned as currently seeded.
    const { seedOrder } = await evaluate(ctx, wg)
    const alliances = refreshCaptains(wg.alliances, seedOrder).map((a, i) =>
      i === args.alliance ? { ...a, locked: a.locked.map((l, s) => (s === args.slot ? !l : l)) } : a,
    )
    await ctx.db.patch(wg._id, { alliances })
    return null
  },
})
