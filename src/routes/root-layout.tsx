import { useConvexAuth } from "convex/react"
import { Outlet } from "react-router"

import { AppHeader } from "@/components/app-header"
import { TeamDetailHost } from "@/components/team-detail-host"
import { Toaster } from "@/components/ui/sonner"

export function RootLayout() {
  const { isAuthenticated } = useConvexAuth()
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      {isAuthenticated && <TeamDetailHost />}
      <Toaster />
    </div>
  )
}
