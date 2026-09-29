import { ChevronDownIcon } from "lucide-react"
import { useId } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { AssignmentRow } from "./assignment-row"
import type { Assignment } from "./types"

/** One scouter's assigned teams. Collapsible so a long list stays scannable on phones. */
export function ScouterAssignmentsCard({
  scouterName,
  assignments,
  open,
  onOpenChange,
}: {
  scouterName: string
  assignments: Assignment[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const contentId = useId()
  const count = assignments.length

  return (
    <Card size="sm">
      <CardHeader>
        <Button
          variant="ghost"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          onClick={() => onOpenChange(!open)}
          className="-mx-2 h-auto min-h-11 justify-start gap-3 px-2 py-2 text-left whitespace-normal"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2 font-heading text-base font-medium">
              <span className="truncate">{scouterName}</span>
              <Badge variant="secondary" className="tabular-nums">
                {count} team{count === 1 ? "" : "s"}
              </Badge>
            </span>
            {!open && (
              <span className="truncate text-xs font-normal text-muted-foreground tabular-nums">
                {assignments.map((a) => a.teamNumber).join(", ")}
              </span>
            )}
          </div>
          <ChevronDownIcon className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
        </Button>
      </CardHeader>
      {open && (
        <CardContent id={contentId}>
          <ul className="flex flex-col divide-y">
            {assignments.map((a) => (
              <AssignmentRow key={a._id} assignment={a} />
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}
