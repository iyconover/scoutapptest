import { useSearchParams } from "react-router"

/** Search param that opens the global team detail modal on any page. */
export const TEAM_PARAM = "team"

/** Opens the team detail modal (via `?team=`) without leaving the page. */
export function useOpenTeam() {
  const [params, setParams] = useSearchParams()
  return (teamNumber: number) => {
    const next = new URLSearchParams(params)
    next.set(TEAM_PARAM, String(teamNumber))
    setParams(next)
  }
}
