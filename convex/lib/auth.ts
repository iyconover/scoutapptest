import { getAuthUserId } from "@convex-dev/auth/server"

import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { appError } from "./errors"

type Ctx = QueryCtx | MutationCtx

export type Caller = { userId: Id<"users">; profile: Doc<"profiles"> }

export async function getProfile(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()
}

/** Signed-in caller with a profile. Identity always comes from the auth token. */
export async function requireUser(ctx: Ctx): Promise<Caller> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) throw appError("UNAUTHENTICATED", "Please sign in.")
  const profile = await getProfile(ctx, userId)
  if (profile === null) {
    throw appError("FORBIDDEN", "Your profile isn't set up yet. Reload the page.")
  }
  return { userId, profile }
}

export async function requireAdmin(ctx: Ctx): Promise<Caller> {
  const caller = await requireUser(ctx)
  if (caller.profile.role !== "admin") throw appError("FORBIDDEN", "Admins only.")
  return caller
}

/** Lead scout of `event`, or any admin. */
export async function requireLeadOrAdmin(
  ctx: Ctx,
  event: Doc<"events">,
): Promise<Caller & { isLead: boolean }> {
  const caller = await requireUser(ctx)
  const isLead = event.leadScoutId === caller.userId
  if (!isLead && caller.profile.role !== "admin") {
    throw appError("FORBIDDEN", "Only the lead scout or an admin can do that.")
  }
  return { ...caller, isLead }
}

/** userId → displayName for every profile. */
export async function displayNames(ctx: Ctx): Promise<Map<Id<"users">, string>> {
  const profiles = await ctx.db.query("profiles").collect()
  return new Map(profiles.map((p) => [p.userId, p.displayName]))
}
