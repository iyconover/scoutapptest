import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ShieldIcon, ShieldOffIcon, UsersIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { PageContainer, PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useViewer } from "@/hooks/use-viewer"
import { errorMessage } from "@/lib/errors"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import type { Role } from "../../../convex/lib/validators"

type Profile = FunctionReturnType<typeof api.users.listProfiles>[number]

export function UsersRoute() {
  const profiles = useQuery(api.users.listProfiles)
  const viewerId = useViewer()?.userId
  const setRole = useMutation(api.users.setRole)
  const [pendingId, setPendingId] = useState<Id<"users"> | null>(null)
  const [confirmSelf, setConfirmSelf] = useState(false)

  const changeRole = async (profile: Profile, role: Role) => {
    setPendingId(profile.userId)
    try {
      await setRole({ userId: profile.userId, role })
      toast.success(role === "admin" ? `${profile.displayName} is now an admin` : `${profile.displayName} is now a scouter`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setPendingId(null)
    }
  }

  const adminCount = profiles?.filter((p) => p.role === "admin").length ?? 0
  const me = profiles?.find((p) => p.userId === viewerId)

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description={
          profiles
            ? `${profiles.length} ${profiles.length === 1 ? "person has" : "people have"} signed up · ${adminCount} admin${adminCount === 1 ? "" : "s"}`
            : "Everyone who has signed up."
        }
      />

      {profiles === undefined ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>No users yet</EmptyTitle>
            <EmptyDescription>People appear here after they sign up.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <ul className="divide-y">
              {profiles.map((profile) => {
                const isYou = profile.userId === viewerId
                const isAdmin = profile.role === "admin"
                const pending = pendingId === profile.userId
                return (
                  <li key={profile.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate font-medium">{profile.displayName}</span>
                      {isYou && <Badge variant="outline">You</Badge>}
                      <Badge variant={isAdmin ? "secondary" : "outline"}>{isAdmin ? "Admin" : "Scouter"}</Badge>
                    </div>
                    <Button
                      variant="outline"
                      className="h-11 min-w-36"
                      disabled={pendingId !== null}
                      onClick={() => {
                        if (isAdmin && isYou) setConfirmSelf(true)
                        else void changeRole(profile, isAdmin ? "scouter" : "admin")
                      }}
                    >
                      {pending ? (
                        <Spinner data-icon="inline-start" />
                      ) : isAdmin ? (
                        <ShieldOffIcon data-icon="inline-start" />
                      ) : (
                        <ShieldIcon data-icon="inline-start" />
                      )}
                      {isAdmin ? "Make scouter" : "Make admin"}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmSelf} onOpenChange={setConfirmSelf}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove your own admin access?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to the admin pages right away. Another admin would have to promote you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmSelf(false)
                if (me) void changeRole(me, "scouter")
              }}
            >
              Make me a scouter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
