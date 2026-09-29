import { useQuery } from "convex/react"

import { api } from "../../convex/_generated/api"

/** The signed-in profile (undefined while loading). Guaranteed non-null inside ProtectedLayout. */
export function useViewer() {
  return useQuery(api.users.viewerProfile)
}

export function useIsAdmin(): boolean {
  return useViewer()?.role === "admin"
}
