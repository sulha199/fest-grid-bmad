import { useEffect, useCallback, useReducer } from 'react'
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
//
// Story 1.i1f review finding 3 — the subscription is deliberately PERMANENT
// (never unsubscribed on unmount), matching this codebase's own established
// permanent-listener precedent (`apps/web/src/lib/state/pwa-install-store.ts`).
// A refcounted teardown is worse than either obviously-wrong option: the
// moment the FIRST of this hook's several call sites unmounted, the listener
// would be torn down for everyone, silently freezing `permissionStatus` at a
// stale value.
let permissionQueryStarted = false

/**
 * Story 1.i1f review finding 4 — one shared in-flight ambient capture for the
 * whole module. `useViewerLocation()` has several real call sites (AppShell's
 * wrapper, the Discovery nearby filter, the calendar hooks), so without this
 * dedupe every concurrent mount firing AC3's silent self-capture would issue
 * its own real `getCurrentPosition()` in the same commit. Cleared as soon as
 * the shared call settles, so a later ambient capture can start fresh.
 */
let ambientCaptureInFlight: Promise<{ latitude: number; longitude: number } | undefined> | null = null

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
  const permissionStatusResolved = useViewerLocationStore((state) => state.permissionStatusResolved)
  const setCoordinate = useViewerLocationStore((state) => state.setCoordinate)
  // Story 1.i1f review finding 6 — `canShowAmbientAsk` also depends on
  // localStorage-backed dismissal/cooldown state the Zustand store knows nothing
  // about, so a persist-only handler left this hook instance rendering a stale
  // value. Mirrors usePwaInstallPrompt's established `forceRender()` pattern.
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  const { isAvailable, isCapturing, error, capture } = useCurrentLocationCapture()

  // AC2 — query the permission status once, and stay reactive to a later
  // browser-level grant/revoke without polling. The subscription is never torn
  // down (finding 3) — see the module-level note above.
  useEffect(() => {
    if (permissionQueryStarted) return
    permissionQueryStarted = true

    queryGeolocationPermissionStatus().then((status) => {
      useViewerLocationStore.getState().setPermissionStatus(status)
    })
    subscribeToGeolocationPermissionChanges((status) => {
      useViewerLocationStore.getState().setPermissionStatus(status)
    })
  }, [])

  const captureAmbient = useCallback(async (): Promise<
    { latitude: number; longitude: number } | undefined
  > => {
    const state = useViewerLocationStore.getState()
    if (state.coordinate) return state.coordinate

    if (state.permissionStatus !== 'granted') return undefined

    // Finding 4 — concurrent callers (including other hook instances) share one
    // real getCurrentPosition() call instead of each issuing their own.
    if (ambientCaptureInFlight) return ambientCaptureInFlight

    ambientCaptureInFlight = (async () => {
      try {
        const coord = await capture()
        useViewerLocationStore.getState().setCoordinate(coord, Date.now())
        return coord
      } catch {
        return undefined
      } finally {
        ambientCaptureInFlight = null
      }
    })()

    return ambientCaptureInFlight
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

  // AC5 — eligible only once the browser's permission answer has actually been
  // read (finding 5), and only when not permanently dismissed and not in
  // cooldown. Whether it actually renders is Story 0.42's own further gating.
  const canShowAmbientAsk =
    permissionStatusResolved &&
    (permissionStatus === 'prompt' || permissionStatus === 'unsupported') &&
    !isPermanentlyDismissed() &&
    getRemindCooldownExpiry() == null

  const handleDismissPermanently = useCallback(() => {
    persistDismissPermanently()
    // Finding 6 — the dismissal lives in localStorage, not in the Zustand
    // store, so without this the calling instance kept rendering a stale
    // `canShowAmbientAsk`.
    forceRender()
  }, [])

  const handleRemindLater = useCallback(() => {
    startRemindCooldown()
    forceRender()
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
