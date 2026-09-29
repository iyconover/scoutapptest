import { useConvexAuth, useMutation } from "convex/react"
import { useEffect } from "react"
import { Navigate, Outlet, useLocation } from "react-router"

import { FullPageSpinner } from "@/components/full-page-spinner"
import { useHeartbeat } from "@/hooks/use-heartbeat"
import { useViewer } from "@/hooks/use-viewer"
import { pageForPath } from "@/lib/presence"
import { api } from "../../convex/_generated/api"

/** Renders child routes only for signed-in users with a profile. */
export function ProtectedLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }
  return <ProfileGate />
}

/** Creates the profile on first sign-in, then starts the presence heartbeat. */
function ProfileGate() {
  const viewer = useViewer()
  const ensureProfile = useMutation(api.users.ensureProfile)

  useEffect(() => {
    if (viewer === null) void ensureProfile({})
  }, [viewer, ensureProfile])

  if (!viewer) return <FullPageSpinner />
  return <SignedIn />
}

function SignedIn() {
  const location = useLocation()
  useHeartbeat(pageForPath(location.pathname))
  return <Outlet />
}
