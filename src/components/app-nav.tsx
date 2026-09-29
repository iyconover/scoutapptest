import { MenuIcon } from "lucide-react"
import { NavLink } from "react-router"

import { NAV_ITEMS } from "@/app/nav"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useIsAdmin } from "@/hooks/use-viewer"
import { useUIStore } from "@/stores/ui-store"
import { cn } from "@/lib/utils"

function useVisibleItems() {
  const isAdmin = useIsAdmin()
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)
}

/** Inline links, shown from the `lg` breakpoint up. */
export function DesktopNav() {
  const items = useVisibleItems()
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            cn(
              "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Hamburger menu below `lg`. */
export function MobileNav() {
  const items = useVisibleItems()
  const open = useUIStore((s) => s.mobileNavOpen)
  const setOpen = useUIStore((s) => s.setMobileNavOpen)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex h-12 items-center gap-3 rounded-md px-3 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted text-foreground",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
