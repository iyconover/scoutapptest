import type { OptimisticLocalStore } from "convex/browser"
import { useMutation } from "convex/react"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import type { WarGameData } from "./types"

function patchScenario(
  store: OptimisticLocalStore,
  warGameId: Id<"warGames">,
  update: (data: WarGameData) => WarGameData,
) {
  const current = store.getQuery(api.warGames.get, { warGameId })
  if (current) store.setQuery(api.warGames.get, { warGameId }, update(current))
}

/** War Games mutations with optimistic updates on the `get` query. */
export function useWarGameMutations() {
  const setPrediction = useMutation(api.warGames.setPrediction).withOptimisticUpdate((store, args) =>
    patchScenario(store, args.warGameId, (d) => ({
      ...d,
      predictions: d.predictions.map((p) =>
        p.matchId === args.matchId ? { ...p, redRP: args.redRP, blueRP: args.blueRP, manual: true } : p,
      ),
    })),
  )

  const resetPredictions = useMutation(api.warGames.resetPredictions).withOptimisticUpdate((store, args) =>
    patchScenario(store, args.warGameId, (d) => ({
      ...d,
      predictions: d.predictions.map((p) => ({ ...p, ...p.suggested, manual: false })),
    })),
  )

  const updateSettings = useMutation(api.warGames.updateSettings).withOptimisticUpdate((store, args) =>
    patchScenario(store, args.warGameId, (d) => ({
      ...d,
      scenario: {
        ...d.scenario,
        ...(args.method !== undefined && { method: args.method }),
        ...(args.winRP !== undefined && { winRP: args.winRP }),
        ...(args.tieRP !== undefined && { tieRP: args.tieRP }),
        ...(args.manualOrder !== undefined && { manualOrder: args.manualOrder }),
      },
    })),
  )

  const setAlliances = useMutation(api.warGames.setAlliances).withOptimisticUpdate((store, args) =>
    patchScenario(store, args.warGameId, (d) => ({ ...d, scenario: { ...d.scenario, alliances: args.alliances } })),
  )

  const toggleLock = useMutation(api.warGames.toggleLock).withOptimisticUpdate((store, args) =>
    patchScenario(store, args.warGameId, (d) => ({
      ...d,
      scenario: {
        ...d.scenario,
        alliances: d.scenario.alliances.map((a, i) =>
          i === args.alliance ? { ...a, locked: a.locked.map((l, s) => (s === args.slot ? !l : l)) } : a,
        ),
      },
    })),
  )

  const rename = useMutation(api.warGames.rename).withOptimisticUpdate((store, args) =>
    patchScenario(store, args.warGameId, (d) => ({ ...d, scenario: { ...d.scenario, name: args.name.trim() } })),
  )

  const runDraft = useMutation(api.warGames.runDraft)
  const remove = useMutation(api.warGames.remove)

  return { setPrediction, resetPredictions, updateSettings, setAlliances, toggleLock, rename, runDraft, remove }
}
