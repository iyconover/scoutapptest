import { createBrowserRouter } from "react-router"

import { AssignmentsRoute } from "@/routes/admin/assignments"
import { EventSetupRoute } from "@/routes/admin/event-setup"
import { AdminIndexRoute } from "@/routes/admin/index"
import { UsersRoute } from "@/routes/admin/users"
import { AuthLayout } from "@/routes/auth-layout"
import { HomeRoute } from "@/routes/home"
import { MatchScoutingIndexRoute } from "@/routes/match-scouting/index"
import { MatchScoutRoute } from "@/routes/match-scouting/scout"
import { MatchesRoute } from "@/routes/matches"
import { NotFoundRoute } from "@/routes/not-found"
import { PickListsIndexRoute } from "@/routes/pick-lists/index"
import { PickListRoute } from "@/routes/pick-lists/list"
import { PitIndexRoute } from "@/routes/pit/index"
import { PitTeamRoute } from "@/routes/pit/team"
import { ProtectedLayout } from "@/routes/protected-layout"
import { RequireAdmin } from "@/routes/require-admin"
import { RootLayout } from "@/routes/root-layout"
import { SignInRoute } from "@/routes/sign-in"
import { TeamsRoute } from "@/routes/teams"
import { WarGamesIndexRoute } from "@/routes/war-games/index"
import { WarGameRoute } from "@/routes/war-games/scenario"

/**
 * Route table. URL contract (other pages link to these):
 *   /                          home dashboard
 *   /teams                     team list        (?team=<n> opens team detail on any page)
 *   /pit, /pit/:teamNumber     pit scouting grid + form
 *   /match-scouting            match scouting landing
 *   /match-scouting/scout      scouting form for the current match
 *   /matches                   match history
 *   /pick-lists, /pick-lists/:listId
 *   /war-games, /war-games/:warGameId
 *   /admin, /admin/event-setup, /admin/users, /admin/assignments   (admins only)
 */
export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      {
        Component: ProtectedLayout,
        children: [
          { index: true, Component: HomeRoute },
          { path: "teams", Component: TeamsRoute },
          { path: "pit", Component: PitIndexRoute },
          { path: "pit/:teamNumber", Component: PitTeamRoute },
          { path: "match-scouting", Component: MatchScoutingIndexRoute },
          { path: "match-scouting/scout", Component: MatchScoutRoute },
          { path: "matches", Component: MatchesRoute },
          { path: "pick-lists", Component: PickListsIndexRoute },
          { path: "pick-lists/:listId", Component: PickListRoute },
          { path: "war-games", Component: WarGamesIndexRoute },
          { path: "war-games/:warGameId", Component: WarGameRoute },
          {
            path: "admin",
            Component: RequireAdmin,
            children: [
              { index: true, Component: AdminIndexRoute },
              { path: "event-setup", Component: EventSetupRoute },
              { path: "users", Component: UsersRoute },
              { path: "assignments", Component: AssignmentsRoute },
            ],
          },
        ],
      },
      {
        Component: AuthLayout,
        children: [{ path: "sign-in", Component: SignInRoute }],
      },
      { path: "*", Component: NotFoundRoute },
    ],
  },
])
