import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { findAssignmentConflicts } from "./lib/assignments"
import { displayNames, getProfile, requireAdmin, requireUser } from "./lib/auth"
import { MAX_NOTE_LENGTH } from "./lib/constants"
import { appError } from "./lib/errors"
import {
  eventAssignments,
  getActiveEvent,
  listMatches,
  listTeams,
  requireActiveEvent,
  requireTeam,
  scouterAssignments,
} from "./lib/event"

async function conflictsFor(
  ctx: QueryCtx,
  event: Doc<"events">,
  scouterId: Id<"users">,
  teamNumber: number,
) {
  const matches = await listMatches(ctx, event._id)
  const assigned = (await scouterAssignments(ctx, event._id, scouterId)).map((a) => a.teamNumber)
  return findAssignmentConflicts(matches, event.currentMatchNumber, assigned, teamNumber)
}

function cleanInstructions(text: string) {
  const trimmed = text.trim()
  if (trimmed.length > MAX_NOTE_LENGTH) throw appError("INVALID_ARGUMENT", "Instructions are too long.")
  return trimmed
}

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("assignments"),
      scouterId: v.id("users"),
      scouterName: v.string(),
      teamNumber: v.number(),
      nickname: v.string(),
      instructions: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return []
    const names = await displayNames(ctx)
    const nicknames = new Map((await listTeams(ctx, event._id)).map((t) => [t.number, t.nickname]))
    return (await eventAssignments(ctx, event._id))
      .map((a) => ({
        _id: a._id,
        scouterId: a.scouterId,
        scouterName: names.get(a.scouterId) ?? "Unknown",
        teamNumber: a.teamNumber,
        nickname: nicknames.get(a.teamNumber) ?? "",
        instructions: a.instructions,
      }))
      .sort((a, b) => a.scouterName.localeCompare(b.scouterName) || a.teamNumber - b.teamNumber)
  },
})

export const mine = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("assignments"),
      teamNumber: v.number(),
      nickname: v.string(),
      instructions: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const { userId } = await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return []
    const nicknames = new Map((await listTeams(ctx, event._id)).map((t) => [t.number, t.nickname]))
    return (await scouterAssignments(ctx, event._id, userId))
      .map((a) => ({
        _id: a._id,
        teamNumber: a.teamNumber,
        nickname: nicknames.get(a.teamNumber) ?? "",
        instructions: a.instructions,
      }))
      .sort((a, b) => a.teamNumber - b.teamNumber)
  },
})

/** Future matches where adding this team would give the scouter too many teams at once. */
export const previewConflicts = query({
  args: { scouterId: v.id("users"), teamNumber: v.number() },
  returns: v.object({ matchNumbers: v.array(v.number()) }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return { matchNumbers: [] }
    return { matchNumbers: await conflictsFor(ctx, event, args.scouterId, args.teamNumber) }
  },
})

/** Assign a team to a scouter. Re-assigning an existing pair just updates the instructions. */
export const create = mutation({
  args: { scouterId: v.id("users"), teamNumber: v.number(), instructions: v.string() },
  returns: v.id("assignments"),
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx)
    const event = await requireActiveEvent(ctx)
    if ((await getProfile(ctx, args.scouterId)) === null) throw appError("NOT_FOUND", "Scouter not found.")
    await requireTeam(ctx, event._id, args.teamNumber)
    const instructions = cleanInstructions(args.instructions)

    const existing = (await scouterAssignments(ctx, event._id, args.scouterId)).find(
      (a) => a.teamNumber === args.teamNumber,
    )
    if (existing) {
      await ctx.db.patch(existing._id, { instructions })
      return existing._id
    }
    const matchNumbers = await conflictsFor(ctx, event, args.scouterId, args.teamNumber)
    if (matchNumbers.length > 0) {
      throw appError(
        "ASSIGNMENT_CONFLICT",
        `That scouter would watch 3+ teams in match ${matchNumbers.join(", ")}. Choose another scouter.`,
        { matchNumbers },
      )
    }
    return await ctx.db.insert("assignments", {
      eventId: event._id,
      scouterId: args.scouterId,
      teamNumber: args.teamNumber,
      instructions,
      createdBy: userId,
      active: true,
    })
  },
})

async function requireAssignment(ctx: QueryCtx, assignmentId: Id<"assignments">) {
  const event = await requireActiveEvent(ctx)
  const assignment = await ctx.db.get(assignmentId)
  if (assignment === null || assignment.eventId !== event._id || !assignment.active) {
    throw appError("NOT_FOUND", "Assignment not found.")
  }
  return assignment
}

export const updateInstructions = mutation({
  args: { assignmentId: v.id("assignments"), instructions: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const assignment = await requireAssignment(ctx, args.assignmentId)
    await ctx.db.patch(assignment._id, { instructions: cleanInstructions(args.instructions) })
    return null
  },
})

/** Soft delete: past notes keep their assignment link. */
export const remove = mutation({
  args: { assignmentId: v.id("assignments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const assignment = await requireAssignment(ctx, args.assignmentId)
    await ctx.db.patch(assignment._id, { active: false })
    return null
  },
})
