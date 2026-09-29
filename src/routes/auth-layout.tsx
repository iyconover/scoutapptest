import { useConvexAuth } from "convex/react"
import { Navigate, Outlet, useLocation } from "react-router"

import { FullPageSpinner } from "@/components/full-page-spinner"

/** Renders child routes only for signed-out users. */
export function AuthLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/"

  if (isLoading) return <FullPageSpinner />
  if (isAuthenticated) return <Navigate to={from} replace />
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Outlet />
    </div>
  )
}
