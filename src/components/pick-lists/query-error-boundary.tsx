import { Component, type ReactNode } from "react"

/**
 * Catches errors thrown by `useQuery` below it (e.g. a malformed list id in the URL, or a merge
 * source list deleted mid-preview) and renders `fallback` instead of crashing the route.
 * Remount with a new `key` to reset.
 */
export class QueryErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
