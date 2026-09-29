import { CalendarXIcon } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useIsAdmin } from "@/hooks/use-viewer"

/** Shown by any page when there is no active event yet. */
export function NoEvent() {
  const isAdmin = useIsAdmin()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarXIcon />
        </EmptyMedia>
        <EmptyTitle>No event yet</EmptyTitle>
        <EmptyDescription>
          {isAdmin ? "Import an event from The Blue Alliance to get started." : "Ask an admin to set up the event."}
        </EmptyDescription>
      </EmptyHeader>
      {isAdmin && (
        <EmptyContent>
          <Button render={<Link to="/admin/event-setup" />} nativeButton={false}>
            Set up event
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}
