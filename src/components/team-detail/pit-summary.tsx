import { CheckIcon, ClipboardListIcon, PencilIcon, XIcon } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { Drivetrain, PitFields } from "../../../convex/lib/validators"

type Capability = Exclude<keyof PitFields, "drivetrain" | "notes" | "photoIds">

const GROUPS: { title: string; items: { key: Capability; label: string }[] }[] = [
  {
    title: "Field",
    items: [
      { key: "trench", label: "Trench" },
      { key: "bump", label: "Bump" },
    ],
  },
  {
    title: "Fuel",
    items: [
      { key: "turret", label: "Turret" },
      { key: "dumper", label: "Dumper" },
      { key: "singleStream", label: "Single stream" },
      { key: "humanPlayerOnly", label: "Human player only" },
    ],
  },
  {
    title: "Climb",
    items: [
      { key: "climbL1", label: "L1" },
      { key: "climbL2", label: "L2" },
      { key: "climbL3", label: "L3" },
    ],
  },
]

const DRIVETRAIN_LABELS: Record<Drivetrain, string> = {
  swerve: "Swerve",
  tank: "Tank",
  mecanum: "Mecanum",
  other: "Other",
}

/** Pit scouting answers as yes/no capability chips, or a prompt to pit scout. */
export function PitSummary({ teamNumber, pit }: { teamNumber: number; pit: PitFields | null }) {
  if (pit === null) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardListIcon className="size-4" />
          Not pit scouted yet
        </p>
        <Button render={<Link to={`/pit/${teamNumber}`} />} nativeButton={false} className="h-11 md:h-8">
          Pit scout {teamNumber}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{group.title}</span>
          <ul className="flex flex-wrap gap-1.5">
            {group.items.map((item) => (
              <CapabilityChip key={item.key} label={item.label} yes={pit[item.key]} />
            ))}
          </ul>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">Drivetrain: </span>
          <span className="font-medium">{DRIVETRAIN_LABELS[pit.drivetrain]}</span>
        </span>
      </div>
      {pit.notes.trim() !== "" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Robot notes</span>
          <p className="text-sm break-words whitespace-pre-wrap">{pit.notes}</p>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        render={<Link to={`/pit/${teamNumber}`} />}
        nativeButton={false}
        className="h-10 self-start md:h-7"
      >
        <PencilIcon data-icon="inline-start" />
        Edit pit report
      </Button>
    </div>
  )
}

function CapabilityChip({ label, yes }: { label: string; yes: boolean }) {
  return (
    <li
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm",
        yes
          ? "border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
          : "border-border text-muted-foreground",
      )}
    >
      {yes ? <CheckIcon className="size-3.5" aria-hidden /> : <XIcon className="size-3.5" aria-hidden />}
      {label}
      <span className="sr-only">{yes ? ": yes" : ": no"}</span>
    </li>
  )
}
