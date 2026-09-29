import { ChevronRightIcon, EyeIcon, LockIcon, PencilIcon } from "lucide-react"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { listOwnerLabel, type ListSummary } from "./board-utils"

/** A tappable summary card linking to /pick-lists/:listId. */
export function ListCard({ list, note, className }: { list: ListSummary; note?: string; className?: string }) {
  return (
    <Link
      to={`/pick-lists/${list._id}`}
      className={cn(
        "group/list block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <Card className="h-full transition-colors group-hover/list:bg-muted/50">
        <CardHeader>
          <CardTitle className="truncate">{list.name}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{listOwnerLabel(list)}</span>
            {note && <span>· {note}</span>}
          </CardDescription>
          <CardAction className="flex items-center gap-1">
            {list.canEdit ? (
              <Badge variant="secondary">
                <PencilIcon />
                Editable
              </Badge>
            ) : (
              <Badge variant="outline">
                {list.kind === "primary" ? <LockIcon /> : <EyeIcon />}
                View only
              </Badge>
            )}
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
          </CardAction>
        </CardHeader>
      </Card>
    </Link>
  )
}
