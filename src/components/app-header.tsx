import { useAuthActions } from "@convex-dev/auth/react"
import { useConvexAuth } from "convex/react"
import { LogOutIcon } from "lucide-react"
import { Link } from "react-router"

import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function AppHeader() {
  const { isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <Link to="/" className="font-heading font-semibold">
        scoutapptest
      </Link>
      <div className="flex items-center gap-1">
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
