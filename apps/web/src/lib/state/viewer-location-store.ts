import { create } from 'zustand'

export type GeolocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported'

export interface ViewerLocationState {
  coordinate: { latitude: number; longitude: number } | null
  capturedAt: number | null
  permissionStatus: GeolocationPermissionStatus
  /**
   * Story 1.i1f review finding 5 — `false` until the async
   * `navigator.permissions.query()` answer has actually arrived. AC5
   * eligibility reads this instead of trusting the optimistic `'prompt'`
   * initial value, so the server and the first client render agree (no
   * hydration mismatch) and the ambient banner cannot flash before the browser
   * has been asked.
   */
  permissionStatusResolved: boolean
}

export interface ViewerLocationActions {
  setCoordinate: (coordinate: { latitude: number; longitude: number } | null, capturedAt: number | null) => void
  setPermissionStatus: (status: GeolocationPermissionStatus) => void
}

/**
 * Story 0.39 — the viewer's last-captured coordinate + the browser's current
 * geolocation permission status. In-memory only, never persisted to
 * localStorage (a hard reload/new tab starts fresh — "capture once per
 * session"). This is the one shared source three existing explicit "use my
 * current location" entry points and the ambient consent banner all read
 * from/write to, replacing their own previously-independent local state.
 *
 * Follow AD-4 tier 3 rule: "Interface-driven with strictly defined states and actions."
 */
export const useViewerLocationStore = create<ViewerLocationState & ViewerLocationActions>()((set) => ({
  coordinate: null,
  capturedAt: null,
  permissionStatus: 'prompt',
  permissionStatusResolved: false,
  setCoordinate: (coordinate, capturedAt) => set({ coordinate, capturedAt }),
  setPermissionStatus: (status) =>
    set((state) => ({
      permissionStatus: status,
      permissionStatusResolved: true,
      // Story 1.i1f review finding 1 — a coordinate captured while granted must
      // not outlive the viewer (or their browser) revoking that permission, or
      // every distance badge keeps rendering against a location the viewer has
      // since withdrawn. `unsupported` is left alone: it can only be the initial
      // answer, never a transition, so there is nothing cached to invalidate.
      coordinate: status === 'denied' ? null : state.coordinate,
      capturedAt: status === 'denied' ? null : state.capturedAt,
    })),
}))
