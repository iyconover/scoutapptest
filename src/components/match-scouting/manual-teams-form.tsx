import { useMutation } from "convex/react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { allianceClasses } from "@/lib/alliance"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { api } from "../../../convex/_generated/api"
import type { CurrentMatch } from "./match-utils"

/**
 * Lead scout enters the six teams for a match without a TBA schedule.
 * Re-editable until rankings exist (the server enforces that).
 * Remount (via `key`) when the match or its teams change to reset the inputs.
 */
export function ManualTeamsForm({
  matchNumber,
  match,
}: {
  matchNumber: number
  match: Pick<CurrentMatch, "red" | "blue"> | null
}) {
  const setManualTeams = useMutation(api.matchScouting.setManualTeams)
  const [red, setRed] = useState<string[]>(() => (match?.red ?? ["", "", ""]).map(String))
  const [blue, setBlue] = useState<string[]>(() => (match?.blue ?? ["", "", ""]).map(String))
  const [pending, setPending] = useState(false)

  const parsed = [...red, ...blue].map((v) => (/^\d{1,5}$/.test(v.trim()) ? Number(v.trim()) : null))
  const complete = parsed.every((n): n is number => n !== null && n > 0)
  const distinct = complete && new Set(parsed).size === 6
  const unchanged =
    match !== null && [...match.red, ...match.blue].every((t, i) => parsed[i] === t)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!complete || !distinct) return
    const nums = parsed as number[]
    setPending(true)
    try {
      await setManualTeams({ number: matchNumber, red: nums.slice(0, 3), blue: nums.slice(3) })
      toast.success(`Teams saved for match ${matchNumber}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  const groups = [
    { color: "red" as const, label: "Red alliance", values: red, set: setRed },
    { color: "blue" as const, label: "Blue alliance", values: blue, set: setBlue },
  ]

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-3">
      {groups.map((g) => (
        <fieldset key={g.color} className={cn("rounded-lg border p-3", allianceClasses[g.color])}>
          <legend className="px-1 text-sm font-semibold">{g.label}</legend>
          <div className="grid grid-cols-3 gap-2">
            {g.values.map((value, i) => (
              <Input
                key={i}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="next"
                aria-label={`${g.label} team ${i + 1}`}
                placeholder={`${g.color === "red" ? "Red" : "Blue"} ${i + 1}`}
                className="h-11 bg-background text-center text-lg font-semibold text-foreground tabular-nums"
                value={value}
                maxLength={5}
                onChange={(e) => {
                  const next = [...g.values]
                  next[i] = e.target.value.replace(/\D/g, "")
                  g.set(next)
                }}
                disabled={pending}
              />
            ))}
          </div>
        </fieldset>
      ))}
      {complete && !distinct && <p className="text-sm text-destructive">Each team can only appear once.</p>}
      <Button type="submit" className="h-11" disabled={!complete || !distinct || unchanged || pending}>
        {pending && <Spinner />}
        {match ? `Update teams for match ${matchNumber}` : `Save teams for match ${matchNumber}`}
      </Button>
    </form>
  )
}
