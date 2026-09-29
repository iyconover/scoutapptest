import {
  ClipboardListIcon,
  HistoryIcon,
  HomeIcon,
  ListOrderedIcon,
  ShieldIcon,
  SwordsIcon,
  UsersIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

export type NavItem = { to: string; label: string; icon: LucideIcon; adminOnly?: boolean }

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/teams", label: "Teams", icon: UsersIcon },
  { to: "/pit", label: "Pit Scouting", icon: WrenchIcon },
  { to: "/match-scouting", label: "Match Scouting", icon: ClipboardListIcon },
  { to: "/matches", label: "Match History", icon: HistoryIcon },
  { to: "/pick-lists", label: "Pick Lists", icon: ListOrderedIcon },
  { to: "/war-games", label: "War Games", icon: SwordsIcon },
  { to: "/admin", label: "Admin", icon: ShieldIcon, adminOnly: true },
]
