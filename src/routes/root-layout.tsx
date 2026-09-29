import { Outlet } from "react-router"

import { AppHeader } from "@/components/app-header"
import { Toaster } from "@/components/ui/sonner"

export function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <Toaster />
    </div>
  )
}
