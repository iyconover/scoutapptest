import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { appError } from "./errors"

type Ctx = QueryCtx | MutationCtx

export async function getSettings(ctx: Ctx) {
  return await ctx.db.query("appSettings").first()
}

export async function getActiveEvent(ctx: Ctx): Promise<Doc<"events"> | null> {
  const settings = await getSettings(ctx)
  if (!settings?.activeEventId) return null
  return await ctx.db.get(settings.activeEventId)
}

export async function requireActiveEvent(ctx: Ctx): Promise<Doc<"events">> {
  const event = await getActiveEvent(ctx)
  if (event === null) throw appError("NO_ACTIVE_EVENT", "No event is set up yet.")
  return event
}

export async function setActiveEventId(ctx: MutationCtx, eventId: Id<"events">) {
  const settings = await getSettings(ctx)
  if (settings) await ctx.db.patch(settings._id, { activeEventId: eventId })
  else await ctx.db.insert("appSettings", { activeEventId: eventId })
}

/** All teams of an event, ascending by number. */
export async function listTeams(ctx: Ctx, eventId: Id<"events">) {
  return await ctx.db
    .query("teams")
    .withIndex("by_event_number", (q) => q.eq("eventId", eventId))
    .collect()
}

export async function getTeam(ctx: Ctx, eventId: Id<"events">, teamNumber: number) {
  return await ctx.db
    .query("teams")
    .withIndex("by_event_number", (q) => q.eq("eventId", eventId).eq("number", teamNumber))
    .unique()
}

export async function requireTeam(ctx: Ctx, eventId: Id<"events">, teamNumber: number) {
  const team = await getTeam(ctx, eventId, teamNumber)
  if (team === null) throw appError("NOT_FOUND", `Team ${teamNumber} isn't at this event.`)
  return team
}

/** All matches of an event, ascending by number. */
export async function listMatches(ctx: Ctx, eventId: Id<"events">) {
  return await ctx.db
    .query("matches")
    .withIndex("by_event_number", (q) => q.eq("eventId", eventId))
    .collect()
}

export async function getMatchByNumber(ctx: Ctx, eventId: Id<"events">, number: number) {
  return await ctx.db
    .query("matches")
    .withIndex("by_event_number", (q) => q.eq("eventId", eventId).eq("number", number))
    .first()
}

/** A match that belongs to `event`; throws NOT_FOUND otherwise. */
export async function requireMatchInEvent(
  ctx: Ctx,
  event: Doc<"events">,
  matchId: Id<"matches">,
) {
  const match = await ctx.db.get(matchId)
  if (match === null || match.eventId !== event._id) {
    throw appError("NOT_FOUND", "Match not found.")
  }
  return match
}

export function matchTeams(match: Pick<Doc<"matches">, "red" | "blue">): number[] {
  return [...match.red, ...match.blue]
}

/** Active assignments of one scouter in an event. */
export async function scouterAssignments(
  ctx: Ctx,
  eventId: Id<"events">,
  scouterId: Id<"users">,
) {
  const rows = await ctx.db
    .query("assignments")
    .withIndex("by_event_scouter", (q) => q.eq("eventId", eventId).eq("scouterId", scouterId))
    .collect()
  return rows.filter((a) => a.active)
}

/** Active assignments of everyone in an event. */
export async function eventAssignments(ctx: Ctx, eventId: Id<"events">) {
  const rows = await ctx.db
    .query("assignments")
    .withIndex("by_event_scouter", (q) => q.eq("eventId", eventId))
    .collect()
  return rows.filter((a) => a.active)
}
