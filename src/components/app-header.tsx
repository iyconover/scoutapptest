import { useAuthActions } from "@convex-dev/auth/react"
import { useConvexAuth } from "convex/react"
import { LogOutIcon } from "lucide-react"
import { Link } from "react-router"

import { DesktopNav, MobileNav } from "@/components/app-nav"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function AppHeader() {
  const { isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
      {isAuthenticated && <MobileNav />}
      <Link to="/" className="mr-2 font-heading font-semibold">
        TimberScout
      </Link>
      {isAuthenticated && <DesktopNav />}
      <div className="ml-auto flex items-center gap-1">
        <ModeToggle />
        {isAuthenticated && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sign out"
                  onClick={() => void signOut()}
                />
              }
            >
              <LogOutIcon />
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  )
}
