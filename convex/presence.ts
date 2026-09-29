import { v } from "convex/values"

import { mutation, query } from "./_generated/server"
import { requireUser } from "./lib/auth"
import { getActiveEvent } from "./lib/event"
import { pageV, roleV } from "./lib/validators"

/**
 * Client calls this every HEARTBEAT_MS with the page it's on. Silently no-ops
 * when there is no active event so it never spams errors.
 */
export const heartbeat = mutation({
  args: { page: pageV, matchId: v.optional(v.id("matches")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return null
    const row = {
      userId,
      eventId: event._id,
      page: args.page,
      matchId: args.matchId,
      lastSeen: Date.now(),
    }
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique()
    if (existing) await ctx.db.replace(existing._id, row)
    else await ctx.db.insert("presence", row)
    return null
  },
})

/**
 * Every profile with their latest presence in the active event. The client
 * derives active/inactive from `lastSeen` (see PRESENCE_ACTIVE_MS); queries
 * never read the clock.
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      userId: v.id("users"),
      displayName: v.string(),
      role: roleV,
      page: v.union(pageV, v.null()),
      matchId: v.union(v.id("matches"), v.null()),
      lastSeen: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    const profiles = await ctx.db.query("profiles").collect()
    const rows = event
      ? await ctx.db
          .query("presence")
          .withIndex("by_event", (q) => q.eq("eventId", event._id))
          .collect()
      : []
    const byUser = new Map(rows.map((r) => [r.userId, r]))
    return profiles
      .map((p) => {
        const r = byUser.get(p.userId)
        return {
          userId: p.userId,
          displayName: p.displayName,
          role: p.role,
          page: r?.page ?? null,
          matchId: r?.matchId ?? null,
          lastSeen: r?.lastSeen ?? null,
        }
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  },
})
