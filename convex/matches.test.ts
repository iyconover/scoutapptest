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

describe("matches.history", () => {
  test("requires auth; empty without an event", async () => {
    const t = convexTest(schema, modules)
    await expect(t.query(api.matches.history, {})).rejects.toMatchObject(code("UNAUTHENTICATED"))
    const a = await newUser(t, "a@example.com")
    expect(await a.as.query(api.matches.history, {})).toEqual([])
  })

  test("rows sorted by number with TBA url, scores, per-match avgRank and notes", async () => {
    const t = convexTest(schema, modules)
    const admin = await newUser(t, "admin@example.com")
    const s1 = await newUser(t, "s1@example.com")
    const s2 = await newUser(t, "s2@example.com")
    const eventId = await t.mutation(internal.events.upsertImport, {
      tbaKey: "2026test",
      name: "Test Event",
      startDate: "2026-03-01",
      endDate: "2026-03-03",
      teams: Array.from({ length: 8 }, (_, i) => ({ tbaKey: `frc${i + 1}`, number: i + 1, nickname: `Team ${i + 1}` })),
      matches: [
        { tbaKey: "2026test_qm2", number: 2, red: [7, 8, 1], blue: [2, 3, 4], scheduledTime: 5000 },
        { tbaKey: "2026test_qm1", number: 1, red: [1, 2, 3], blue: [4, 5, 6], redScore: 30, blueScore: 20 },
      ],
    })
    const matchIds = await t.run(async (ctx) => {
      const rows = await ctx.db.query("matches").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect()
      return Object.fromEntries(rows.map((m) => [m.number, m._id])) as Record<number, Id<"matches">>
    })
    await s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) })
    await s2.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([2, 1, 3, 4, 5, 6]) })
    await s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 4, text: "defense" }] })
    await admin.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[1] })
    const manualId = await admin.as.mutation(api.matchScouting.setManualTeams, {
      number: 3,
      red: [1, 2, 3],
      blue: [4, 5, 6],
    })

    const rows = await s1.as.query(api.matches.history, {})
    expect(rows.map((r) => r.number)).toEqual([1, 2, 3])
    expect(rows[0]).toMatchObject({
      _id: matchIds[1],
      tbaKey: "2026test_qm1",
      tbaUrl: "https://www.thebluealliance.com/match/2026test_qm1",
      scheduledTime: null,
      closed: true,
      redScore: 30,
      blueScore: 20,
    })
    expect(rows[0].red).toEqual([
      { teamNumber: 1, avgRank: 1.5, notes: [] },
      { teamNumber: 2, avgRank: 1.5, notes: [] },
      { teamNumber: 3, avgRank: 3, notes: [] },
    ])
    expect(rows[0].blue[0]).toEqual({ teamNumber: 4, avgRank: 4, notes: [{ authorName: "s1", text: "defense" }] })
    expect(rows[1]).toMatchObject({ scheduledTime: 5000, closed: false, redScore: null, blueScore: null })
    expect(rows[1].red[0]).toEqual({ teamNumber: 7, avgRank: null, notes: [] })
    expect(rows[2]).toMatchObject({ _id: manualId, tbaKey: null, tbaUrl: null })
  })
})

describe("presence", () => {
  test("heartbeat upserts by user; list includes every profile with presence or nulls", async () => {
    const t = convexTest(schema, modules)
    const admin = await newUser(t, "admin@example.com")
    const s1 = await newUser(t, "s1@example.com")
    // No event: heartbeat is a no-op.
    await s1.as.mutation(api.presence.heartbeat, { page: "home" })
    expect(await t.run((ctx) => ctx.db.query("presence").collect())).toEqual([])

    await t.mutation(internal.events.upsertImport, {
      tbaKey: "2026test",
      name: "Test Event",
      startDate: "2026-03-01",
      endDate: "2026-03-03",
      teams: [],
      matches: [],
    })
    await s1.as.mutation(api.presence.heartbeat, { page: "home" })
    await s1.as.mutation(api.presence.heartbeat, { page: "match-scouting" })
    expect(await t.run((ctx) => ctx.db.query("presence").collect())).toHaveLength(1)
    const list = await admin.as.query(api.presence.list, {})
    expect(list).toEqual([
      { userId: admin.userId, displayName: "admin", role: "admin", page: null, matchId: null, lastSeen: null },
      {
        userId: s1.userId,
        displayName: "s1",
        role: "scouter",
        page: "match-scouting",
        matchId: null,
        lastSeen: expect.any(Number),
      },
    ])
    await expect(t.query(api.presence.list, {})).rejects.toMatchObject(code("UNAUTHENTICATED"))
  })
})
