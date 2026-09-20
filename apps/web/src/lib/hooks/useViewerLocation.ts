import { useEffect, useCallback } from 'react'
import { useCurrentLocationCapture, type GeolocationCaptureError } from '@festgrid/ui'
import { useViewerLocationStore } from '@/lib/state/viewer-location-store'
import {
  queryGeolocationPermissionStatus,
  subscribeToGeolocationPermissionChanges,
} from '@/lib/location/query-geolocation-permission'
import {
  isPermanentlyDismissed,
  dismissPermanently as persistDismissPermanently,
  getRemindCooldownExpiry,
  startRemindCooldown,
} from '@/lib/location/viewer-location-storage'

// Story 0.39 AC2/Task 1.3 — module-level guard: the permission query +
// change-subscription runs at most once regardless of how many components
// call useViewerLocation(), mirroring Story 0.38a's beforeinstallprompt
// listener-guard pattern.
let permissionQueryStarted = false

export interface UseViewerLocationResult {
  coordinate: { latitude: number; longitude: number } | null
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unsupported'
  canShowAmbientAsk: boolean
  /** Forwarded from the underlying capture primitive — needed by the three migrated consumers' existing disabled/loading UI, unchanged by this migration (AC11). */
  isAvailable: boolean
  isCapturing: boolean
  error: GeolocationCaptureError | null
  /** Cached-session read, never forces a fresh browser prompt. Used internally for the silent-when-granted path (AC3); also exposed for any future ambient consumer. */
  captureAmbient: () => Promise<{ latitude: number; longitude: number } | undefined>
  /** Always calls the real getCurrentPosition, regardless of any cached value — the only entry point the three explicit "use my current location" consumers should call (AC10). */
  captureExplicit: () => Promise<{ latitude: number; longitude: number }>
  dismissPermanently: () => void
  remindLater: () => void
}

/**
 * Story 0.39 — the one shared, app-level way to obtain the viewer's current
 * geographic coordinate: passively when the browser has already granted
 * permission, and via a consent-aware ambient banner (Story 0.42's slot, this
 * story's Task 5) when it hasn't.
 */
export function useViewerLocation(): UseViewerLocationResult {
  const coordinate = useViewerLocationStore((state) => state.coordinate)
  const permissionStatus = useViewerLocationStore((state) => state.permissionStatus)
  const setCoordinate = useViewerLocationStore((state) => state.setCoordinate)

  const { isAvailable, isCapturing, error, capture } = useCurrentLocationCapture()

  // AC2 — query the permission status once, and stay reactive to a later
  // browser-level grant/revoke without polling.
  useEffect(() => {
    if (permissionQueryStarted) return
    permissionQueryStarted = true

    let unsubscribe: (() => void) | undefined
    queryGeolocationPermissionStatus().then((status) => {
      useViewerLocationStore.getState().setPermissionStatus(status)
    })
    subscribeToGeolocationPermissionChanges((status) => {
      useViewerLocationStore.getState().setPermissionStatus(status)
    }).then((unsub) => {
      unsubscribe = unsub
    })

    return () => unsubscribe?.()
  }, [])

  const captureAmbient = useCallback(async (): Promise<
    { latitude: number; longitude: number } | undefined
  > => {
    const state = useViewerLocationStore.getState()
    if (state.coordinate) return state.coordinate

    if (state.permissionStatus !== 'granted') return undefined

    try {
      const coord = await capture()
      useViewerLocationStore.getState().setCoordinate(coord, Date.now())
      return coord
    } catch {
      return undefined
    }
  }, [capture])

  // AC3 — silent capture-when-granted-and-not-yet-cached path.
  useEffect(() => {
    if (coordinate == null && permissionStatus === 'granted') {
      captureAmbient()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionStatus])

  const captureExplicit = useCallback(async (): Promise<{ latitude: number; longitude: number }> => {
    const coord = await capture()
    setCoordinate(coord, Date.now())
    return coord
  }, [capture, setCoordinate])

  // AC5 — eligible only when not permanently dismissed and not in cooldown.
  // Whether it actually renders is Story 0.42's own further gating.
  const canShowAmbientAsk =
    (permissionStatus === 'prompt' || permissionStatus === 'unsupported') &&
    !isPermanentlyDismissed() &&
    getRemindCooldownExpiry() == null

  const handleDismissPermanently = useCallback(() => {
    persistDismissPermanently()
  }, [])

  const handleRemindLater = useCallback(() => {
    startRemindCooldown()
  }, [])

  return {
    coordinate,
    permissionStatus,
    canShowAmbientAsk,
    isAvailable,
    isCapturing,
    error,
    captureAmbient,
    captureExplicit,
    dismissPermanently: handleDismissPermanently,
    remindLater: handleRemindLater,
  }
}
