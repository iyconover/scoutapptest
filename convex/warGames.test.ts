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

const TEAM_COUNT = 30

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
    teams: Array.from({ length: TEAM_COUNT }, (_, i) => ({
      tbaKey: `frc${i + 1}`,
      number: i + 1,
      nickname: `Team ${i + 1}`,
    })),
    matches: [
      { tbaKey: "2026test_qm1", number: 1, red: [1, 2, 3], blue: [4, 5, 6], redScore: 10, blueScore: 20 },
      { tbaKey: "2026test_qm2", number: 2, red: [1, 2, 3], blue: [4, 5, 6] },
      { tbaKey: "2026test_qm3", number: 3, red: [7, 8, 9], blue: [10, 11, 12] },
    ],
  })
  const matchIds = await t.run(async (ctx) => {
    const rows = await ctx.db.query("matches").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect()
    return Object.fromEntries(rows.map((m) => [m.number, m._id])) as Record<number, Id<"matches">>
  })
  return { t, admin, s1, s2, eventId, matchIds }
}

const emptyAlliance = () => ({ slots: [null, null, null] as (number | null)[], locked: [false, false, false] })
const emptyBoard = () => Array.from({ length: 8 }, emptyAlliance)

describe("warGames.create / get / list", () => {
  test("create seeds captains by predicted rank with empty picks; get has the documented shape", async () => {
    const { s1, matchIds } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "Scenario A" })
    const res = await s1.as.query(api.warGames.get, { warGameId: id })
    expect(res?.scenario).toMatchObject({
      _id: id,
      name: "Scenario A",
      createdByName: "s1",
      method: "ourRank",
      winRP: 3,
      tieRP: 1,
    })
    const seeds = res!.standings.slice(0, 8).map((s) => s.teamNumber)
    expect(res?.scenario.alliances).toEqual(
      seeds.map((captain) => ({ slots: [captain, null, null], locked: [false, false, false] })),
    )
    expect(res?.canEdit).toBe(true)
    // Unplayed quals only (match 1 has scores).
    expect(res?.predictions.map((p) => p.number)).toEqual([2, 3])
    expect(res?.predictions[0]).toEqual({
      matchId: matchIds[2],
      number: 2,
      red: [1, 2, 3],
      blue: [4, 5, 6],
      redRP: 1,
      blueRP: 1,
      manual: false,
      suggested: { redRP: 1, blueRP: 1 },
    })
    expect(res?.standings).toHaveLength(TEAM_COUNT)
    expect(res?.standings[0]).toEqual({
      teamNumber: expect.any(Number),
      currentRank: null,
      predictedRank: 1,
      predictedRS: expect.any(Number),
    })
    expect(res?.teams).toHaveLength(TEAM_COUNT)
    expect(res?.teams[0]).toEqual({
      teamNumber: expect.any(Number),
      nickname: expect.stringMatching(/^Team /),
      eventRank: null,
      predictedRank: 1,
      avgRank: null,
      opr: null,
    })
  })

  test("suggestions use OPR when every team has one", async () => {
    const { t, s1, eventId } = await setup()
    await t.mutation(internal.events.applyInsights, {
      eventId,
      oprs: Array.from({ length: TEAM_COUNT }, (_, i) => ({ teamNumber: i + 1, opr: (i + 1) * 10 })),
      etags: {},
      syncedAt: 1,
    })
    const id = await s1.as.mutation(api.warGames.create, { name: "OPR" })
    const res = await s1.as.query(api.warGames.get, { warGameId: id })
    // Match 2: red 1+2+3 = 60 vs blue 4+5+6 = 150 -> blue wins.
    expect(res?.predictions[0]).toMatchObject({ redRP: 0, blueRP: 3, suggested: { redRP: 0, blueRP: 3 } })
    expect(res?.teams.find((x) => x.teamNumber === 7)?.opr).toBe(70)
  })

  test("list returns scenarios with creator name; get returns null for unknown / no event", async () => {
    const { s1, s2 } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    expect(await s2.as.query(api.warGames.list, {})).toEqual([
      { _id: id, name: "A", createdByName: "s1", method: "ourRank", createdAt: expect.any(Number) },
    ])
    const t2 = convexTest(schema, modules)
    const lonely = await newUser(t2, "x@example.com")
    expect(await lonely.as.query(api.warGames.list, {})).toEqual([])
  })

  test("canEdit is true for the creator and admins only", async () => {
    const { admin, s1, s2 } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    expect((await s1.as.query(api.warGames.get, { warGameId: id }))?.canEdit).toBe(true)
    expect((await admin.as.query(api.warGames.get, { warGameId: id }))?.canEdit).toBe(true)
    expect((await s2.as.query(api.warGames.get, { warGameId: id }))?.canEdit).toBe(false)
  })

  test("non-editors are FORBIDDEN from every mutation; admin can edit", async () => {
    const { admin, s1, s2, matchIds } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    const forbidden = [
      () => s2.as.mutation(api.warGames.rename, { warGameId: id, name: "B" }),
      () => s2.as.mutation(api.warGames.setPrediction, { warGameId: id, matchId: matchIds[2], redRP: 1, blueRP: 1 }),
      () => s2.as.mutation(api.warGames.resetPredictions, { warGameId: id }),
      () => s2.as.mutation(api.warGames.updateSettings, { warGameId: id, winRP: 2 }),
      () => s2.as.mutation(api.warGames.runDraft, { warGameId: id }),
      () => s2.as.mutation(api.warGames.setAlliances, { warGameId: id, alliances: emptyBoard() }),
      () => s2.as.mutation(api.warGames.toggleLock, { warGameId: id, alliance: 0, slot: 0 }),
      () => s2.as.mutation(api.warGames.remove, { warGameId: id }),
    ]
    for (const run of forbidden) await expect(run()).rejects.toMatchObject(code("FORBIDDEN"))
    await admin.as.mutation(api.warGames.rename, { warGameId: id, name: "Renamed" })
    expect((await s2.as.query(api.warGames.get, { warGameId: id }))?.scenario.name).toBe("Renamed")
  })
})

describe("warGames predictions", () => {
  test("setPrediction marks manual and changes standings; resetPredictions restores suggestions", async () => {
    const { s1, matchIds } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    const before = (await s1.as.query(api.warGames.get, { warGameId: id }))!
    const rsBefore = new Map(before.standings.map((s) => [s.teamNumber, s.predictedRS]))
    expect(rsBefore.get(1)).toBe(1)
    expect(rsBefore.get(4)).toBe(1)

    await s1.as.mutation(api.warGames.setPrediction, { warGameId: id, matchId: matchIds[2], redRP: 4, blueRP: 0 })
    const after = (await s1.as.query(api.warGames.get, { warGameId: id }))!
    expect(after.predictions.find((p) => p.number === 2)).toMatchObject({
      redRP: 4,
      blueRP: 0,
      manual: true,
      suggested: { redRP: 1, blueRP: 1 },
    })
    expect(after.predictions.find((p) => p.number === 3)).toMatchObject({ manual: false })
    const rsAfter = new Map(after.standings.map((s) => [s.teamNumber, s.predictedRS]))
    expect(rsAfter.get(1)).toBe(4)
    expect(rsAfter.get(4)).toBe(0)
    expect(after.standings.slice(0, 3).map((s) => s.teamNumber)).toEqual([1, 2, 3])
    expect(after.teams.find((x) => x.teamNumber === 1)?.predictedRank).toBe(1)

    // Overwriting keeps one row.
    await s1.as.mutation(api.warGames.setPrediction, { warGameId: id, matchId: matchIds[2], redRP: 2, blueRP: 2 })
    expect((await s1.as.query(api.warGames.get, { warGameId: id }))!.predictions[0]).toMatchObject({
      redRP: 2,
      blueRP: 2,
      manual: true,
    })

    await s1.as.mutation(api.warGames.resetPredictions, { warGameId: id })
    const reset = (await s1.as.query(api.warGames.get, { warGameId: id }))!
    expect(reset.predictions.every((p) => !p.manual)).toBe(true)
    expect(reset.predictions[0]).toMatchObject({ redRP: 1, blueRP: 1 })
    expect(reset.standings).toEqual(before.standings)
  })

  test("setPrediction validates RP", async () => {
    const { s1, matchIds } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    await expect(
      s1.as.mutation(api.warGames.setPrediction, { warGameId: id, matchId: matchIds[2], redRP: -1, blueRP: 0 }),
    ).rejects.toMatchObject(code("INVALID_ARGUMENT"))
    await expect(
      s1.as.mutation(api.warGames.setPrediction, { warGameId: id, matchId: matchIds[2], redRP: 1.5, blueRP: 0 }),
    ).rejects.toMatchObject(code("INVALID_ARGUMENT"))
  })

  test("updateSettings changes winRP/tieRP which feed suggestions", async () => {
    const { s1 } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    await s1.as.mutation(api.warGames.updateSettings, { warGameId: id, tieRP: 2, method: "opr" })
    const res = (await s1.as.query(api.warGames.get, { warGameId: id }))!
    expect(res.scenario).toMatchObject({ tieRP: 2, method: "opr" })
    expect(res.predictions[0].suggested).toEqual({ redRP: 2, blueRP: 2 })
    await expect(
      s1.as.mutation(api.warGames.updateSettings, { warGameId: id, manualOrder: [1, 1] }),
    ).rejects.toMatchObject(code("INVALID_ARGUMENT"))
  })
})

describe("warGames draft board", () => {
  test("runDraft fills all 24 slots with distinct event teams", async () => {
    const { s1 } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    await s1.as.mutation(api.warGames.runDraft, { warGameId: id })
    const alliances = (await s1.as.query(api.warGames.get, { warGameId: id }))!.scenario.alliances
    expect(alliances).toHaveLength(8)
    const placed = alliances.flatMap((a) => a.slots)
    expect(placed).toHaveLength(24)
    expect(placed.every((x) => typeof x === "number" && x >= 1 && x <= TEAM_COUNT)).toBe(true)
    expect(new Set(placed).size).toBe(24)
  })

  test("clearBoard keeps captains and locked teams; a locked seed is skipped for captain", async () => {
    const { s1 } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    const before = (await s1.as.query(api.warGames.get, { warGameId: id }))!
    const seeds = before.standings.map((s) => s.teamNumber)
    await s1.as.mutation(api.warGames.runDraft, { warGameId: id })
    // Lock the #1 seed into alliance 3's pick 1: it can't also captain.
    const board = emptyBoard()
    board[2].slots[1] = seeds[0]
    await s1.as.mutation(api.warGames.setAlliances, { warGameId: id, alliances: board })
    await s1.as.mutation(api.warGames.toggleLock, { warGameId: id, alliance: 2, slot: 1 })

    await s1.as.mutation(api.warGames.clearBoard, { warGameId: id })
    const alliances = (await s1.as.query(api.warGames.get, { warGameId: id }))!.scenario.alliances
    expect(alliances.map((a) => a.slots[0])).toEqual(seeds.slice(1, 9))
    expect(alliances[2]).toEqual({ slots: [seeds[3], seeds[0], null], locked: [false, true, false] })
    expect(alliances.flatMap((a, i) => (i === 2 ? [a.slots[2]] : a.slots.slice(1)))).toEqual(Array(15).fill(null))
  })

  test("runDraft respects a locked slot", async () => {
    const { s1 } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    const board = emptyBoard()
    board[2].slots[1] = 30
    await s1.as.mutation(api.warGames.setAlliances, { warGameId: id, alliances: board })
    await s1.as.mutation(api.warGames.toggleLock, { warGameId: id, alliance: 2, slot: 1 })
    let alliances = (await s1.as.query(api.warGames.get, { warGameId: id }))!.scenario.alliances
    expect(alliances[2]).toMatchObject({ slots: [expect.any(Number), 30, null], locked: [false, true, false] })

    await s1.as.mutation(api.warGames.runDraft, { warGameId: id })
    alliances = (await s1.as.query(api.warGames.get, { warGameId: id }))!.scenario.alliances
    expect(alliances[2].slots[1]).toBe(30)
    expect(alliances[2].locked).toEqual([false, true, false])
    const placed = alliances.flatMap((a) => a.slots)
    expect(placed.filter((x) => x === 30)).toHaveLength(1)
    expect(new Set(placed).size).toBe(24)
    expect(placed.every((x) => x !== null)).toBe(true)
  })

  test("toggleLock twice unlocks; bad slot is INVALID_ARGUMENT", async () => {
    const { s1 } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    await s1.as.mutation(api.warGames.toggleLock, { warGameId: id, alliance: 0, slot: 0 })
    await s1.as.mutation(api.warGames.toggleLock, { warGameId: id, alliance: 0, slot: 0 })
    expect((await s1.as.query(api.warGames.get, { warGameId: id }))!.scenario.alliances[0].locked).toEqual([
      false,
      false,
      false,
    ])
    await expect(s1.as.mutation(api.warGames.toggleLock, { warGameId: id, alliance: 8, slot: 0 })).rejects.toMatchObject(
      code("INVALID_ARGUMENT"),
    )
    await expect(s1.as.mutation(api.warGames.toggleLock, { warGameId: id, alliance: 0, slot: 3 })).rejects.toMatchObject(
      code("INVALID_ARGUMENT"),
    )
  })

  test("setAlliances rejects duplicate teams, unknown teams and bad shapes", async () => {
    const { s1 } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    const dup = emptyBoard()
    dup[0].slots[0] = 5
    dup[3].slots[2] = 5
    await expect(s1.as.mutation(api.warGames.setAlliances, { warGameId: id, alliances: dup })).rejects.toMatchObject(
      code("INVALID_ARGUMENT"),
    )
    const unknown = emptyBoard()
    unknown[0].slots[0] = 999
    await expect(
      s1.as.mutation(api.warGames.setAlliances, { warGameId: id, alliances: unknown }),
    ).rejects.toMatchObject(code("INVALID_ARGUMENT"))
    await expect(
      s1.as.mutation(api.warGames.setAlliances, { warGameId: id, alliances: emptyBoard().slice(0, 7) }),
    ).rejects.toMatchObject(code("INVALID_ARGUMENT"))
    const ok = emptyBoard()
    ok[0].slots = [1, 2, 3]
    await s1.as.mutation(api.warGames.setAlliances, { warGameId: id, alliances: ok })
    expect((await s1.as.query(api.warGames.get, { warGameId: id }))!.scenario.alliances[0].slots).toEqual([1, 2, 3])
  })

  test("remove deletes the scenario and its predictions", async () => {
    const { t, s1, matchIds } = await setup()
    const id = await s1.as.mutation(api.warGames.create, { name: "A" })
    await s1.as.mutation(api.warGames.setPrediction, { warGameId: id, matchId: matchIds[2], redRP: 1, blueRP: 1 })
    await s1.as.mutation(api.warGames.remove, { warGameId: id })
    expect(await s1.as.query(api.warGames.get, { warGameId: id })).toBeNull()
    expect(await t.run((ctx) => ctx.db.query("warGamePredictions").collect())).toEqual([])
  })
})
