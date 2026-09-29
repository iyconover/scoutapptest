import { useConvexAuth } from "convex/react"
import { Navigate, Outlet, useLocation } from "react-router"

import { FullPageSpinner } from "@/components/full-page-spinner"

/** Renders child routes only for signed-in users. */
export function ProtectedLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
