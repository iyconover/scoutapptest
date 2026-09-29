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

const MATCHES = [
  { tbaKey: "2026test_qm1", number: 1, red: [1, 2, 3], blue: [4, 5, 6] },
  { tbaKey: "2026test_qm2", number: 2, red: [1, 7, 8], blue: [9, 10, 11] },
  { tbaKey: "2026test_qm3", number: 3, red: [2, 3, 4], blue: [5, 6, 12] },
]

/** admin (first user), lead, three scouters, and an event with 12 teams / 3 qual matches. */
async function setup() {
  const t = convexTest(schema, modules)
  const admin = await newUser(t, "admin@example.com")
  const lead = await newUser(t, "lead@example.com")
  const s1 = await newUser(t, "s1@example.com")
  const s2 = await newUser(t, "s2@example.com")
  const s3 = await newUser(t, "s3@example.com")
  const eventId = await t.mutation(internal.events.upsertImport, {
    tbaKey: "2026test",
    name: "Test Event",
    startDate: "2026-03-01",
    endDate: "2026-03-03",
    teams: Array.from({ length: 12 }, (_, i) => ({ tbaKey: `frc${i + 1}`, number: i + 1, nickname: `Team ${i + 1}` })),
    matches: MATCHES,
  })
  await admin.as.mutation(api.events.setLeadScout, { userId: lead.userId })
  const matchIds = await t.run(async (ctx) => {
    const rows = await ctx.db.query("matches").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect()
    return Object.fromEntries(rows.map((m) => [m.number, m._id])) as Record<number, Id<"matches">>
  })
  return { t, admin, lead, s1, s2, s3, eventId, matchIds }
}

/** Ranks in the given order: first team is rank 1. */
const ranks = (order: number[]) => order.map((teamNumber, i) => ({ teamNumber, rank: i + 1 }))

async function aggregate(t: T, eventId: Id<"events">, teamNumber: number) {
  return await t.run((ctx) =>
    ctx.db
      .query("teamAggregates")
      .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", teamNumber))
      .unique(),
  )
}

describe("matchScouting.current", () => {
  test("returns null without an active event", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "a@example.com")
    expect(await a.as.query(api.matchScouting.current, {})).toBeNull()
  })

  test("roles: lead / assigned / ranker, with assignments filtered to this match", async () => {
    const { admin, lead, s1, s2 } = await setup()
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 2, instructions: "watch intake" })
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 7, instructions: "match 2 only" })
    await admin.as.mutation(api.assignments.create, { scouterId: lead.userId, teamNumber: 1, instructions: "lead too" })

    const s1View = await s1.as.query(api.matchScouting.current, {})
    expect(s1View).toMatchObject({
      matchNumber: 1,
      match: { number: 1, red: [1, 2, 3], blue: [4, 5, 6], closed: false, source: "tba" },
      myRole: "assigned",
      mySubmission: null,
      myNotes: [],
    })
    expect(s1View?.myAssignments).toEqual([
      { assignmentId: expect.any(String), teamNumber: 2, instructions: "watch intake" },
    ])
    expect((await s2.as.query(api.matchScouting.current, {}))?.myRole).toBe("ranker")
    expect((await lead.as.query(api.matchScouting.current, {}))?.myRole).toBe("lead")
    expect((await admin.as.query(api.matchScouting.current, {}))?.myRole).toBe("ranker")
  })

  test("match is null when no match exists at currentMatchNumber", async () => {
    const { lead, s1 } = await setup()
    await lead.as.mutation(api.matchScouting.setCurrentMatchNumber, { number: 50 })
    expect(await s1.as.query(api.matchScouting.current, {})).toEqual({
      matchNumber: 50,
      match: null,
      myRole: "ranker",
      myAssignments: [],
      mySubmission: null,
      myNotes: [],
    })
  })

  test("mySubmission and myNotes reflect the caller's own writes only", async () => {
    const { s1, s2, matchIds } = await setup()
    await s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) })
    await s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 3, text: "fast" }] })
    const mine = await s1.as.query(api.matchScouting.current, {})
    expect(mine?.mySubmission).toEqual({ ranks: ranks([1, 2, 3, 4, 5, 6]) })
    expect(mine?.myNotes).toEqual([{ teamNumber: 3, text: "fast" }])
    const theirs = await s2.as.query(api.matchScouting.current, {})
    expect(theirs?.mySubmission).toBeNull()
    expect(theirs?.myNotes).toEqual([])
  })
})

describe("matchScouting.submitRanking", () => {
  test("requires auth", async () => {
    const { t, matchIds } = await setup()
    await expect(
      t.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) }),
    ).rejects.toMatchObject(code("UNAUTHENTICATED"))
  })

  test("INVALID_RANKING for wrong teams, duplicate ranks, duplicate teams, missing teams, out-of-range ranks", async () => {
    const { s1, matchIds } = await setup()
    const submit = (r: { teamNumber: number; rank: number }[]) =>
      s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: r })
    // wrong team (7 is not in match 1)
    await expect(submit(ranks([1, 2, 3, 4, 5, 7]))).rejects.toMatchObject(code("INVALID_RANKING"))
    // duplicate rank
    await expect(
      submit([
        { teamNumber: 1, rank: 1 },
        { teamNumber: 2, rank: 1 },
        { teamNumber: 3, rank: 3 },
        { teamNumber: 4, rank: 4 },
        { teamNumber: 5, rank: 5 },
        { teamNumber: 6, rank: 6 },
      ]),
    ).rejects.toMatchObject(code("INVALID_RANKING"))
    // duplicate team
    await expect(
      submit([
        { teamNumber: 1, rank: 1 },
        { teamNumber: 1, rank: 2 },
        { teamNumber: 3, rank: 3 },
        { teamNumber: 4, rank: 4 },
        { teamNumber: 5, rank: 5 },
        { teamNumber: 6, rank: 6 },
      ]),
    ).rejects.toMatchObject(code("INVALID_RANKING"))
    // missing team
    await expect(submit(ranks([1, 2, 3, 4, 5]))).rejects.toMatchObject(code("INVALID_RANKING"))
    // out-of-range / non-integer ranks
    await expect(
      submit([1, 2, 3, 4, 5, 6].map((teamNumber, i) => ({ teamNumber, rank: i + 2 }))),
    ).rejects.toMatchObject(code("INVALID_RANKING"))
    await expect(
      submit([1, 2, 3, 4, 5, 6].map((teamNumber, i) => ({ teamNumber, rank: i + 1.5 }))),
    ).rejects.toMatchObject(code("INVALID_RANKING"))
    // nothing was written
    expect((await s1.as.query(api.matchScouting.current, {}))?.mySubmission).toBeNull()
  })

  test("MATCH_CLOSED after the match is closed", async () => {
    const { lead, s1, matchIds } = await setup()
    await lead.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[1] })
    await expect(
      s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) }),
    ).rejects.toMatchObject(code("MATCH_CLOSED"))
  })

  test("ASSIGNED_IN_MATCH for assigned scouters; lead with assignment may still rank", async () => {
    const { admin, lead, s1, matchIds } = await setup()
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 4, instructions: "" })
    await admin.as.mutation(api.assignments.create, { scouterId: lead.userId, teamNumber: 5, instructions: "" })
    await expect(
      s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) }),
    ).rejects.toMatchObject(code("ASSIGNED_IN_MATCH"))
    // s1 is not assigned in match 2 (team 4 isn't in it), so they may rank it
    await s1.as.mutation(api.matchScouting.submitRanking, {
      matchId: matchIds[2],
      ranks: ranks([1, 7, 8, 9, 10, 11]),
    })
    await lead.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) })
  })

  test("NOT_FOUND for a match from another event", async () => {
    const { t, s1 } = await setup()
    const otherMatch = await t.run(async (ctx) => {
      const otherEvent = await ctx.db.insert("events", {
        tbaKey: "2026other",
        name: "Other",
        startDate: "2026-01-01",
        endDate: "2026-01-02",
        currentMatchNumber: 1,
        liveSync: false,
        etags: {},
      })
      return await ctx.db.insert("matches", {
        eventId: otherEvent,
        number: 1,
        red: [1, 2, 3],
        blue: [4, 5, 6],
        source: "manual",
        closed: false,
      })
    })
    await expect(
      s1.as.mutation(api.matchScouting.submitRanking, { matchId: otherMatch, ranks: ranks([1, 2, 3, 4, 5, 6]) }),
    ).rejects.toMatchObject(code("NOT_FOUND"))
  })

  test("resubmission upserts (one row per match+scouter) and recomputes", async () => {
    const { t, s1, eventId, matchIds } = await setup()
    await s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) })
    await s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([6, 5, 4, 3, 2, 1]) })
    const rows = await t.run((ctx) =>
      ctx.db.query("matchRankings").withIndex("by_match", (q) => q.eq("matchId", matchIds[1])).collect(),
    )
    expect(rows).toHaveLength(1)
    expect(await aggregate(t, eventId, 1)).toMatchObject({ avgRank: 6, matchesRanked: 1, reportCount: 1 })
    expect(await aggregate(t, eventId, 6)).toMatchObject({ avgRank: 1, matchesRanked: 1, reportCount: 1 })
  })

  test("aggregates: per-match mean first, then mean across matches", async () => {
    const { t, s1, s2, s3, eventId, matchIds } = await setup()
    // Match 1: team 1 gets ranks 1 and 3.
    await s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) })
    await s2.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([2, 3, 1, 4, 5, 6]) })
    // Match 2: team 1 gets rank 2.
    await s3.as.mutation(api.matchScouting.submitRanking, {
      matchId: matchIds[2],
      ranks: ranks([7, 1, 8, 9, 10, 11]),
    })
    expect(await aggregate(t, eventId, 1)).toMatchObject({ avgRank: 2, matchesRanked: 2, reportCount: 3 })
    // Team 2: ranks 2 and 1 in match 1 only -> 1.5.
    expect(await aggregate(t, eventId, 2)).toMatchObject({ avgRank: 1.5, matchesRanked: 1, reportCount: 2 })

    const perMatch = await t.run((ctx) =>
      ctx.db.query("matchTeamRanks").withIndex("by_match", (q) => q.eq("matchId", matchIds[1])).collect(),
    )
    expect(perMatch).toHaveLength(6)
    expect(perMatch.find((r) => r.teamNumber === 1)).toMatchObject({ avgRank: 2, count: 2, matchNumber: 1 })

    // Surfaces in teams.list
    const list = await s1.as.query(api.teams.list, {})
    expect(list.find((r) => r.number === 1)).toMatchObject({ avgRank: 2, matchesRanked: 2, reportCount: 3 })
    expect(list.find((r) => r.number === 12)).toMatchObject({ avgRank: null, matchesRanked: 0, reportCount: 0 })
  })

  test("reportCount counts rankings plus assignment notes only (not free notes)", async () => {
    const { t, admin, s1, s2, eventId, matchIds } = await setup()
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 7, instructions: "" })
    await s1.as.mutation(api.matchScouting.saveNotes, {
      matchId: matchIds[2],
      notes: [{ teamNumber: 7, text: "assigned note" }],
    })
    expect(await aggregate(t, eventId, 7)).toMatchObject({ reportCount: 1, matchesRanked: 0 })
    expect((await aggregate(t, eventId, 7))?.avgRank).toBeUndefined()

    // A ranker's free note does not count.
    await s2.as.mutation(api.matchScouting.saveNotes, {
      matchId: matchIds[2],
      notes: [{ teamNumber: 7, text: "free note" }, { teamNumber: 8, text: "free note" }],
    })
    expect(await aggregate(t, eventId, 7)).toMatchObject({ reportCount: 1 })
    expect(await aggregate(t, eventId, 8)).toMatchObject({ reportCount: 0 })

    // Ranking adds one more.
    await s2.as.mutation(api.matchScouting.submitRanking, {
      matchId: matchIds[2],
      ranks: ranks([7, 1, 8, 9, 10, 11]),
    })
    expect(await aggregate(t, eventId, 7)).toMatchObject({ reportCount: 2, avgRank: 1, matchesRanked: 1 })

    // Deleting the assignment note drops it again.
    await s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[2], notes: [{ teamNumber: 7, text: "  " }] })
    expect(await aggregate(t, eventId, 7)).toMatchObject({ reportCount: 1 })
  })
})

describe("matchScouting.saveNotes", () => {
  test("upserts per (match, author, team), trims, and deletes on empty text", async () => {
    const { t, s1, matchIds } = await setup()
    const notes = () =>
      t.run((ctx) => ctx.db.query("matchNotes").withIndex("by_match", (q) => q.eq("matchId", matchIds[1])).collect())
    await s1.as.mutation(api.matchScouting.saveNotes, {
      matchId: matchIds[1],
      notes: [{ teamNumber: 1, text: " first " }, { teamNumber: 2, text: "two" }],
    })
    await s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 1, text: "second" }] })
    let rows = await notes()
    expect(rows).toHaveLength(2)
    expect(rows.find((n) => n.teamNumber === 1)).toMatchObject({ text: "second", matchNumber: 1 })
    expect(rows.find((n) => n.teamNumber === 1)?.assignmentId).toBeUndefined()
    await s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 1, text: "" }] })
    rows = await notes()
    expect(rows.map((n) => n.teamNumber)).toEqual([2])
  })

  test("rejects teams not in the match", async () => {
    const { s1, matchIds } = await setup()
    await expect(
      s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 7, text: "x" }] }),
    ).rejects.toMatchObject(code("INVALID_ARGUMENT"))
  })

  test("rejects closed matches", async () => {
    const { admin, s1, matchIds } = await setup()
    await admin.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[1] })
    await expect(
      s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 1, text: "x" }] }),
    ).rejects.toMatchObject(code("MATCH_CLOSED"))
  })

  test("assigned scouters may only write notes for their assigned teams; assignmentId is set", async () => {
    const { t, admin, s1, matchIds } = await setup()
    const assignmentId = await admin.as.mutation(api.assignments.create, {
      scouterId: s1.userId,
      teamNumber: 2,
      instructions: "",
    })
    await expect(
      s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 3, text: "x" }] }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    await s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 2, text: "ok" }] })
    const rows = await t.run((ctx) =>
      ctx.db.query("matchNotes").withIndex("by_match", (q) => q.eq("matchId", matchIds[1])).collect(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ teamNumber: 2, text: "ok", assignmentId })
  })
})

describe("matchScouting lead/admin controls", () => {
  test("closeMatch: scouter FORBIDDEN; lead and admin allowed", async () => {
    const { t, admin, lead, s1, matchIds } = await setup()
    await expect(s1.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[1] })).rejects.toMatchObject(
      code("FORBIDDEN"),
    )
    await lead.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[1] })
    await admin.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[2] })
    const m1 = await t.run((ctx) => ctx.db.get(matchIds[1]))
    expect(m1).toMatchObject({ closed: true, closedBy: lead.userId })
  })

  test("closeMatch advances currentMatchNumber only when it equals the match number", async () => {
    const { admin, lead, matchIds } = await setup()
    const current = async () => (await admin.as.query(api.events.active, {}))?.currentMatchNumber
    expect(await current()).toBe(1)
    await lead.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[2] })
    expect(await current()).toBe(1)
    await lead.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[1] })
    expect(await current()).toBe(2)
    // Re-closing an already-closed match changes nothing.
    await lead.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[1] })
    expect(await current()).toBe(2)
    await lead.as.mutation(api.matchScouting.setCurrentMatchNumber, { number: 3 })
    await lead.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[3] })
    expect(await current()).toBe(4)
  })

  test("setCurrentMatchNumber: lead/admin only; validates range", async () => {
    const { admin, lead, s1 } = await setup()
    await expect(s1.as.mutation(api.matchScouting.setCurrentMatchNumber, { number: 2 })).rejects.toMatchObject(
      code("FORBIDDEN"),
    )
    await lead.as.mutation(api.matchScouting.setCurrentMatchNumber, { number: 2 })
    expect((await s1.as.query(api.matchScouting.current, {}))?.matchNumber).toBe(2)
    await admin.as.mutation(api.matchScouting.setCurrentMatchNumber, { number: 3 })
    expect((await s1.as.query(api.matchScouting.current, {}))?.matchNumber).toBe(3)
    await expect(lead.as.mutation(api.matchScouting.setCurrentMatchNumber, { number: 0 })).rejects.toMatchObject(
      code("INVALID_ARGUMENT"),
    )
  })

  test("setManualTeams: lead/admin only; creates and edits manual matches", async () => {
    const { t, admin, lead, s1, eventId } = await setup()
    await expect(
      s1.as.mutation(api.matchScouting.setManualTeams, { number: 10, red: [1, 2, 3], blue: [4, 5, 6] }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    const id = await lead.as.mutation(api.matchScouting.setManualTeams, { number: 10, red: [1, 2, 3], blue: [4, 5, 6] })
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      eventId,
      number: 10,
      source: "manual",
      closed: false,
      red: [1, 2, 3],
      blue: [4, 5, 6],
    })
    const again = await admin.as.mutation(api.matchScouting.setManualTeams, {
      number: 10,
      red: [7, 8, 9],
      blue: [10, 11, 12],
    })
    expect(again).toBe(id)
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ red: [7, 8, 9], blue: [10, 11, 12] })
  })

  test("setManualTeams refuses TBA matches and matches that already have rankings", async () => {
    const { lead, s1 } = await setup()
    await expect(
      lead.as.mutation(api.matchScouting.setManualTeams, { number: 1, red: [7, 8, 9], blue: [10, 11, 12] }),
    ).rejects.toMatchObject({ data: expect.objectContaining({ code: expect.any(String) }) })
    const id = await lead.as.mutation(api.matchScouting.setManualTeams, { number: 20, red: [1, 2, 3], blue: [4, 5, 6] })
    await s1.as.mutation(api.matchScouting.submitRanking, { matchId: id, ranks: ranks([1, 2, 3, 4, 5, 6]) })
    await expect(
      lead.as.mutation(api.matchScouting.setManualTeams, { number: 20, red: [7, 8, 9], blue: [10, 11, 12] }),
    ).rejects.toMatchObject({ data: expect.objectContaining({ code: expect.any(String) }) })
  })

  test("setManualTeams validates six distinct event teams", async () => {
    const { lead } = await setup()
    await expect(
      lead.as.mutation(api.matchScouting.setManualTeams, { number: 10, red: [1, 2, 3], blue: [3, 4, 5] }),
    ).rejects.toMatchObject(code("INVALID_ARGUMENT"))
    await expect(
      lead.as.mutation(api.matchScouting.setManualTeams, { number: 10, red: [1, 2], blue: [3, 4, 5] }),
    ).rejects.toMatchObject(code("INVALID_ARGUMENT"))
    await expect(
      lead.as.mutation(api.matchScouting.setManualTeams, { number: 10, red: [1, 2, 3], blue: [4, 5, 999] }),
    ).rejects.toMatchObject(code("INVALID_ARGUMENT"))
  })

  test("leadPanel: lead/admin only; reports per-profile status for the match", async () => {
    const { admin, lead, s1, s2, s3, matchIds } = await setup()
    await expect(s1.as.query(api.matchScouting.leadPanel, { matchId: matchIds[1] })).rejects.toMatchObject(
      code("FORBIDDEN"),
    )
    await admin.as.mutation(api.assignments.create, { scouterId: s3.userId, teamNumber: 4, instructions: "" })
    await admin.as.mutation(api.assignments.create, { scouterId: s3.userId, teamNumber: 12, instructions: "" })
    await s1.as.mutation(api.matchScouting.submitRanking, { matchId: matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) })
    await s2.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 1, text: "n" }] })
    await s1.as.mutation(api.presence.heartbeat, { page: "match-scouting", matchId: matchIds[1] })

    const panel = await lead.as.query(api.matchScouting.leadPanel, { matchId: matchIds[1] })
    expect(panel).toHaveLength(5)
    const row = (id: Id<"users">) => panel.find((r) => r.userId === id)
    expect(row(s1.userId)).toMatchObject({
      displayName: "s1",
      page: "match-scouting",
      lastSeen: expect.any(Number),
      submittedRanking: true,
      submittedNotes: false,
      assignedTeams: [],
    })
    expect(row(s2.userId)).toMatchObject({ submittedRanking: false, submittedNotes: true, page: null, lastSeen: null })
    // Team 12 isn't in match 1, so only team 4 shows.
    expect(row(s3.userId)).toMatchObject({ assignedTeams: [4] })
    expect(await admin.as.query(api.matchScouting.leadPanel, { matchId: matchIds[1] })).toHaveLength(5)
  })
})
