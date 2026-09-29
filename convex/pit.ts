import { v } from "convex/values"

import { mutation, query } from "./_generated/server"
import { displayNames, requireUser } from "./lib/auth"
import { MAX_NOTE_LENGTH, MAX_PHOTOS_PER_TEAM } from "./lib/constants"
import { appError } from "./lib/errors"
import { getActiveEvent, listTeams, requireActiveEvent, requireTeam } from "./lib/event"
import { pitFields } from "./lib/validators"

export const statusGrid = query({
  args: {},
  returns: v.array(
    v.object({
      teamNumber: v.number(),
      nickname: v.string(),
      scouted: v.boolean(),
      photoCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return []
    const teams = await listTeams(ctx, event._id)
    const reports = await ctx.db
      .query("pitReports")
      .withIndex("by_event_team", (q) => q.eq("eventId", event._id))
      .collect()
    const byTeam = new Map(reports.map((r) => [r.teamNumber, r]))
    return teams.map((t) => ({
      teamNumber: t.number,
      nickname: t.nickname,
      scouted: byTeam.has(t.number),
      photoCount: byTeam.get(t.number)?.photoIds.length ?? 0,
    }))
  },
})

export const get = query({
  args: { teamNumber: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      ...pitFields,
      photos: v.array(v.object({ storageId: v.id("_storage"), url: v.string() })),
      updatedByName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx)
    const event = await getActiveEvent(ctx)
    if (event === null) return null
    const report = await ctx.db
      .query("pitReports")
      .withIndex("by_event_team", (q) => q.eq("eventId", event._id).eq("teamNumber", args.teamNumber))
      .unique()
    if (report === null) return null
    const photos = []
    for (const storageId of report.photoIds) {
      const url = await ctx.storage.getUrl(storageId)
      if (url) photos.push({ storageId, url })
    }
    const names = await displayNames(ctx)
    return {
      trench: report.trench,
      bump: report.bump,
      turret: report.turret,
      dumper: report.dumper,
      singleStream: report.singleStream,
      humanPlayerOnly: report.humanPlayerOnly,
      climbL1: report.climbL1,
      climbL2: report.climbL2,
      climbL3: report.climbL3,
      drivetrain: report.drivetrain,
      notes: report.notes,
      photoIds: report.photoIds,
      photos,
      updatedByName: names.get(report.updatedBy) ?? "Unknown",
    }
  },
})

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUser(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/** Upsert the pit report; photos removed from `photoIds` are deleted from storage. */
export const save = mutation({
  args: { teamNumber: v.number(), ...pitFields },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx)
    const event = await requireActiveEvent(ctx)
    await requireTeam(ctx, event._id, args.teamNumber)
    if (args.photoIds.length > MAX_PHOTOS_PER_TEAM) {
      throw appError("INVALID_ARGUMENT", `At most ${MAX_PHOTOS_PER_TEAM} photos per team.`)
    }
    if (args.notes.length > MAX_NOTE_LENGTH) {
      throw appError("INVALID_ARGUMENT", "Notes are too long.")
    }
    const { teamNumber, ...fields } = args
    const row = {
      eventId: event._id,
      teamNumber,
      ...fields,
      photoIds: [...new Set(fields.photoIds)],
      updatedBy: userId,
    }
    const existing = await ctx.db
      .query("pitReports")
      .withIndex("by_event_team", (q) => q.eq("eventId", event._id).eq("teamNumber", teamNumber))
      .unique()
    if (existing) {
      const kept = new Set(row.photoIds)
      for (const id of existing.photoIds) if (!kept.has(id)) await ctx.storage.delete(id)
      await ctx.db.replace(existing._id, row)
    } else {
      await ctx.db.insert("pitReports", row)
    }
    return null
  },
})
