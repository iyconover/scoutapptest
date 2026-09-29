import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { toast } from "sonner"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

const NONE = "none"

/** Admin control for choosing the active event's lead scout. */
export function LeadScoutSelect({
  value,
  className,
}: {
  /** Current lead scout (events.active.leadScout?.userId). */
  value: Id<"users"> | null | undefined
  className?: string
}) {
  const profiles = useQuery(api.users.listProfiles)
  const setLeadScout = useMutation(api.events.setLeadScout)
  const [pending, setPending] = useState(false)

  if (profiles === undefined) return <Skeleton className={cn("h-11 w-full", className)} />

  const items = [
    { value: NONE, label: "No lead scout" },
    ...profiles.map((p) => ({ value: p.userId as string, label: p.displayName })),
  ]

  const onChange = async (next: string | null) => {
    const userId = next === null || next === NONE ? null : (next as Id<"users">)
    if (userId === (value ?? null)) return
    setPending(true)
    try {
      await setLeadScout({ userId })
      const name = profiles.find((p) => p.userId === userId)?.displayName
      toast.success(name ? `${name} is now lead scout` : "Lead scout cleared")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Select items={items} value={value ?? NONE} onValueChange={(v) => void onChange(v)} disabled={pending}>
      <SelectTrigger aria-label="Lead scout" className={cn("w-full data-[size=default]:h-11", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} className="py-2">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
