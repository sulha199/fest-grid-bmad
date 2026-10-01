import { create } from 'zustand'

export interface AmbientCapabilityAskSlotState {
  dismissedThisSession: boolean
}

export interface AmbientCapabilityAskSlotActions {
  markDismissedThisSession: () => void
}

/**
 * Story 0.42 — session-scoped (in-memory only, never localStorage-persisted)
 * dismiss flag for the shared Ambient Capability Ask banner slot.
 *
 * "Session" means the current page/tab lifetime: a hard reload or a new tab
 * starts with a fresh `dismissedThisSession: false`. Once any participant's
 * dismiss action calls `markDismissedThisSession()`, it stays `true` for the
 * rest of that lifetime — there is no "un-dismiss" action.
 *
 * This is deliberately distinct from each participant's own persisted
 * per-participant dismiss/cooldown state (e.g. Story 0.38a's
 * pwa-install-storage.ts, Story 0.39's viewer-location-storage.ts) — this
 * store never reads, writes, or duplicates that state (AC10).
 *
 * Follow AD-4 tier 3 rule: "Interface-driven with strictly defined states and actions."
 */
export const useAmbientCapabilityAskSlotStore = create<
  AmbientCapabilityAskSlotState & AmbientCapabilityAskSlotActions
>()((set) => ({
  dismissedThisSession: false,
  markDismissedThisSession: () => set({ dismissedThisSession: true }),
}))
