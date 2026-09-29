import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { fillListEntries } from "./lib/aggregates"
import { displayNames, requireUser, type Caller } from "./lib/auth"
import { mergePickLists } from "./lib/consensus"
import { appError } from "./lib/errors"
import { getActiveEvent, listTeams, requireActiveEvent, requireTeam } from "./lib/event"
import { personalAverages } from "./lib/ranking"
import { tierForAverage } from "./lib/tiers"
import { COLUMNS, columnV, listKindV, type Column } from "./lib/validators"

const listSummaryV = v.object({
  _id: v.id("pickLists"),
  name: v.string(),
  kind: listKindV,
  ownerName: v.union(v.string(), v.null()),
  canEdit: v.boolean(),
})

/** Primary: admins only. Personal: owner only. */
function canEdit(list: Doc<"pickLists">, caller: Caller) {
  return list.kind === "primary" ? caller.profile.role === "admin" : list.ownerId === caller.userId
}

function summarize(list: Doc<"pickLists">, caller: Caller, names: Map<Id<"users">, string>) {
  return {
    _id: list._id,
    name: list.name,
    kind: list.kind,
    ownerName: list.ownerId ? (names.get(list.ownerId) ?? "Unknown") : null,
    canEdit: canEdit(list, caller),
  }
}

async function requireList(ctx: QueryCtx, listId: Id<"pickLists">) {
  const event = await requireActiveEvent(ctx)
  const list = await ctx.db.get(listId)
  if (list === null || list.eventId !== event._id) throw appError("NOT_FOUND", "Pick list not found.")
  return { event, list }
}

async function requireEditableList(ctx: QueryCtx, listId: Id<"pickLists">) {
  const caller = await requireUser(ctx)
  const { event, list } = await requireList(ctx, listId)
  if (!canEdit(list, caller)) throw appError("FORBIDDEN", "You can't edit this pick list.")
  return { caller, event, list }
}

function cleanListName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 60) {
    throw appError("INVALID_ARGUMENT", "List names must be 1–60 characters.")
  }
  return trimmed
}

async function listEntries(ctx: QueryCtx, listId: Id<"pickLists">) {
  return await ctx.db
    .query("pickListEntries")
    .withIndex("by_list_team", (q) => q.eq("listId", listId))
    .collect()
}

/** The caller's own mean rank for each team they ranked this event. */
async function myAverages(ctx: QueryCtx, eventId: Id<"events">, userId: Id<"users">) {
  const rankings = await ctx.db
    .query("matchRankings")
    .withIndex("by_event_scouter", (q) => q.eq("eventId", eventId).eq("scouterId", userId))
    .collect()
  return personalAverages(rankings, userId)
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const overview = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      primary: v.union(listSummaryV, v.null()),
      mine: v.array(listSummaryV),
      others: v.array(listSummaryV),
    }),
  ),
  handler: async (ctx) => {
    const caller = await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return null
    const names = await displayNames(ctx)
    const primary = await ctx.db
      .query("pickLists")
      .withIndex("by_event_kind", (q) => q.eq("eventId", event._id).eq("kind", "primary"))
      .first()
    const personal = await ctx.db
      .query("pickLists")
      .withIndex("by_event_kind", (q) => q.eq("eventId", event._id).eq("kind", "personal"))
      .collect()
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
    return {
      primary: primary ? summarize(primary, caller, names) : null,
      mine: personal
        .filter((l) => l.ownerId === caller.userId)
        .map((l) => summarize(l, caller, names))
        .sort(byName),
      others: personal
        .filter((l) => l.ownerId !== caller.userId)
        .map((l) => summarize(l, caller, names))
        .sort((a, b) => (a.ownerName ?? "").localeCompare(b.ownerName ?? "") || byName(a, b)),
    }
  },
})

export const get = query({
  /** A plain string so a malformed id from the URL returns null instead of throwing. */
  args: { listId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      list: listSummaryV,
      entries: v.array(
        v.object({
          teamNumber: v.number(),
          nickname: v.string(),
          avgRank: v.union(v.number(), v.null()),
          column: columnV,
          order: v.number(),
          selected: v.boolean(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return null
    const listId = ctx.db.normalizeId("pickLists", args.listId)
    const list = listId ? await ctx.db.get(listId) : null
    if (list === null || list.eventId !== event._id) return null

    const teams = new Map((await listTeams(ctx, event._id)).map((t) => [t.number, t.nickname]))
    const aggregates = await ctx.db
      .query("teamAggregates")
      .withIndex("by_event_team", (q) => q.eq("eventId", event._id))
      .collect()
    const avgBy = new Map(aggregates.map((a) => [a.teamNumber, a.avgRank ?? null]))
    const selected = new Set(
      (
        await ctx.db
          .query("selectedTeams")
          .withIndex("by_event_team", (q) => q.eq("eventId", event._id))
          .collect()
      ).map((s) => s.teamNumber),
    )
    const columnIndex = (c: Column) => COLUMNS.indexOf(c)
    const entries = (await listEntries(ctx, list._id))
      .map((e) => ({
        teamNumber: e.teamNumber,
        nickname: teams.get(e.teamNumber) ?? "",
        avgRank: avgBy.get(e.teamNumber) ?? null,
        column: e.column,
        order: e.order,
        selected: selected.has(e.teamNumber),
      }))
      .sort((a, b) => columnIndex(a.column) - columnIndex(b.column) || a.order - b.order)
    return { list: summarize(list, caller, await displayNames(ctx)), entries }
  },
})

const mergeRowV = v.object({
  teamNumber: v.number(),
  nickname: v.string(),
  column: columnV,
  score: v.union(v.number(), v.null()),
  votes: v.number(),
})

async function computeMerge(ctx: QueryCtx, eventId: Id<"events">, sourceListIds: Id<"pickLists">[]) {
  if (sourceListIds.length === 0 || sourceListIds.length > 50) {
    throw appError("INVALID_ARGUMENT", "Choose between 1 and 50 lists to merge.")
  }
  const sources = []
  for (const listId of new Set(sourceListIds)) {
    const list = await ctx.db.get(listId)
    if (list === null || list.eventId !== eventId) throw appError("NOT_FOUND", "Pick list not found.")
    sources.push({ entries: await listEntries(ctx, listId) })
  }
  const teams = await listTeams(ctx, eventId)
  const nicknames = new Map(teams.map((t) => [t.number, t.nickname]))
  return mergePickLists(sources, teams.map((t) => t.number)).map((r) => ({
    ...r,
    nickname: nicknames.get(r.teamNumber) ?? "",
  }))
}

export const previewMerge = query({
  args: { sourceListIds: v.array(v.id("pickLists")) },
  returns: v.array(mergeRowV),
  handler: async (ctx, args) => {
    await requireUser(ctx)
    const event = await requireActiveEvent(ctx)
    return await computeMerge(ctx, event._id, args.sourceListIds)
  },
})

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Place teams into tiers by the caller's own averages; returns how many entries moved. */
async function applyPersonalTiers(
  ctx: MutationCtx,
  listId: Id<"pickLists">,
  averages: Map<number, number>,
) {
  const entries = await listEntries(ctx, listId)
  const maxOrder = new Map<Column, number>()
  for (const e of entries) maxOrder.set(e.column, Math.max(maxOrder.get(e.column) ?? 0, e.order))

  let moved = 0
  const ranked = entries
    .filter((e) => averages.has(e.teamNumber))
    .sort((a, b) => averages.get(a.teamNumber)! - averages.get(b.teamNumber)!)
  for (const entry of ranked) {
    const column = tierForAverage(averages.get(entry.teamNumber))
    if (column === entry.column) continue
    const order = (maxOrder.get(column) ?? 0) + 1
    maxOrder.set(column, order)
    await ctx.db.patch(entry._id, { column, order })
    moved++
  }
  return moved
}

export const create = mutation({
  args: { name: v.string(), seed: v.union(v.literal("rankings"), v.literal("blank")) },
  returns: v.id("pickLists"),
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const event = await requireActiveEvent(ctx)
    const listId = await ctx.db.insert("pickLists", {
      eventId: event._id,
      kind: "personal",
      ownerId: userId,
      name: cleanListName(args.name),
    })
    await fillListEntries(ctx, listId, (await listTeams(ctx, event._id)).map((t) => t.number))
    if (args.seed === "rankings") {
      await applyPersonalTiers(ctx, listId, await myAverages(ctx, event._id, userId))
    }
    return listId
  },
})

export const rename = mutation({
  args: { listId: v.id("pickLists"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { list } = await requireEditableList(ctx, args.listId)
    if (list.kind === "primary") throw appError("FORBIDDEN", "The primary list can't be renamed.")
    await ctx.db.patch(list._id, { name: cleanListName(args.name) })
    return null
  },
})

export const remove = mutation({
  args: { listId: v.id("pickLists") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { list } = await requireEditableList(ctx, args.listId)
    if (list.kind === "primary") throw appError("FORBIDDEN", "The primary list can't be deleted.")
    for (const entry of await listEntries(ctx, list._id)) await ctx.db.delete(entry._id)
    await ctx.db.delete(list._id)
    return null
  },
})

/** Move one team to `column` at fractional `order` (computed by the client with orderBetween). */
export const moveEntry = mutation({
  args: { listId: v.id("pickLists"), teamNumber: v.number(), column: columnV, order: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { list } = await requireEditableList(ctx, args.listId)
    if (!Number.isFinite(args.order)) throw appError("INVALID_ARGUMENT", "Invalid position.")
    const entry = await ctx.db
      .query("pickListEntries")
      .withIndex("by_list_team", (q) => q.eq("listId", list._id).eq("teamNumber", args.teamNumber))
      .unique()
    if (entry === null) throw appError("NOT_FOUND", `Team ${args.teamNumber} isn't on this list.`)
    await ctx.db.patch(entry._id, { column: args.column, order: args.order })
    return null
  },
})

export const refreshFromRankings = mutation({
  args: { listId: v.id("pickLists") },
  returns: v.object({ moved: v.number() }),
  handler: async (ctx, args) => {
    const { caller, event, list } = await requireEditableList(ctx, args.listId)
    if (list.kind !== "personal") {
      throw appError("FORBIDDEN", "Only personal lists can be refreshed from your rankings.")
    }
    const moved = await applyPersonalTiers(ctx, list._id, await myAverages(ctx, event._id, caller.userId))
    return { moved }
  },
})

/** Replace the target list's layout with the consensus merge (recomputed server-side). */
export const applyMerge = mutation({
  args: { targetListId: v.id("pickLists"), sourceListIds: v.array(v.id("pickLists")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { event, list } = await requireEditableList(ctx, args.targetListId)
    const merged = await computeMerge(ctx, event._id, args.sourceListIds)
    const entries = new Map((await listEntries(ctx, list._id)).map((e) => [e.teamNumber, e]))
    const nextOrder = new Map<Column, number>()
    for (const row of merged) {
      const order = (nextOrder.get(row.column) ?? 0) + 1
      nextOrder.set(row.column, order)
      const entry = entries.get(row.teamNumber)
      if (entry) await ctx.db.patch(entry._id, { column: row.column, order })
      else {
        await ctx.db.insert("pickListEntries", {
          listId: list._id,
          teamNumber: row.teamNumber,
          column: row.column,
          order,
        })
      }
    }
    return null
  },
})

/** Event-wide "already picked" marker. */
export const setSelected = mutation({
  args: { teamNumber: v.number(), selected: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const event = await requireActiveEvent(ctx)
    await requireTeam(ctx, event._id, args.teamNumber)
    const existing = await ctx.db
      .query("selectedTeams")
      .withIndex("by_event_team", (q) => q.eq("eventId", event._id).eq("teamNumber", args.teamNumber))
      .unique()
    if (args.selected && existing === null) {
      await ctx.db.insert("selectedTeams", { eventId: event._id, teamNumber: args.teamNumber, markedBy: userId })
    } else if (!args.selected && existing) {
      await ctx.db.delete(existing._id)
    }
    return null
  },
})
