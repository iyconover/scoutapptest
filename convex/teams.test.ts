/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")

const newTest = () => convexTest(schema, modules)
type T = ReturnType<typeof newTest>

async function newUser(t: T, email: string, profile = true) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  if (profile) await as.mutation(api.users.ensureProfile, {})
  return { userId, as }
}

const code = (c: string) => ({ data: expect.objectContaining({ code: c }) })

const ranks = (order: number[]) => order.map((teamNumber, i) => ({ teamNumber, rank: i + 1 }))

async function setup() {
  const t = convexTest(schema, modules)
  const admin = await newUser(t, "admin@example.com")
  const s1 = await newUser(t, "s1@example.com")
  const s2 = await newUser(t, "s2@example.com")
  const eventId = await t.mutation(internal.events.upsertImport, {
    tbaKey: "2026test",
    name: "Test Event",
    startDate: "2026-03-01",
    endDate: "2026-03-03",
    teams: Array.from({ length: 8 }, (_, i) => ({
      tbaKey: `frc${i + 1}`,
      number: i + 1,
      nickname: `Team ${i + 1}`,
      city: "Providence",
      stateProv: "RI",
      country: "USA",
    })),
    matches: [
      { tbaKey: "2026test_qm1", number: 1, red: [1, 2, 3], blue: [4, 5, 6], redScore: 30, blueScore: 20 },
      { tbaKey: "2026test_qm2", number: 2, red: [7, 8, 2], blue: [1, 3, 4], redScore: 15, blueScore: 15 },
      { tbaKey: "2026test_qm3", number: 3, red: [5, 6, 7], blue: [8, 1, 2] },
    ],
  })
  const matchIds = await t.run(async (ctx) => {
    const rows = await ctx.db.query("matches").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect()
    return Object.fromEntries(rows.map((m) => [m.number, m._id])) as Record<number, Id<"matches">>
  })
  const primaryId = (await admin.as.query(api.pickLists.overview, {}))!.primary!._id
  const s1ListId = (await s1.as.query(api.pickLists.overview, {}))!.mine[0]._id
  return { t, admin, s1, s2, eventId, matchIds, primaryId, s1ListId }
}

describe("teams.list", () => {
  test("requires auth; empty without an event", async () => {
    const t = convexTest(schema, modules)
    await expect(t.query(api.teams.list, {})).rejects.toMatchObject(code("UNAUTHENTICATED"))
    const a = await newUser(t, "a@example.com")
    expect(await a.as.query(api.teams.list, {})).toEqual([])
  })

  test("row shape and values; tier from primary by default or from the given list", async () => {
    const { t, admin, s1, eventId, matchIds, primaryId, s1ListId } = await setup()
    await t.mutation(internal.events.applyInsights, {
      eventId,
      rankings: [{ teamNumber: 1, rank: 3, rankingScore: 2, wins: 1, losses: 0, ties: 1, matchesPlayed: 2 }],
      oprs: [{ teamNumber: 1, opr: 25.5 }],
      etags: {},
      syncedAt: 1,
    })
    await s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) })
    await admin.as.mutation(api.pickLists.moveEntry, { listId: primaryId, teamNumber: 1, column: "tier1", order: 1 })
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 1, column: "dnp", order: 1 })
    await s1.as.mutation(api.pit.save, {
      teamNumber: 1,
      trench: false,
      bump: false,
      turret: false,
      dumper: false,
      singleStream: false,
      humanPlayerOnly: false,
      climbL1: false,
      climbL2: false,
      climbL3: false,
      drivetrain: "other",
      notes: "",
      photoIds: [],
    })

    const rows = await s1.as.query(api.teams.list, {})
    expect(rows.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(rows[0]).toEqual({
      number: 1,
      nickname: "Team 1",
      pitScouted: true,
      reportCount: 1,
      avgRank: 1,
      matchesRanked: 1,
      opr: 25.5,
      eventRank: 3,
      tier: "tier1",
      tierOrder: 1,
    })
    expect(rows[7]).toEqual({
      number: 8,
      nickname: "Team 8",
      pitScouted: false,
      reportCount: 0,
      avgRank: null,
      matchesRanked: 0,
      opr: null,
      eventRank: null,
      tier: "uncategorized",
      tierOrder: 8,
    })
    const mine = await s1.as.query(api.teams.list, { tierListId: s1ListId })
    expect(mine[0].tier).toBe("dnp")
  })
})

describe("teams.detail", () => {
  test("null for unknown team; requires auth", async () => {
    const { t, s1 } = await setup()
    expect(await s1.as.query(api.teams.detail, { teamNumber: 999 })).toBeNull()
    await expect(t.query(api.teams.detail, { teamNumber: 1 })).rejects.toMatchObject(code("UNAUTHENTICATED"))
  })

  test("full shape: team, insights, pit, averages, notes, tiers, record, matches", async () => {
    const { admin, s1, s2, matchIds, primaryId, s1ListId } = await setup()
    await admin.as.mutation(api.assignments.create, { scouterId: s2.userId, teamNumber: 1, instructions: "" })
    await s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([2, 1, 3, 4, 5, 6]) })
    await s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 1, text: "free" }] })
    await s2.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 1, text: "assigned" }] })
    await admin.as.mutation(api.pickLists.moveEntry, { listId: primaryId, teamNumber: 1, column: "tier2", order: 1 })
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 1, column: "tier3", order: 1 })

    const d = (await s1.as.query(api.teams.detail, { teamNumber: 1 }))!
    expect(d.team).toEqual({
      number: 1,
      nickname: "Team 1",
      city: "Providence",
      stateProv: "RI",
      country: "USA",
      tbaUrl: expect.stringContaining("thebluealliance.com/team/1"),
    })
    expect(d.insights).toBeNull()
    expect(d.pit).toBeNull()
    expect(d.avgRank).toBe(2)
    expect(d.matchesRanked).toBe(1)
    expect(d.opr).toBeNull()
    expect(d.notes).toHaveLength(2)
    expect(d.notes).toEqual(
      expect.arrayContaining([
        { matchNumber: 1, authorName: "s1", text: "free", fromAssignment: false, createdAt: expect.any(Number) },
        { matchNumber: 1, authorName: "s2", text: "assigned", fromAssignment: true, createdAt: expect.any(Number) },
      ]),
    )
    expect(d.tier).toEqual({ primary: "tier2", mine: "tier3" })
    // No insights -> computed from scores: match 1 red 30-20 win, match 2 blue 15-15 tie, match 3 unplayed.
    expect(d.record).toEqual({ wins: 1, losses: 0, ties: 1 })
    expect(d.matches.map((m) => m.number)).toEqual([1, 2, 3])
    // Admin sees their own personal list as "mine".
    expect((await admin.as.query(api.teams.detail, { teamNumber: 1 }))!.tier).toEqual({
      primary: "tier2",
      mine: "uncategorized",
    })
  })

  test("record prefers TBA insights when present", async () => {
    const { t, s1, eventId } = await setup()
    await t.mutation(internal.events.applyInsights, {
      eventId,
      rankings: [{ teamNumber: 1, rank: 1, rankingScore: 3, wins: 5, losses: 2, ties: 0, matchesPlayed: 7 }],
      oprs: [{ teamNumber: 1, opr: 40, dpr: 5, ccwm: 35 }],
      etags: {},
      syncedAt: 1,
    })
    const d = (await s1.as.query(api.teams.detail, { teamNumber: 1 }))!
    expect(d.record).toEqual({ wins: 5, losses: 2, ties: 0 })
    expect(d.insights).toEqual({ rank: 1, rankingScore: 3, matchesPlayed: 7, opr: 40, dpr: 5, ccwm: 35 })
    expect(d.opr).toBe(40)
  })
})
