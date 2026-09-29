import { createBrowserRouter } from "react-router"

import { AuthLayout } from "@/routes/auth-layout"
import { HomeRoute } from "@/routes/home"
import { NotFoundRoute } from "@/routes/not-found"
import { ProtectedLayout } from "@/routes/protected-layout"
import { RootLayout } from "@/routes/root-layout"
import { SignInRoute } from "@/routes/sign-in"

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      {
        Component: ProtectedLayout,
        children: [{ index: true, Component: HomeRoute }],
      },
      {
        Component: AuthLayout,
        children: [{ path: "sign-in", Component: SignInRoute }],
      },
      { path: "*", Component: NotFoundRoute },
    ],
  },
])
