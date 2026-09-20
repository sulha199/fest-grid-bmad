import { useCallback, useEffect, useReducer, useRef } from 'react'
import { usePwaInstallStore } from '@/lib/state/pwa-install-store'
import { detectInstallPlatform, type DetectableInstallPlatform } from '@/lib/pwa/detect-install-platform'
import {
  IOS_VISIT_THRESHOLD,
  getRemindCooldownExpiry,
  getVisitCount,
  incrementAndGetVisitCount,
  isPermanentlyDismissed,
  dismissPermanently as persistDismissPermanently,
  startRemindCooldown,
} from '@/lib/pwa/pwa-install-storage'

export type PwaInstallOutcome = 'accepted' | 'dismissed' | 'ios-instructions' | 'unavailable'

export interface UsePwaInstallPromptResult {
  canShow: boolean
  platform: DetectableInstallPlatform
  promptInstall: () => Promise<PwaInstallOutcome>
  dismissPermanently: () => void
  remindLater: () => void
}

/**
 * Story 0.38a (AC10) — the single shared source of install-eligibility truth
 * for the PWA install prompt. Renders no UI; it only exposes a boolean
 * (`canShow`), the detected `platform`, and the two dismiss actions + the
 * prompt trigger. Story 0.38 consumes it from both the AppShell banner and
 * the Settings-tab fallback.
 *
 * `canShow` derives from: not permanently dismissed AND not in cooldown AND
 * (`platform === 'android'` with a live captured event OR `platform === 'ios'`
 * with the visit-count threshold met).
 */
export function usePwaInstallPrompt(): UsePwaInstallPromptResult {
  const deferredEvent = usePwaInstallStore((state) => state.deferredEvent)
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  // AC4 — keep the visit counter to one increment per mount, guarding against
  // React strict-mode double-invoke / re-renders within the same mount.
  const didIncrementVisit = useRef(false)
  useEffect(() => {
    if (didIncrementVisit.current) return
    didIncrementVisit.current = true
    incrementAndGetVisitCount()
  }, [])

  const platform = detectInstallPlatform(deferredEvent !== null)

  const promptInstall = useCallback(async (): Promise<PwaInstallOutcome> => {
    // AC5 — iOS never triggers a native prompt; we only signal the caller to
    // open the (Story 0.38-provided) instructions modal.
    if (platform === 'ios') return 'ios-instructions'

    const event = usePwaInstallStore.getState().deferredEvent
    // AC2 — defensive: no event captured yet (before capture, or on platforms
    // where it never fires) must not throw.
    if (!event) return 'unavailable'

    try {
      await event.prompt()
      const userChoice = await event.userChoice
      return userChoice.outcome
    } finally {
      // A `beforeinstallprompt` event can only be prompted once — never hand
      // out a stale, already-consumed event on a second call.
      usePwaInstallStore.getState().setDeferredEvent(null)
    }
  }, [platform])

  const dismissPermanently = useCallback(() => {
    persistDismissPermanently()
    forceRender()
  }, [])

  const remindLater = useCallback(() => {
    startRemindCooldown()
    forceRender()
  }, [])

  const canShow =
    !isPermanentlyDismissed() &&
    getRemindCooldownExpiry() == null &&
    ((platform === 'android' && deferredEvent !== null) ||
      (platform === 'ios' && getVisitCount() >= IOS_VISIT_THRESHOLD))

  return {
    canShow,
    platform,
    promptInstall,
    dismissPermanently,
    remindLater,
  }
}
