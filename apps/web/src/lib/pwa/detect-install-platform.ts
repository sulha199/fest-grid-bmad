export type DetectableInstallPlatform = 'android' | 'ios' | 'unsupported'

/**
 * True when the current UA looks like iOS Safari (or iPadOS running Safari in
 * desktop mode, which reports a Mac UA but >1 touch points).
 */
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent ?? ''
  const classicIosUa = /iPad|iPhone|iPod/.test(ua)
  const maxTouchPoints = (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0
  const ipadOsDesktopMode = ua.includes('Mac') && maxTouchPoints > 1
  return classicIosUa || ipadOsDesktopMode
}

/**
 * True when the app is already running as an installed/standalone PWA —
 * either via CSS `display-mode: standalone` (Chrome/Android, modern iPadOS)
 * or the legacy iOS `window.navigator.standalone` flag.
 */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const displayModeStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches === true
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return displayModeStandalone === true || iosStandalone === true
}

/**
 * Story 0.38a (AC3) — computes the install-eligible platform.
 *
 * - `'ios'` only when the real iOS-Safari UA is present AND the app is not
 *   already running standalone (iOS has no native prompt; eligibility is
 *   signaled by the engagement heuristic, not an event).
 * - `'android'` only once a real `beforeinstallprompt` event has actually
 *   been captured (Chrome/Android's own engagement-gate signal — guessing
 *   "is this Chrome/Android" via UA is unreliable and redundant since Chrome
 *   fires the event exactly when the service-worker + engagement criteria
 *   have been met).
 * - `'unsupported'` for every other case (desktop browsers, already-installed
 *   sessions, non-Safari iOS browsers which lack a native prompt).
 */
export function detectInstallPlatform(hasCapturedAndroidEvent: boolean): DetectableInstallPlatform {
  if (isIosSafari() && !isStandalone()) return 'ios'
  if (hasCapturedAndroidEvent) return 'android'
  return 'unsupported'
}
