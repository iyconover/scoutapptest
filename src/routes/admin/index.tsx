import { CalendarCogIcon, ChevronRightIcon, EyeIcon, UsersIcon, type LucideIcon } from "lucide-react"
import { Link } from "react-router"

import { PageContainer, PageHeader } from "@/components/page-header"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const SECTIONS: { to: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    to: "/admin/event-setup",
    title: "Event Setup",
    description: "Import an event from The Blue Alliance and manage syncing.",
    icon: CalendarCogIcon,
  },
  {
    to: "/admin/users",
    title: "Users",
    description: "Promote admins and see who has signed up.",
    icon: UsersIcon,
  },
  {
    to: "/admin/assignments",
    title: "Assignments",
    description: "Assign scouters to watch specific teams.",
    icon: EyeIcon,
  },
]

export function AdminIndexRoute() {
  return (
    <PageContainer>
      <PageHeader title="Admin" description="Event and team management." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link key={section.to} to={section.to} className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <section.icon className="size-5 text-muted-foreground" />
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </PageContainer>
  )
}
