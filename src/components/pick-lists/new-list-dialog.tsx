import { useMutation } from "convex/react"
import { PlusIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { errorMessage } from "@/lib/errors"
import { api } from "../../../convex/_generated/api"
import { LIST_NAME_MAX } from "./board-utils"

type Seed = "rankings" | "blank"

const SEEDS: { value: Seed; label: string; description: string }[] = [
  {
    value: "rankings",
    label: "Start from my rankings",
    description: "Places teams by your own average rank: ≤ 2 Tier 1, ≤ 4 Tier 2, otherwise Tier 3. Unranked teams stay Uncategorized.",
  },
  { value: "blank", label: "Blank", description: "Every team starts in Uncategorized." },
]

/** Creates a personal list and opens it. */
export function NewListDialog({ triggerLabel = "New list" }: { triggerLabel?: string }) {
  const create = useMutation(api.pickLists.create)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [seed, setSeed] = useState<Seed>("rankings")
  const [pending, setPending] = useState(false)
  const trimmed = name.trim()

  function onOpenChange(next: boolean) {
    if (next) {
      setName("")
      setSeed("rankings")
    }
    setOpen(next)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!trimmed || pending) return
    setPending(true)
    try {
      const listId = await create({ name: trimmed, seed })
      toast.success(`Created ${trimmed}`)
      setOpen(false)
      void navigate(`/pick-lists/${listId}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button className="h-11 md:h-9" />}>
        <PlusIcon />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New pick list</DialogTitle>
            <DialogDescription>A personal list only you can edit. Everyone else can view it.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-list-name">Name</Label>
            <Input
              id="new-list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIST_NAME_MAX}
              placeholder="e.g. Defense picks"
              autoComplete="off"
              className="h-11 md:h-9"
              required
            />
          </div>
          <RadioGroup value={seed} onValueChange={(v) => setSeed(v as Seed)} aria-label="Starting layout">
            {SEEDS.map((s) => (
              <Label
                key={s.value}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-checked:border-primary has-data-checked:bg-primary/5"
              >
                <RadioGroupItem value={s.value} className="mt-0.5" />
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-xs leading-snug text-muted-foreground">{s.description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-11 md:h-8" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!trimmed || pending} className="h-11 md:h-8">
              {pending ? "Creating…" : "Create list"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
