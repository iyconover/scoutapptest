import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server"
import { ensureListEntries, ensurePersonalList, ensurePrimaryList, recomputeMatch } from "./lib/aggregates"
import { displayNames, getProfile, requireAdmin, requireUser } from "./lib/auth"
import { SYNC_MIN_INTERVAL_MS } from "./lib/constants"
import { appError } from "./lib/errors"
import { getActiveEvent, getMatchByNumber, getTeam, listMatches, listTeams, setActiveEventId } from "./lib/event"
import {
  fetchEventImport,
  fetchInsights,
  importMatchV,
  importTeamV,
  oprRowV,
  rankingRowV,
  type ImportMatch,
} from "./lib/tba"

const DAY_MS = 86_400_000

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

export const active = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("events"),
      tbaKey: v.string(),
      name: v.string(),
      startDate: v.string(),
      endDate: v.string(),
      leadScout: v.union(v.null(), v.object({ userId: v.id("users"), displayName: v.string() })),
      currentMatchNumber: v.number(),
      liveSync: v.boolean(),
      lastSyncAt: v.union(v.number(), v.null()),
      hasSchedule: v.boolean(),
      teamCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return null
    const names = await displayNames(ctx)
    const matches = await listMatches(ctx, event._id)
    const teams = await listTeams(ctx, event._id)
    return {
      _id: event._id,
      tbaKey: event.tbaKey,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      leadScout: event.leadScoutId
        ? { userId: event.leadScoutId, displayName: names.get(event.leadScoutId) ?? "Unknown" }
        : null,
      currentMatchNumber: event.currentMatchNumber,
      liveSync: event.liveSync,
      lastSyncAt: event.lastSyncAt ?? null,
      hasSchedule: matches.some((m) => m.source === "tba"),
      teamCount: teams.length,
    }
  },
})

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("events"),
      tbaKey: v.string(),
      name: v.string(),
      startDate: v.string(),
      endDate: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const events = await ctx.db.query("events").collect()
    return events
      .map((e) => ({
        _id: e._id,
        tbaKey: e.tbaKey,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
      }))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
  },
})

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

export const setActiveEvent = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    if ((await ctx.db.get(args.eventId)) === null) throw appError("NOT_FOUND", "Event not found.")
    await setActiveEventId(ctx, args.eventId)
    return null
  },
})

export const setLiveSync = mutation({
  args: { eventId: v.id("events"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    if ((await ctx.db.get(args.eventId)) === null) throw appError("NOT_FOUND", "Event not found.")
    await ctx.db.patch(args.eventId, { liveSync: args.enabled })
    return null
  },
})

export const setLeadScout = mutation({
  args: { userId: v.union(v.id("users"), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) throw appError("NO_ACTIVE_EVENT", "No event is set up yet.")
    if (args.userId !== null && (await getProfile(ctx, args.userId)) === null) {
      throw appError("NOT_FOUND", "User not found.")
    }
    await ctx.db.patch(event._id, { leadScoutId: args.userId ?? undefined })
    return null
  },
})

// ---------------------------------------------------------------------------
// TBA import + sync (actions)
// ---------------------------------------------------------------------------

async function requireAdminInAction(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx)
  if (userId === null) throw appError("UNAUTHENTICATED", "Please sign in.")
  await ctx.runQuery(internal.users.assertAdmin, { userId })
  return userId
}

export const importEvent = action({
  args: { tbaKey: v.string() },
  returns: v.object({ eventId: v.id("events"), teams: v.number(), matches: v.number() }),
  handler: async (ctx, args): Promise<{ eventId: Id<"events">; teams: number; matches: number }> => {
    await requireAdminInAction(ctx)
    const tbaKey = args.tbaKey.trim().toLowerCase()
    if (!/^\d{4}[a-z0-9]+$/.test(tbaKey)) {
      throw appError("INVALID_ARGUMENT", "Event keys look like 2026rikin.")
    }
    const data = await fetchEventImport(tbaKey)
    const eventId: Id<"events"> = await ctx.runMutation(internal.events.upsertImport, {
      tbaKey,
      name: data.event.name,
      startDate: data.event.start_date,
      endDate: data.event.end_date,
      teams: data.teams,
      matches: data.matches,
    })
    await syncEvent(ctx, eventId)
    return { eventId, teams: data.teams.length, matches: data.matches.length }
  },
})

export const syncNow = action({
  args: { eventId: v.id("events") },
  returns: v.object({ changed: v.boolean() }),
  handler: async (ctx, args): Promise<{ changed: boolean }> => {
    await requireAdminInAction(ctx)
    const target = await ctx.runQuery(internal.events.getSyncTarget, { eventId: args.eventId })
    if (target === null) throw appError("NOT_FOUND", "Event not found.")
    if (target.lastSyncAt !== null && Date.now() - target.lastSyncAt < SYNC_MIN_INTERVAL_MS) {
      throw appError("SYNC_TOO_SOON", "Synced less than a minute ago. Try again shortly.")
    }
    return { changed: await syncEvent(ctx, args.eventId) }
  },
})

/** Cron entry point: sync every live event that is running today (±1 day). */
export const syncActiveEvents = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const eventIds = await ctx.runQuery(internal.events.liveEventIds, { now: Date.now() })
    for (const eventId of eventIds) {
      try {
        await syncEvent(ctx, eventId)
      } catch (error) {
        console.error(`TBA sync failed for ${eventId}`, error)
      }
    }
    return null
  },
})

async function syncEvent(ctx: ActionCtx, eventId: Id<"events">): Promise<boolean> {
  const target = await ctx.runQuery(internal.events.getSyncTarget, { eventId })
  if (target === null) return false
  const insights = await fetchInsights(target.tbaKey, target.etags)
  await ctx.runMutation(internal.events.applyInsights, {
    eventId,
    rankings: insights.rankings,
    oprs: insights.oprs,
    matches: insights.matches,
    etags: insights.etags,
    syncedAt: Date.now(),
  })
  return insights.changed
}

// ---------------------------------------------------------------------------
// Internal functions
// ---------------------------------------------------------------------------

export const getSyncTarget = internalQuery({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.null(),
    v.object({
      tbaKey: v.string(),
      etags: v.record(v.string(), v.string()),
      lastSyncAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId)
    if (event === null) return null
    return { tbaKey: event.tbaKey, etags: event.etags, lastSyncAt: event.lastSyncAt ?? null }
  },
})

export const liveEventIds = internalQuery({
  args: { now: v.number() },
  returns: v.array(v.id("events")),
  handler: async (ctx, args) => {
    const events = await ctx.db.query("events").collect()
    return events
      .filter((e) => {
        if (!e.liveSync) return false
        const start = Date.parse(e.startDate) - DAY_MS
        const end = Date.parse(e.endDate) + 2 * DAY_MS // through the day after endDate
        return args.now >= start && args.now < end
      })
      .map((e) => e._id)
  },
})

/** Upsert TBA qual matches; a TBA match replaces a manual one with the same number. */
async function upsertMatches(ctx: MutationCtx, eventId: Id<"events">, matches: ImportMatch[]) {
  for (const m of matches) {
    const existing = await getMatchByNumber(ctx, eventId, m.number)
    const fields = {
      tbaKey: m.tbaKey,
      red: m.red,
      blue: m.blue,
      scheduledTime: m.scheduledTime,
      redScore: m.redScore,
      blueScore: m.blueScore,
      source: "tba" as const,
    }
    if (existing === null) {
      await ctx.db.insert("matches", { eventId, number: m.number, closed: false, ...fields })
      continue
    }
    const teamsChanged =
      existing.red.join() !== m.red.join() || existing.blue.join() !== m.blue.join()
    await ctx.db.patch(existing._id, fields)
    if (teamsChanged) await recomputeMatch(ctx, existing._id)
  }
}

export const upsertImport = internalMutation({
  args: {
    tbaKey: v.string(),
    name: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    teams: v.array(importTeamV),
    matches: v.array(importMatchV),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_tbaKey", (q) => q.eq("tbaKey", args.tbaKey))
      .unique()
    let eventId: Id<"events">
    if (existing) {
      eventId = existing._id
      await ctx.db.patch(eventId, { name: args.name, startDate: args.startDate, endDate: args.endDate })
    } else {
      eventId = await ctx.db.insert("events", {
        tbaKey: args.tbaKey,
        name: args.name,
        startDate: args.startDate,
        endDate: args.endDate,
        currentMatchNumber: 1,
        liveSync: true,
        etags: {},
      })
    }

    for (const t of args.teams) {
      const current = await getTeam(ctx, eventId, t.number)
      if (current) await ctx.db.patch(current._id, t)
      else await ctx.db.insert("teams", { eventId, ...t })
    }
    await upsertMatches(ctx, eventId, args.matches)

    await setActiveEventId(ctx, eventId)
    await ensurePrimaryList(ctx, eventId)
    for (const profile of await ctx.db.query("profiles").collect()) {
      await ensurePersonalList(ctx, eventId, profile.userId)
    }
    await ensureListEntries(ctx, eventId)
    return eventId
  },
})

export const applyInsights = internalMutation({
  args: {
    eventId: v.id("events"),
    rankings: v.optional(v.array(rankingRowV)),
    oprs: v.optional(v.array(oprRowV)),
    matches: v.optional(v.array(importMatchV)),
    etags: v.record(v.string(), v.string()),
    syncedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { eventId } = args
    type Patch = {
      rank?: number
      rankingScore?: number
      wins?: number
      losses?: number
      ties?: number
      matchesPlayed?: number
      opr?: number
      dpr?: number
      ccwm?: number
    }
    const patches = new Map<number, Patch>()
    const patchFor = (team: number) => {
      const p = patches.get(team) ?? {}
      patches.set(team, p)
      return p
    }
    for (const r of args.rankings ?? []) {
      Object.assign(patchFor(r.teamNumber), {
        rank: r.rank,
        rankingScore: r.rankingScore,
        wins: r.wins,
        losses: r.losses,
        ties: r.ties,
        matchesPlayed: r.matchesPlayed,
      })
    }
    for (const o of args.oprs ?? []) {
      Object.assign(patchFor(o.teamNumber), { opr: o.opr, dpr: o.dpr, ccwm: o.ccwm })
    }
    for (const [teamNumber, patch] of patches) {
      const existing = await ctx.db
        .query("teamInsights")
        .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", teamNumber))
        .unique()
      if (existing) await ctx.db.patch(existing._id, patch)
      else {
        await ctx.db.insert("teamInsights", {
          eventId,
          teamNumber,
          wins: 0,
          losses: 0,
          ties: 0,
          matchesPlayed: 0,
          ...patch,
        })
      }
    }
    if (args.matches) await upsertMatches(ctx, eventId, args.matches)
    await ensureListEntries(ctx, eventId)
    await ctx.db.patch(eventId, { etags: args.etags, lastSyncAt: args.syncedAt })
    return null
  },
})
