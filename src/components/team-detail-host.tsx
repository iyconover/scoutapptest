import { useSearchParams } from "react-router"

import { TeamDetail } from "@/components/team-detail/team-detail"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useIsDesktop } from "@/hooks/use-media-query"
import { TEAM_PARAM } from "@/hooks/use-open-team"

/**
 * Global team detail modal driven by `?team=<number>`, mounted once in RootLayout.
 * Dialog on desktop, bottom sheet on phones.
 */
export function TeamDetailHost() {
  const [params, setParams] = useSearchParams()
  const isDesktop = useIsDesktop()
  const raw = params.get(TEAM_PARAM)
  const teamNumber = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null

  const close = (open: boolean) => {
    if (open) return
    const next = new URLSearchParams(params)
    next.delete(TEAM_PARAM)
    setParams(next)
  }

  if (teamNumber === null) return null

  if (isDesktop) {
    return (
      <Dialog open onOpenChange={close}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
          <DialogTitle className="sr-only">Team {teamNumber}</DialogTitle>
          <TeamDetail teamNumber={teamNumber} />
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Sheet open onOpenChange={close}>
      <SheetContent side="bottom" className="max-h-[92svh] overflow-y-auto rounded-t-xl p-4">
        <SheetTitle className="sr-only">Team {teamNumber}</SheetTitle>
        <TeamDetail teamNumber={teamNumber} />
      </SheetContent>
    </Sheet>
  )
}
