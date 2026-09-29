import { create } from "zustand"

/**
 * Ephemeral client-only UI state (panels, selection, dialogs, drag state, etc.).
 * Never store Convex query results or other persisted domain data here —
 * read those with `useQuery` so they stay live.
 */
interface UIState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))
