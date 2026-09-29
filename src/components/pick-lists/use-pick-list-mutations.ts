import { useMutation } from "convex/react"

import { api } from "../../../convex/_generated/api"
import { compareEntries } from "./board-utils"

/** moveEntry with an optimistic update of the list's `get` result, so drops don't jump. */
export function useMoveEntry() {
  return useMutation(api.pickLists.moveEntry).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.pickLists.get, { listId: args.listId })
    if (!current) return
    const entries = current.entries
      .map((e) => (e.teamNumber === args.teamNumber ? { ...e, column: args.column, order: args.order } : e))
      .sort(compareEntries)
    store.setQuery(api.pickLists.get, { listId: args.listId }, { ...current, entries })
  })
}

/** setSelected is event-wide, so optimistically fade the team on every loaded list. */
export function useSetSelected() {
  return useMutation(api.pickLists.setSelected).withOptimisticUpdate((store, args) => {
    for (const { args: queryArgs, value } of store.getAllQueries(api.pickLists.get)) {
      if (!value) continue
      store.setQuery(api.pickLists.get, queryArgs, {
        ...value,
        entries: value.entries.map((e) =>
          e.teamNumber === args.teamNumber ? { ...e, selected: args.selected } : e,
        ),
      })
    }
  })
}
