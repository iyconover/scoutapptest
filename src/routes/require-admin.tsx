import { Outlet } from "react-router"

import { PageContainer } from "@/components/page-header"
import { useViewer } from "@/hooks/use-viewer"

/** Route layout: renders child routes only for admins. */
export function RequireAdmin() {
  const viewer = useViewer()
  if (viewer === undefined) return null
  if (viewer?.role !== "admin") {
    return (
      <PageContainer>
        <p className="text-muted-foreground">This page is for admins only.</p>
      </PageContainer>
    )
  }
  return <Outlet />
}
