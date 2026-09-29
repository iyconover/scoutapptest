<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Project conventions

- Bun everywhere: `bun`, `bun x` (no `bunx` shim on this machine), `bun run`.
- Routing: React Router 7 data router in `src/app/router.tsx`; route components in `src/routes/`.
- UI: use shadcn components (Base UI flavor, `render` prop rather than `asChild`) before hand-rolling
  controls. Add them with `bun x shadcn@latest add <name>`. Icons come from `lucide-react`.
  Toasts use `toast` from `sonner`; the `<Toaster />` is already in `RootLayout`.
- Theming: CSS variables in `src/index.css`; next-themes class strategy (`dark` class on `<html>`).
- Data: Convex is the source of truth for persisted/domain data. Read with `useQuery` and write with
  `useMutation`. Don't add API routes or extra backend layers, and don't copy query results into Zustand.
- Auth: Convex Auth (`@convex-dev/auth`, Password provider). Use `getAuthUserId(ctx)` in functions.
- Zustand (`src/stores/`) is only for ephemeral client UI state: selection, tabs, panels, dialogs, drag, drafts.
- Keep TypeScript strict. Run `bun run typecheck` and `bun run lint` before finishing.
