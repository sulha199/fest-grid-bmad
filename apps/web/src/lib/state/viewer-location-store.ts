import { create } from 'zustand'

export type GeolocationPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported'

export interface ViewerLocationState {
  coordinate: { latitude: number; longitude: number } | null
  capturedAt: number | null
  permissionStatus: GeolocationPermissionStatus
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
  setCoordinate: (coordinate, capturedAt) => set({ coordinate, capturedAt }),
  setPermissionStatus: (status) => set({ permissionStatus: status }),
}))
