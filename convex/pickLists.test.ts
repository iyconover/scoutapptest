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
    teams: Array.from({ length: 12 }, (_, i) => ({ tbaKey: `frc${i + 1}`, number: i + 1, nickname: `Team ${i + 1}` })),
    matches: [
      { tbaKey: "2026test_qm1", number: 1, red: [1, 2, 3], blue: [4, 5, 6] },
      { tbaKey: "2026test_qm2", number: 2, red: [1, 7, 8], blue: [9, 10, 11] },
    ],
  })
  const matchIds = await t.run(async (ctx) => {
    const rows = await ctx.db.query("matches").withIndex("by_event_number", (q) => q.eq("eventId", eventId)).collect()
    return Object.fromEntries(rows.map((m) => [m.number, m._id])) as Record<number, Id<"matches">>
  })
  const overview = (await admin.as.query(api.pickLists.overview, {}))!
  const primaryId = overview.primary!._id
  const s1Overview = (await s1.as.query(api.pickLists.overview, {}))!
  const s1ListId = s1Overview.mine[0]._id
  const s2ListId = (await s2.as.query(api.pickLists.overview, {}))!.mine[0]._id
  return { t, admin, s1, s2, eventId, matchIds, primaryId, s1ListId, s2ListId }
}

/** s1: match 1 -> 1..6 = ranks 1..6; match 2 -> 7:1, 1:2, 8:3, 9:4, 10:5, 11:6. s2 ranks match 1 reversed. */
async function seedRankings(ctx: Awaited<ReturnType<typeof setup>>) {
  await ctx.s1.as.mutation(api.matchScouting.submitRanking, { matchId: ctx.matchIds[1], ranks: ranks([1, 2, 3, 4, 5, 6]) })
  await ctx.s1.as.mutation(api.matchScouting.submitRanking, {
    matchId: ctx.matchIds[2],
    ranks: ranks([7, 1, 8, 9, 10, 11]),
  })
  await ctx.s2.as.mutation(api.matchScouting.submitRanking, { matchId: ctx.matchIds[1], ranks: ranks([6, 5, 4, 3, 2, 1]) })
}
/** s1's own averages from seedRankings. */
const S1_AVG: Record<number, number> = { 1: 1.5, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 1, 8: 3, 9: 4, 10: 5, 11: 6 }

type Entry = { teamNumber: number; column: string; order: number }
const column = (entries: Entry[], c: string) => entries.filter((e) => e.column === c).map((e) => e.teamNumber)

describe("pickLists.overview / get", () => {
  test("overview has primary, mine and others with ownerName and canEdit", async () => {
    const { admin, s1, primaryId, s1ListId, s2ListId } = await setup()
    const forS1 = await s1.as.query(api.pickLists.overview, {})
    expect(forS1).toEqual({
      primary: { _id: primaryId, name: "Primary", kind: "primary", ownerName: null, canEdit: false },
      mine: [{ _id: s1ListId, name: "My list", kind: "personal", ownerName: "s1", canEdit: true }],
      others: [
        { _id: expect.any(String), name: "My list", kind: "personal", ownerName: "admin", canEdit: false },
        { _id: s2ListId, name: "My list", kind: "personal", ownerName: "s2", canEdit: false },
      ],
    })
    const forAdmin = await admin.as.query(api.pickLists.overview, {})
    expect(forAdmin?.primary?.canEdit).toBe(true)
    // Admin still can't edit someone else's personal list.
    expect(forAdmin?.others.every((l) => !l.canEdit)).toBe(true)
  })

  test("overview is null without an active event; requires auth", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "a@example.com")
    expect(await a.as.query(api.pickLists.overview, {})).toBeNull()
    await expect(t.query(api.pickLists.overview, {})).rejects.toMatchObject(code("UNAUTHENTICATED"))
  })

  test("get returns every team with nickname, avgRank, column, order, selected; anyone can read any list", async () => {
    const ctx = await setup()
    await seedRankings(ctx)
    const res = await ctx.s2.as.query(api.pickLists.get, { listId: ctx.s1ListId })
    expect(res?.list).toEqual({ _id: ctx.s1ListId, name: "My list", kind: "personal", ownerName: "s1", canEdit: false })
    expect(res?.entries).toHaveLength(12)
    expect(res?.entries[0]).toEqual({
      teamNumber: 1,
      nickname: "Team 1",
      avgRank: expect.any(Number),
      column: "uncategorized",
      order: expect.any(Number),
      selected: false,
    })
    // Team 1: match 1 mean(1, 6) = 3.5; match 2 = 2 -> 2.75
    expect(res?.entries.find((e) => e.teamNumber === 1)?.avgRank).toBe(2.75)
    expect(res?.entries.find((e) => e.teamNumber === 12)?.avgRank).toBeNull()
  })
})

describe("pickLists edit permissions", () => {
  test("primary is editable only by admins", async () => {
    const { admin, s1, primaryId } = await setup()
    await expect(
      s1.as.mutation(api.pickLists.moveEntry, { listId: primaryId, teamNumber: 1, column: "tier1", order: 1 }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    await admin.as.mutation(api.pickLists.moveEntry, { listId: primaryId, teamNumber: 1, column: "tier1", order: 1 })
    const res = await s1.as.query(api.pickLists.get, { listId: primaryId })
    expect(res?.entries[0]).toMatchObject({ teamNumber: 1, column: "tier1", order: 1 })
  })

  test("personal lists are editable only by their owner (not even admins)", async () => {
    const { admin, s1, s2, s1ListId } = await setup()
    await expect(
      s2.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 1, column: "tier1", order: 1 }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    await expect(
      admin.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 1, column: "tier1", order: 1 }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    await expect(admin.as.mutation(api.pickLists.rename, { listId: s1ListId, name: "x" })).rejects.toMatchObject(
      code("FORBIDDEN"),
    )
    await expect(s2.as.mutation(api.pickLists.remove, { listId: s1ListId })).rejects.toMatchObject(code("FORBIDDEN"))
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 1, column: "tier1", order: 1 })
  })

  test("rename / remove: owner can; primary can't be removed", async () => {
    const { t, admin, s1, primaryId, s1ListId } = await setup()
    await s1.as.mutation(api.pickLists.rename, { listId: s1ListId, name: "  Mine  " })
    expect((await s1.as.query(api.pickLists.overview, {}))?.mine[0].name).toBe("Mine")
    await expect(admin.as.mutation(api.pickLists.remove, { listId: primaryId })).rejects.toMatchObject(
      code("FORBIDDEN"),
    )
    await s1.as.mutation(api.pickLists.remove, { listId: s1ListId })
    expect((await s1.as.query(api.pickLists.overview, {}))?.mine).toEqual([])
    const leftovers = await t.run((ctx) =>
      ctx.db.query("pickListEntries").withIndex("by_list_team", (q) => q.eq("listId", s1ListId)).collect(),
    )
    expect(leftovers).toEqual([])
  })
})

describe("pickLists.moveEntry", () => {
  test("moves a team to column/order; get sorts by column then order", async () => {
    const { s1, s1ListId } = await setup()
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 5, column: "tier2", order: 2 })
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 9, column: "tier2", order: 1.5 })
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 3, column: "dnp", order: 1 })
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 4, column: "tier1", order: 10 })
    const entries = (await s1.as.query(api.pickLists.get, { listId: s1ListId }))!.entries
    expect(entries.slice(0, 4).map((e) => [e.teamNumber, e.column])).toEqual([
      [4, "tier1"],
      [9, "tier2"],
      [5, "tier2"],
      [3, "dnp"],
    ])
    expect(entries).toHaveLength(12)
  })

  test("unknown team is NOT_FOUND", async () => {
    const { s1, s1ListId } = await setup()
    await expect(
      s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 999, column: "tier1", order: 1 }),
    ).rejects.toMatchObject(code("NOT_FOUND"))
  })
})

describe("pickLists.create", () => {
  test("blank seed: personal list with every team uncategorized", async () => {
    const ctx = await setup()
    await seedRankings(ctx)
    const listId = await ctx.s1.as.mutation(api.pickLists.create, { name: "Blank", seed: "blank" })
    const res = await ctx.s1.as.query(api.pickLists.get, { listId })
    expect(res?.list).toMatchObject({ kind: "personal", ownerName: "s1", canEdit: true, name: "Blank" })
    expect(res?.entries).toHaveLength(12)
    expect(res?.entries.every((e) => e.column === "uncategorized")).toBe(true)
  })

  test("rankings seed places teams by the creator's OWN averages, ascending within tier", async () => {
    const ctx = await setup()
    await seedRankings(ctx)
    const listId = await ctx.s1.as.mutation(api.pickLists.create, { name: "Seeded", seed: "rankings" })
    const entries = (await ctx.s1.as.query(api.pickLists.get, { listId }))!.entries
    expect(entries).toHaveLength(12)
    expect(column(entries, "tier1").sort((a, b) => a - b)).toEqual([1, 2, 7])
    expect(column(entries, "tier2").sort((a, b) => a - b)).toEqual([3, 4, 8, 9])
    // Team 6 is 6 for s1 (s2 ranked it 1 -> global 3.5, which would be tier2).
    expect(column(entries, "tier3").sort((a, b) => a - b)).toEqual([5, 6, 10, 11])
    expect(column(entries, "uncategorized")).toEqual([12])
    for (const tier of ["tier1", "tier2", "tier3"]) {
      const avgs = column(entries, tier).map((t) => S1_AVG[t])
      expect(avgs).toEqual([...avgs].sort((a, b) => a - b))
    }
    expect(column(entries, "tier1")).toEqual([7, 1, 2])
  })

  test("requires an active event", async () => {
    const t = convexTest(schema, modules)
    const a = await newUser(t, "a@example.com")
    await expect(a.as.mutation(api.pickLists.create, { name: "x", seed: "blank" })).rejects.toMatchObject(
      code("NO_ACTIVE_EVENT"),
    )
  })
})

describe("pickLists.refreshFromRankings", () => {
  test("moves teams with a personal average to their tier; others stay put", async () => {
    const ctx = await setup()
    await seedRankings(ctx)
    const { s1, s1ListId } = ctx
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 12, column: "dnp", order: 1 })
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 7, column: "dnp", order: 2 })
    await s1.as.mutation(api.pickLists.moveEntry, { listId: s1ListId, teamNumber: 3, column: "tier2", order: 1 })
    const res = await s1.as.mutation(api.pickLists.refreshFromRankings, { listId: s1ListId })
    // 11 ranked teams; team 3 was already in tier2.
    expect(res).toEqual({ moved: 10 })
    const entries = (await s1.as.query(api.pickLists.get, { listId: s1ListId }))!.entries
    expect(column(entries, "dnp")).toEqual([12])
    expect(column(entries, "tier1").sort((a, b) => a - b)).toEqual([1, 2, 7])
    expect(column(entries, "tier2").sort((a, b) => a - b)).toEqual([3, 4, 8, 9])
    expect(column(entries, "tier3").sort((a, b) => a - b)).toEqual([5, 6, 10, 11])
    expect(await s1.as.mutation(api.pickLists.refreshFromRankings, { listId: s1ListId })).toEqual({ moved: 0 })
  })

  test("owner + personal only", async () => {
    const { admin, s2, primaryId, s1ListId } = await setup()
    await expect(admin.as.mutation(api.pickLists.refreshFromRankings, { listId: primaryId })).rejects.toMatchObject(
      code("FORBIDDEN"),
    )
    await expect(s2.as.mutation(api.pickLists.refreshFromRankings, { listId: s1ListId })).rejects.toMatchObject(
      code("FORBIDDEN"),
    )
  })
})

describe("pickLists merge", () => {
  async function arrange(ctx: Awaited<ReturnType<typeof setup>>) {
    const { s1, s2, s1ListId, s2ListId } = ctx
    const mv = (as: typeof s1.as, listId: Id<"pickLists">, teamNumber: number, col: "tier1" | "tier2" | "tier3" | "dnp", order: number) =>
      as.mutation(api.pickLists.moveEntry, { listId, teamNumber, column: col, order })
    // A (s1): tier1 [1, 2], dnp [3]
    await mv(s1.as, s1ListId, 1, "tier1", 1)
    await mv(s1.as, s1ListId, 2, "tier1", 2)
    await mv(s1.as, s1ListId, 3, "dnp", 1)
    // B (s2): tier1 [2], tier2 [1], tier3 [3], dnp [4]
    await mv(s2.as, s2ListId, 2, "tier1", 1)
    await mv(s2.as, s2ListId, 1, "tier2", 1)
    await mv(s2.as, s2ListId, 3, "tier3", 1)
    await mv(s2.as, s2ListId, 4, "dnp", 1)
  }

  test("previewMerge returns consensus rows with nickname", async () => {
    const ctx = await setup()
    await arrange(ctx)
    const rows = await ctx.s1.as.query(api.pickLists.previewMerge, { sourceListIds: [ctx.s1ListId, ctx.s2ListId] })
    expect(rows).toHaveLength(12)
    expect(rows.slice(0, 4)).toEqual([
      { teamNumber: 2, nickname: "Team 2", column: "tier1", score: 1.25, votes: 2 },
      { teamNumber: 1, nickname: "Team 1", column: "tier1", score: 1.5, votes: 2 },
      { teamNumber: 3, nickname: "Team 3", column: "dnp", score: null, votes: 2 },
      { teamNumber: 4, nickname: "Team 4", column: "dnp", score: null, votes: 1 },
    ])
  })

  test("applyMerge writes the consensus into the target (admin into primary)", async () => {
    const ctx = await setup()
    await arrange(ctx)
    await ctx.admin.as.mutation(api.pickLists.applyMerge, {
      targetListId: ctx.primaryId,
      sourceListIds: [ctx.s1ListId, ctx.s2ListId],
    })
    const entries = (await ctx.s1.as.query(api.pickLists.get, { listId: ctx.primaryId }))!.entries
    expect(column(entries, "tier1")).toEqual([2, 1])
    expect(column(entries, "dnp")).toEqual([3, 4])
    expect(column(entries, "uncategorized")).toEqual([5, 6, 7, 8, 9, 10, 11, 12])
    expect(entries).toHaveLength(12)
  })

  test("applyMerge recomputes server-side from the current source state", async () => {
    const ctx = await setup()
    await arrange(ctx)
    await ctx.s1.as.query(api.pickLists.previewMerge, { sourceListIds: [ctx.s1ListId, ctx.s2ListId] })
    // Source changes after the preview: s2 now puts team 1 into dnp -> team 1 has 1 dnp of 2 votes -> dnp.
    await ctx.s2.as.mutation(api.pickLists.moveEntry, { listId: ctx.s2ListId, teamNumber: 1, column: "dnp", order: 2 })
    await ctx.admin.as.mutation(api.pickLists.applyMerge, {
      targetListId: ctx.primaryId,
      sourceListIds: [ctx.s1ListId, ctx.s2ListId],
    })
    const entries = (await ctx.s1.as.query(api.pickLists.get, { listId: ctx.primaryId }))!.entries
    expect(column(entries, "tier1")).toEqual([2])
    expect(column(entries, "dnp").sort((a, b) => a - b)).toEqual([1, 3, 4])
  })

  test("applyMerge requires edit rights on the target", async () => {
    const ctx = await setup()
    await expect(
      ctx.s1.as.mutation(api.pickLists.applyMerge, { targetListId: ctx.primaryId, sourceListIds: [ctx.s1ListId] }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    await expect(
      ctx.s1.as.mutation(api.pickLists.applyMerge, { targetListId: ctx.s2ListId, sourceListIds: [ctx.s1ListId] }),
    ).rejects.toMatchObject(code("FORBIDDEN"))
    // Merging someone else's list into your own is fine.
    await ctx.s1.as.mutation(api.pickLists.applyMerge, { targetListId: ctx.s1ListId, sourceListIds: [ctx.s2ListId] })
  })
})

describe("pickLists.setSelected", () => {
  test("event-wide selection is reflected in get().entries[].selected on every list", async () => {
    const { t, s1, s2, primaryId, s1ListId, s2ListId } = await setup()
    await s1.as.mutation(api.pickLists.setSelected, { teamNumber: 5, selected: true })
    await s2.as.mutation(api.pickLists.setSelected, { teamNumber: 5, selected: true })
    expect(await t.run((ctx) => ctx.db.query("selectedTeams").collect())).toHaveLength(1)
    for (const listId of [primaryId, s1ListId, s2ListId]) {
      const entries = (await s2.as.query(api.pickLists.get, { listId }))!.entries
      expect(entries.filter((e) => e.selected).map((e) => e.teamNumber)).toEqual([5])
    }
    await s2.as.mutation(api.pickLists.setSelected, { teamNumber: 5, selected: false })
    const entries = (await s1.as.query(api.pickLists.get, { listId: s1ListId }))!.entries
    expect(entries.some((e) => e.selected)).toBe(false)
  })
})
