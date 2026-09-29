import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"

import { internalQuery, mutation, query } from "./_generated/server"
import { ensurePersonalList } from "./lib/aggregates"
import { getProfile, requireAdmin, requireUser } from "./lib/auth"
import { appError } from "./lib/errors"
import { getActiveEvent } from "./lib/event"
import { roleV } from "./lib/validators"

/** The signed-in user, or null when signed out. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    return userId === null ? null : await ctx.db.get(userId)
  },
})

export const viewerProfile = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      displayName: v.string(),
      role: roleV,
      isLeadScout: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return null
    const profile = await getProfile(ctx, userId)
    if (profile === null) return null
    const event = await getActiveEvent(ctx)
    return {
      userId,
      displayName: profile.displayName,
      role: profile.role,
      isLeadScout: event?.leadScoutId === userId,
    }
  },
})

function cleanName(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (trimmed.length < 1 || trimmed.length > 40) {
    throw appError("INVALID_ARGUMENT", "Names must be 1–40 characters.")
  }
  return trimmed
}

/** Create the caller's profile on first sign-in. The very first profile becomes admin. */
export const ensureProfile = mutation({
  args: { displayName: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) throw appError("UNAUTHENTICATED", "Please sign in.")
    if ((await getProfile(ctx, userId)) !== null) return null

    const user = await ctx.db.get(userId)
    const fallback = user?.name ?? user?.email?.split("@")[0] ?? "Scouter"
    const isFirst = (await ctx.db.query("profiles").first()) === null
    await ctx.db.insert("profiles", {
      userId,
      displayName: cleanName(args.displayName ?? fallback),
      role: isFirst ? "admin" : "scouter",
    })
    const event = await getActiveEvent(ctx)
    if (event) await ensurePersonalList(ctx, event._id, userId)
    return null
  },
})

export const setDisplayName = mutation({
  args: { displayName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile } = await requireUser(ctx)
    await ctx.db.patch(profile._id, { displayName: cleanName(args.displayName) })
    return null
  },
})

export const listProfiles = query({
  args: {},
  returns: v.array(v.object({ userId: v.id("users"), displayName: v.string(), role: roleV })),
  handler: async (ctx) => {
    await requireUser(ctx)
    const profiles = await ctx.db.query("profiles").collect()
    return profiles
      .map((p) => ({ userId: p.userId, displayName: p.displayName, role: p.role }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  },
})

export const setRole = mutation({
  args: { userId: v.id("users"), role: roleV },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const target = await getProfile(ctx, args.userId)
    if (target === null) throw appError("NOT_FOUND", "User not found.")
    if (target.role === "admin" && args.role !== "admin") {
      const admins = (await ctx.db.query("profiles").collect()).filter((p) => p.role === "admin")
      if (admins.length <= 1) throw appError("LAST_ADMIN", "There must be at least one admin.")
    }
    await ctx.db.patch(target._id, { role: args.role })
    return null
  },
})

/** For actions, which can't use the query-context helpers directly. */
export const assertAdmin = internalQuery({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await getProfile(ctx, args.userId)
    if (profile?.role !== "admin") throw appError("FORBIDDEN", "Admins only.")
    return null
  },
})
