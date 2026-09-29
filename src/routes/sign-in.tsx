import { useState, type FormEvent } from "react"
import { useAuthActions } from "@convex-dev/auth/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Flow = "signIn" | "signUp"

export function SignInRoute() {
  const { signIn } = useAuthActions()
  const [flow, setFlow] = useState<Flow>("signIn")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set("flow", flow)
    setSubmitting(true)
    try {
      await signIn("password", formData)
    } catch {
      toast.error(
        flow === "signIn"
          ? "Could not sign in. Check your email and password."
          : "Could not create account. The password must be at least 8 characters.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{flow === "signIn" ? "Sign in" : "Create account"}</CardTitle>
        <CardDescription>Use your email and password.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs value={flow} onValueChange={(value) => setFlow(value as Flow)}>
          <TabsList className="w-full">
            <TabsTrigger value="signIn">Sign in</TabsTrigger>
            <TabsTrigger value="signUp">Sign up</TabsTrigger>
          </TabsList>
        </Tabs>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={flow === "signIn" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {flow === "signIn" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
