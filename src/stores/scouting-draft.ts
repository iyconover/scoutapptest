import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

/**
 * Unsent match scouting work, persisted to localStorage so closing the tab
 * doesn't lose it. Only the scouter's own edits live here — never query results.
 * Keyed by match id.
 */
export interface MatchDraft {
  /** Team numbers, best (rank 1) first. Empty = the scouter hasn't touched the order. */
  order: number[]
  /** The scouter moved a team or tapped "This order is correct". */
  confirmed: boolean
  /** Edited note text per team (only teams the scouter typed in). */
  notes: Record<number, string>
  updatedAt: number
}

interface ScoutingDraftState {
  drafts: Record<string, MatchDraft>
  /** Set the order; moving a team counts as confirming it. */
  setOrder: (matchId: string, order: number[]) => void
  setConfirmed: (matchId: string, confirmed: boolean) => void
  setNote: (matchId: string, teamNumber: number, text: string) => void
  clearDraft: (matchId: string) => void
}

/** Drafts older than this are dropped the next time anything is written. */
const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000

const emptyDraft = (): MatchDraft => ({ order: [], confirmed: false, notes: {}, updatedAt: Date.now() })

/** localStorage that never throws (private mode, blocked storage, quota). */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      // Ignore: the draft just won't survive a reload.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      // Ignore.
    }
  },
}

function withDraft(
  drafts: Record<string, MatchDraft>,
  matchId: string,
  update: (draft: MatchDraft) => Partial<MatchDraft>,
): Record<string, MatchDraft> {
  const now = Date.now()
  const next: Record<string, MatchDraft> = {}
  for (const [id, draft] of Object.entries(drafts)) {
    if (now - draft.updatedAt < DRAFT_TTL_MS) next[id] = draft
  }
  const current = next[matchId] ?? emptyDraft()
  next[matchId] = { ...current, ...update(current), updatedAt: now }
  return next
}

export const useScoutingDraft = create<ScoutingDraftState>()(
  persist(
    (set) => ({
      drafts: {},
      setOrder: (matchId, order) =>
        set((s) => ({ drafts: withDraft(s.drafts, matchId, () => ({ order, confirmed: true })) })),
      setConfirmed: (matchId, confirmed) =>
        set((s) => ({ drafts: withDraft(s.drafts, matchId, () => ({ confirmed })) })),
      setNote: (matchId, teamNumber, text) =>
        set((s) => ({
          drafts: withDraft(s.drafts, matchId, (d) => ({ notes: { ...d.notes, [teamNumber]: text } })),
        })),
      clearDraft: (matchId) =>
        set((s) => {
          if (!(matchId in s.drafts)) return s
          const next = { ...s.drafts }
          delete next[matchId]
          return { drafts: next }
        }),
    }),
    {
      name: "scouting-drafts",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ drafts: s.drafts }),
    },
  ),
)
