/**
 * Shared validators + types. Single source of truth for enums and embedded
 * object shapes used by the schema, function args/returns, and the UI.
 */
import { v, type Infer } from "convex/values"

export const roleV = v.union(v.literal("admin"), v.literal("scouter"))
export type Role = Infer<typeof roleV>

export const columnV = v.union(
  v.literal("tier1"),
  v.literal("tier2"),
  v.literal("tier3"),
  v.literal("dnp"),
  v.literal("uncategorized"),
)
export type Column = Infer<typeof columnV>
/** Display order of pick list columns. */
export const COLUMNS: readonly Column[] = ["tier1", "tier2", "tier3", "dnp", "uncategorized"]
export const COLUMN_LABELS: Record<Column, string> = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
  dnp: "Do Not Pick",
  uncategorized: "Uncategorized",
}

export const drivetrainV = v.union(
  v.literal("swerve"),
  v.literal("tank"),
  v.literal("mecanum"),
  v.literal("other"),
)
export type Drivetrain = Infer<typeof drivetrainV>

export const pageV = v.union(
  v.literal("home"),
  v.literal("teams"),
  v.literal("pit"),
  v.literal("match-scouting"),
  v.literal("matches"),
  v.literal("pick-lists"),
  v.literal("war-games"),
  v.literal("admin"),
)
export type Page = Infer<typeof pageV>

export const rankEntryV = v.object({ teamNumber: v.number(), rank: v.number() })
export type RankEntry = Infer<typeof rankEntryV>

/** One playoff alliance: 3 slots (captain, pick 1, pick 2), each lockable. */
export const allianceV = v.object({
  slots: v.array(v.union(v.number(), v.null())),
  locked: v.array(v.boolean()),
})
export type Alliance = Infer<typeof allianceV>

export const draftMethodV = v.union(v.literal("ourRank"), v.literal("opr"), v.literal("manual"))
export type DraftMethod = Infer<typeof draftMethodV>

export const matchSourceV = v.union(v.literal("tba"), v.literal("manual"))
export const listKindV = v.union(v.literal("primary"), v.literal("personal"))
export type ListKind = Infer<typeof listKindV>

export const scoutingRoleV = v.union(v.literal("lead"), v.literal("assigned"), v.literal("ranker"))
export type ScoutingRole = Infer<typeof scoutingRoleV>

/** Pit scouting form fields (everything except team/event/author). */
export const pitFields = {
  trench: v.boolean(),
  bump: v.boolean(),
  turret: v.boolean(),
  dumper: v.boolean(),
  singleStream: v.boolean(),
  humanPlayerOnly: v.boolean(),
  climbL1: v.boolean(),
  climbL2: v.boolean(),
  climbL3: v.boolean(),
  drivetrain: drivetrainV,
  notes: v.string(),
  photoIds: v.array(v.id("_storage")),
}
export const pitFieldsV = v.object(pitFields)
export type PitFields = Infer<typeof pitFieldsV>
