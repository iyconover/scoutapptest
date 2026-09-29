import type { ReactNode } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import type { Drivetrain } from "../../../convex/lib/validators"

/** A titled block of the pit form. */
export function PitSection({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/** Large tappable card wrapping a checkbox. */
export function CheckCard({
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <Label
      className={cn(
        "min-h-14 cursor-pointer rounded-xl border px-4 py-3 text-base leading-tight transition-colors",
        checked
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-card-foreground hover:bg-muted",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value)}
        className="size-5"
      />
      <span>{label}</span>
    </Label>
  )
}

const DRIVETRAIN_OPTIONS: { value: Drivetrain; label: string }[] = [
  { value: "swerve", label: "Swerve" },
  { value: "tank", label: "Tank" },
  { value: "mecanum", label: "Mecanum" },
  { value: "other", label: "Other" },
]

/** Single-choice drivetrain picker; a selection can be changed but not cleared. */
export function DrivetrainPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Drivetrain | null
  onChange: (value: Drivetrain) => void
  disabled?: boolean
}) {
  return (
    <ToggleGroup
      aria-label="Drivetrain"
      variant="outline"
      spacing={2}
      disabled={disabled}
      value={value ? [value] : []}
      onValueChange={(next: string[]) => {
        const picked = DRIVETRAIN_OPTIONS.find((o) => o.value === next[0])
        if (picked) onChange(picked.value)
      }}
      className="grid w-full grid-cols-2 sm:grid-cols-4"
    >
      {DRIVETRAIN_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="h-14 rounded-xl text-base aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
