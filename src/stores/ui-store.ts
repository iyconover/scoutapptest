import { create } from "zustand"

/**
 * Ephemeral client-only UI state (panels, selection, dialogs, drag state, etc.).
 * Never store Convex query results or other persisted domain data here —
 * read those with `useQuery` so they stay live.
 */
interface UIState {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}))
