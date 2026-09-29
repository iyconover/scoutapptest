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
  const eventId = await t.mutation(internal.events.upsertImport, {
    tbaKey: "2026test",
    name: "Test Event",
    startDate: "2026-03-01",
    endDate: "2026-03-03",
    teams: [1, 2, 3].map((n) => ({ tbaKey: `frc${n}`, number: n, nickname: `Team ${n}` })),
    matches: [],
  })
  return { t, admin, s1, eventId }
}

const fields = (photoIds: Id<"_storage">[] = []) => ({
  trench: true,
  bump: false,
  turret: true,
  dumper: false,
  singleStream: true,
  humanPlayerOnly: false,
  climbL1: true,
  climbL2: true,
  climbL3: false,
  drivetrain: "swerve" as const,
  notes: "solid robot",
  photoIds,
})

async function storePhoto(t: T) {
  return await t.run((ctx) => ctx.storage.store(new Blob(["img"], { type: "image/jpeg" })))
}

describe("pit", () => {
  test("statusGrid requires auth and lists every team with scouted/photoCount", async () => {
    const { t, s1 } = await setup()
    await expect(t.query(api.pit.statusGrid, {})).rejects.toMatchObject(code("UNAUTHENTICATED"))
    expect(await s1.as.query(api.pit.statusGrid, {})).toEqual([
      { teamNumber: 1, nickname: "Team 1", scouted: false, photoCount: 0 },
      { teamNumber: 2, nickname: "Team 2", scouted: false, photoCount: 0 },
      { teamNumber: 3, nickname: "Team 3", scouted: false, photoCount: 0 },
    ])
    const p = await storePhoto(t)
    await s1.as.mutation(api.pit.save, { teamNumber: 2, ...fields([p]) })
    expect((await s1.as.query(api.pit.statusGrid, {}))[1]).toEqual({
      teamNumber: 2,
      nickname: "Team 2",
      scouted: true,
      photoCount: 1,
    })
  })

  test("get returns null before save, then fields + photos + updatedByName", async () => {
    const { t, admin, s1 } = await setup()
    expect(await s1.as.query(api.pit.get, { teamNumber: 1 })).toBeNull()
    const p = await storePhoto(t)
    await s1.as.mutation(api.pit.save, { teamNumber: 1, ...fields([p]) })
    const res = await admin.as.query(api.pit.get, { teamNumber: 1 })
    expect(res).toEqual({
      ...fields([p]),
      photos: [{ storageId: p, url: expect.any(String) }],
      updatedByName: "s1",
    })
  })

  test("save upserts one report per team and deletes removed photos from storage", async () => {
    const { t, admin, s1, eventId } = await setup()
    const p1 = await storePhoto(t)
    const p2 = await storePhoto(t)
    await s1.as.mutation(api.pit.save, { teamNumber: 3, ...fields([p1, p2]) })
    await admin.as.mutation(api.pit.save, { teamNumber: 3, ...fields([p2]), notes: "updated", drivetrain: "tank" })
    const rows = await t.run((ctx) =>
      ctx.db
        .query("pitReports")
        .withIndex("by_event_team", (q) => q.eq("eventId", eventId).eq("teamNumber", 3))
        .collect(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ notes: "updated", drivetrain: "tank", photoIds: [p2], updatedBy: admin.userId })
    expect(await t.run(async (ctx) => (await ctx.storage.get(p1)) !== null)).toBe(false)
    expect(await t.run(async (ctx) => (await ctx.storage.get(p2)) !== null)).toBe(true)
    expect(await s1.as.query(api.pit.get, { teamNumber: 3 })).toMatchObject({ updatedByName: "admin" })
  })

  test("save rejects unknown teams and requires an active event", async () => {
    const { s1 } = await setup()
    await expect(s1.as.mutation(api.pit.save, { teamNumber: 99, ...fields() })).rejects.toMatchObject(code("NOT_FOUND"))
    const t2 = convexTest(schema, modules)
    const lonely = await newUser(t2, "x@example.com")
    await expect(lonely.as.mutation(api.pit.save, { teamNumber: 1, ...fields() })).rejects.toMatchObject(
      code("NO_ACTIVE_EVENT"),
    )
    expect(await lonely.as.query(api.pit.statusGrid, {})).toEqual([])
    expect(await lonely.as.query(api.pit.get, { teamNumber: 1 })).toBeNull()
  })

  test("generateUploadUrl requires auth", async () => {
    const { t, s1 } = await setup()
    await expect(t.mutation(api.pit.generateUploadUrl, {})).rejects.toMatchObject(code("UNAUTHENTICATED"))
    expect(typeof (await s1.as.mutation(api.pit.generateUploadUrl, {}))).toBe("string")
  })
})
