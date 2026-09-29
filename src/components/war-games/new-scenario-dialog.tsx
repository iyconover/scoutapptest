import { useMutation } from "convex/react"
import { PlusIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { errorMessage } from "@/lib/errors"
import { api } from "../../../convex/_generated/api"

/** "New scenario" button + dialog: creates a scenario and opens it. */
export function NewScenarioDialog({ label = "New scenario" }: { label?: string }) {
  const create = useMutation(api.warGames.create)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const trimmed = name.trim()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!trimmed || pending) return
    setPending(true)
    try {
      const id = await create({ name: trimmed })
      toast.success("Scenario created.")
      setOpen(false)
      setName("")
      void navigate(`/war-games/${id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-11 md:h-9" />}>
        <PlusIcon data-icon="inline-start" />
        {label}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New scenario</DialogTitle>
            <DialogDescription>
              Starts with suggested RP for every unplayed match and an empty alliance board.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="war-game-name">Name</Label>
            <Input
              id="war-game-name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. We win out"
              maxLength={60}
              autoComplete="off"
              autoFocus
              className="h-11"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!trimmed || pending} className="h-11 md:h-9">
              {pending && <Spinner data-icon="inline-start" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
