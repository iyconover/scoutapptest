# scoutapptest

Framework baseline: Bun · Vite · React 19 · React Router 7 (SPA, data router) · TypeScript (strict) ·
Tailwind CSS v4 · shadcn/ui on Base UI · Convex + Convex Auth · Zustand · next-themes · Sonner.

## Run

```bash
bun install
bun run dev
```

`bun run dev` first runs `bun run setup` (idempotent). That links the Convex dev deployment
(`ian-conover/scoutapp`) if `.env.local` is missing, pushes functions, and sets the Convex Auth env
vars. Then it runs `convex dev` and Vite (http://localhost:5173) together.

In Claude Code you can also just run `/start`.

## Scripts

| Script | What it does |
| --- | --- |
| `dev` | Setup, then Convex + Vite in parallel |
| `setup` | Link Convex and ensure auth keys (`bun run setup --rotate-auth-keys` regenerates them) |
| `build` | Typecheck and production build |
| `typecheck` | `tsc` for the app, scripts, and `convex/` |
| `lint` | oxlint |

## Layout

- `convex/`: schema, functions, and Convex Auth (`auth.ts`, `auth.config.ts`, `http.ts`)
- `src/app/`: providers (theme, Convex auth, tooltip) and the route table
- `src/routes/`: route components and layouts (`protected-layout` / `auth-layout` guard auth)
- `src/components/ui/`: shadcn components (Base UI). Add more with `bun x shadcn@latest add <name>`
- `src/stores/`: Zustand stores, **ephemeral UI state only**
