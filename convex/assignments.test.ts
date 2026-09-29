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
    teams: Array.from({ length: 12 }, (_, i) => ({ tbaKey: `frc${i + 1}`, number: i + 1, nickname: `Team ${i + 1}` })),
    matches: [
      { tbaKey: "2026test_qm1", number: 1, red: [1, 2, 3], blue: [4, 5, 6] },
      { tbaKey: "2026test_qm2", number: 2, red: [1, 2, 7], blue: [8, 9, 10] },
      { tbaKey: "2026test_qm3", number: 3, red: [1, 11, 12], blue: [2, 7, 5] },
      { tbaKey: "2026test_qm4", number: 4, red: [3, 4, 5], blue: [6, 7, 8] },
    ],
  })
  const matchIds = await t.run(async (ctx) => {
    const rows = await ctx.db.query("matches").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect()
    return Object.fromEntries(rows.map((m) => [m.number, m._id])) as Record<number, Id<"matches">>
  })
  return { t, admin, s1, s2, eventId, matchIds }
}

describe("assignments", () => {
  test("create / list / previewConflicts / updateInstructions / remove are admin-only", async () => {
    const { admin, s1 } = await setup()
    await expect(
      s1.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 1, instructions: "" }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    await expect(s1.as.query(api.assignments.list, {})).rejects.toMatchObject(code("FORBIDDEN"))
    await expect(
      s1.as.query(api.assignments.previewConflicts, { scouterId: s1.userId, teamNumber: 1 }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    const id = await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 1, instructions: "" })
    await expect(
      s1.as.mutation(api.assignments.updateInstructions, { assignmentId: id, instructions: "x" }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    await expect(s1.as.mutation(api.assignments.remove, { assignmentId: id })).rejects.toMatchObject(code("FORBIDDEN"))
  })

  test("create validates scouter and team", async () => {
    const { t, admin, s1 } = await setup()
    await expect(
      admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 999, instructions: "" }),
    ).rejects.toMatchObject(code("NOT_FOUND"))
    const ghost = await newUser(t, "ghost@example.com", false)
    await expect(
      admin.as.mutation(api.assignments.create, { scouterId: ghost.userId, teamNumber: 1, instructions: "" }),
    ).rejects.toMatchObject(code("NOT_FOUND"))
  })

  test("list and mine return the documented shapes", async () => {
    const { admin, s1, s2 } = await setup()
    const a1 = await admin.as.mutation(api.assignments.create, {
      scouterId: s1.userId,
      teamNumber: 3,
      instructions: "  watch climb ",
    })
    const a2 = await admin.as.mutation(api.assignments.create, { scouterId: s2.userId, teamNumber: 4, instructions: "" })
    expect(await admin.as.query(api.assignments.list, {})).toEqual([
      { _id: a1, scouterId: s1.userId, scouterName: "s1", teamNumber: 3, nickname: "Team 3", instructions: "watch climb" },
      { _id: a2, scouterId: s2.userId, scouterName: "s2", teamNumber: 4, nickname: "Team 4", instructions: "" },
    ])
    expect(await s1.as.query(api.assignments.mine, {})).toEqual([
      { _id: a1, teamNumber: 3, nickname: "Team 3", instructions: "watch climb" },
    ])
  })

  test("a third team in the same future match throws ASSIGNMENT_CONFLICT with matchNumbers", async () => {
    const { admin, s1 } = await setup()
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 1, instructions: "" })
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 2, instructions: "" })
    expect(await admin.as.query(api.assignments.previewConflicts, { scouterId: s1.userId, teamNumber: 7 })).toEqual({
      matchNumbers: [2, 3],
    })
    await expect(
      admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 7, instructions: "" }),
    ).rejects.toMatchObject({ data: expect.objectContaining({ code: "ASSIGNMENT_CONFLICT", matchNumbers: [2, 3] }) })
    // No row was written.
    expect(await s1.as.query(api.assignments.mine, {})).toHaveLength(2)
    // Team 3 only shares match 1 with {1, 2} -> conflict in match 1.
    expect(await admin.as.query(api.assignments.previewConflicts, { scouterId: s1.userId, teamNumber: 3 })).toEqual({
      matchNumbers: [1],
    })
    // A different scouter has no conflict.
    expect(await admin.as.query(api.assignments.previewConflicts, { scouterId: admin.userId, teamNumber: 7 })).toEqual({
      matchNumbers: [],
    })
  })

  test("closed and past matches don't conflict", async () => {
    const { admin, s1, matchIds } = await setup()
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 1, instructions: "" })
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 2, instructions: "" })
    // Closing match 2 (not current) leaves match 3.
    await admin.as.mutation(api.matchScouting.closeMatch, { matchId: matchIds[2] })
    expect(await admin.as.query(api.assignments.previewConflicts, { scouterId: s1.userId, teamNumber: 7 })).toEqual({
      matchNumbers: [3],
    })
    // Moving the current match past 3 leaves nothing (match 3 is now in the past).
    await admin.as.mutation(api.matchScouting.setCurrentMatchNumber, { number: 4 })
    expect(await admin.as.query(api.assignments.previewConflicts, { scouterId: s1.userId, teamNumber: 7 })).toEqual({
      matchNumbers: [],
    })
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 7, instructions: "" })
    expect((await s1.as.query(api.assignments.mine, {})).map((a) => a.teamNumber)).toEqual([1, 2, 7])
  })

  test("re-creating the same (scouter, team) pair updates instructions instead of duplicating", async () => {
    const { t, admin, s1 } = await setup()
    const id1 = await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 5, instructions: "a" })
    const id2 = await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 5, instructions: "b" })
    expect(id2).toBe(id1)
    const rows = await t.run((ctx) => ctx.db.query("assignments").collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ instructions: "b", active: true, createdBy: admin.userId })
  })

  test("updateInstructions changes the text", async () => {
    const { admin, s1 } = await setup()
    const id = await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 5, instructions: "a" })
    await admin.as.mutation(api.assignments.updateInstructions, { assignmentId: id, instructions: "new" })
    expect(await s1.as.query(api.assignments.mine, {})).toEqual([
      { _id: id, teamNumber: 5, nickname: "Team 5", instructions: "new" },
    ])
  })

  test("remove soft-deletes: row kept with active=false, hidden from list/mine, notes keep their link", async () => {
    const { t, admin, s1, matchIds } = await setup()
    const id = await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 1, instructions: "" })
    await s1.as.mutation(api.matchScouting.saveNotes, { matchId: matchIds[1], notes: [{ teamNumber: 1, text: "note" }] })
    await admin.as.mutation(api.assignments.remove, { assignmentId: id })
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ active: false })
    expect(await admin.as.query(api.assignments.list, {})).toEqual([])
    expect(await s1.as.query(api.assignments.mine, {})).toEqual([])
    const note = await t.run((ctx) =>
      ctx.db.query("matchNotes").withIndex("by_match", (q) => q.eq("matchId", matchIds[1])).unique(),
    )
    expect(note?.assignmentId).toBe(id)
    // Removed assignment no longer makes the scouter "assigned".
    expect((await s1.as.query(api.matchScouting.current, {}))?.myRole).toBe("ranker")
    // Removing twice is NOT_FOUND.
    await expect(admin.as.mutation(api.assignments.remove, { assignmentId: id })).rejects.toMatchObject(
      code("NOT_FOUND"),
    )
  })

  test("removed assignments no longer count toward conflicts", async () => {
    const { admin, s1 } = await setup()
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 1, instructions: "" })
    const id2 = await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 2, instructions: "" })
    await admin.as.mutation(api.assignments.remove, { assignmentId: id2 })
    await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 7, instructions: "" })
    expect((await s1.as.query(api.assignments.mine, {})).map((a) => a.teamNumber)).toEqual([1, 7])
  })

  test("mine() persists across sessions (no session dependency)", async () => {
    const { t, admin, s1 } = await setup()
    const id = await admin.as.mutation(api.assignments.create, { scouterId: s1.userId, teamNumber: 6, instructions: "x" })
    const otherSession = t.withIdentity({ subject: `${s1.userId}|another-session` })
    expect(await otherSession.query(api.assignments.mine, {})).toEqual([
      { _id: id, teamNumber: 6, nickname: "Team 6", instructions: "x" },
    ])
  })

  test("mine() is empty and list() is empty without an active event; create throws NO_ACTIVE_EVENT", async () => {
    const t = convexTest(schema, modules)
    const admin = await newUser(t, "admin@example.com")
    expect(await admin.as.query(api.assignments.mine, {})).toEqual([])
    expect(await admin.as.query(api.assignments.list, {})).toEqual([])
    await expect(
      admin.as.mutation(api.assignments.create, { scouterId: admin.userId, teamNumber: 1, instructions: "" }),
    ).rejects.toMatchObject(code("NO_ACTIVE_EVENT"))
  })
})
