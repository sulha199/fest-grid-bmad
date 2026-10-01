import type { GeolocationPermissionStatus } from '@/lib/state/viewer-location-store'

/**
 * Story 0.39 (AC2) — queries the browser's current geolocation permission
 * status via the Permissions API. Degrades to `'unsupported'` (never throws)
 * when `navigator.permissions` is unavailable, or `.query({name:
 * 'geolocation'})` itself throws (some older Safari versions reject
 * unsupported permission names) — treated identically to `'prompt'` for
 * ask-eligibility purposes, since the real `getCurrentPosition` call remains
 * the authoritative fallback signal either way.
 */
export async function queryGeolocationPermissionStatus(): Promise<GeolocationPermissionStatus> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unsupported'
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state as GeolocationPermissionStatus
  } catch {
    return 'unsupported'
  }
}

/**
 * Story 0.39 (AC2) — subscribes to the given `PermissionStatus`'s own
 * `change` event so a store's `permissionStatus` can stay reactive to a
 * later browser-level grant/revoke (e.g. via browser settings) without
 * polling. Returns an unsubscribe function; a no-op if `navigator.permissions`
 * is unavailable (the caller should already have degraded to `'unsupported'`
 * via `queryGeolocationPermissionStatus()` in that case).
 */
export async function subscribeToGeolocationPermissionChanges(
  onChange: (status: GeolocationPermissionStatus) => void
): Promise<() => void> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return () => {}
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    const handleChange = () => onChange(status.state as GeolocationPermissionStatus)
    status.addEventListener('change', handleChange)
    return () => status.removeEventListener('change', handleChange)
  } catch {
    return () => {}
  }
}
