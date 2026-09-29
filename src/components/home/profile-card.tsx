import { useMutation } from "convex/react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useViewer } from "@/hooks/use-viewer"
import { errorMessage } from "@/lib/errors"

import { api } from "../../../convex/_generated/api"

const MAX_NAME = 40

function NameForm({ initialName }: { initialName: string }) {
  const setDisplayName = useMutation(api.users.setDisplayName)
  const [name, setName] = useState(initialName)
  const [pending, setPending] = useState(false)

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && trimmed.length <= MAX_NAME && trimmed !== initialName && !pending

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setPending(true)
    try {
      await setDisplayName({ displayName: trimmed })
      toast.success("Name updated")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-2">
      <Label htmlFor="display-name">Display name</Label>
      <div className="flex gap-2">
        <Input
          id="display-name"
          value={name}
          maxLength={MAX_NAME}
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
          className="h-11"
        />
        <Button type="submit" className="h-11 px-4" disabled={!canSave}>
          {pending && <Spinner data-icon="inline-start" />}
          Save
        </Button>
      </div>
    </form>
  )
}

export function ProfileCard() {
  const viewer = useViewer()
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
        {viewer && (
          <CardAction>
            <Badge variant={viewer.role === "admin" ? "secondary" : "outline"}>
              {viewer.role === "admin" ? "Admin" : "Scouter"}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {viewer ? (
          // Re-mount when the saved name changes so the input reflects the server value.
          <NameForm key={viewer.displayName} initialName={viewer.displayName} />
        ) : (
          <Skeleton className="h-16 w-full" />
        )}
      </CardContent>
    </Card>
  )
}
