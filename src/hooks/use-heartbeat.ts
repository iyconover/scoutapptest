import { useMutation } from "convex/react"
import { useEffect } from "react"

import { api } from "../../convex/_generated/api"
import { HEARTBEAT_MS } from "../../convex/lib/constants"
import type { Page } from "../../convex/lib/validators"

/** Report presence while the tab is visible. Mounted once in ProtectedLayout. */
export function useHeartbeat(page: Page) {
  const heartbeat = useMutation(api.presence.heartbeat)

  useEffect(() => {
    const beat = () => {
      if (document.visibilityState === "visible") void heartbeat({ page }).catch(() => {})
    }
    beat()
    const id = setInterval(beat, HEARTBEAT_MS)
    document.addEventListener("visibilitychange", beat)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", beat)
    }
  }, [heartbeat, page])
}
