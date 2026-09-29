import { CheckIcon, CircleDashedIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { COLUMN_LABELS, type Column } from "../../../convex/lib/validators"

export function PitBadge({ scouted }: { scouted: boolean }) {
  return scouted ? (
    <Badge className="gap-1 bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
      <CheckIcon />
      Pit scouted
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <CircleDashedIcon />
      Not pit scouted
    </Badge>
  )
}

const TIER_CLASSES: Record<Column, string> = {
  tier1: "bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  tier2: "bg-sky-600/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  tier3: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  dnp: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  uncategorized: "bg-muted text-muted-foreground",
}

/** Pick list column as a coloured badge; "—" when the team has no entry. */
export function TierBadge({ tier, className }: { tier: Column | null; className?: string }) {
  if (tier === null) return <span className={cn("text-muted-foreground", className)}>—</span>
  return <Badge className={cn(TIER_CLASSES[tier], className)}>{COLUMN_LABELS[tier]}</Badge>
}
