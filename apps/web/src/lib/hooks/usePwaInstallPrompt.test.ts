import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePwaInstallStore } from '@/lib/state/pwa-install-store'
import { usePwaInstallPrompt } from './usePwaInstallPrompt'

const VISIT_COUNT_KEY = 'festdaily_pwa_visit_count'
const IOS_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

class FakeBeforeInstallPromptEvent extends Event {
  prompt = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>

  constructor(outcome: 'accepted' | 'dismissed' = 'accepted') {
    super('beforeinstallprompt', { cancelable: true })
    this.userChoice = Promise.resolve({ outcome, platform: 'web' })
  }
}

let originalMatchMedia: typeof window.matchMedia | undefined

function stubIosSafari(): void {
  originalMatchMedia = window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ matches: false, media: '' })),
  })
  vi.stubGlobal('navigator', {
    userAgent: IOS_SAFARI_UA,
    maxTouchPoints: 0,
    standalone: false,
  })
}

function stubDesktop(): void {
  originalMatchMedia = window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ matches: false, media: '' })),
  })
  vi.stubGlobal('navigator', {
    userAgent: DESKTOP_CHROME_UA,
    maxTouchPoints: 0,
    standalone: false,
  })
}

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted'): FakeBeforeInstallPromptEvent {
  const evt = new FakeBeforeInstallPromptEvent(outcome)
  act(() => {
    window.dispatchEvent(evt)
  })
  return evt
}

describe('usePwaInstallPrompt (Story 0.38a AC1-AC10)', () => {
  beforeEach(() => {
    localStorage.clear()
    usePwaInstallStore.setState({ deferredEvent: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
    if (originalMatchMedia !== undefined) {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
      originalMatchMedia = undefined
    }
  })

  it('exposes platform unsupported + canShow false on a desktop browser with no captured event', () => {
    stubDesktop()
    const { result } = renderHook(() => usePwaInstallPrompt())

    expect(result.current.platform).toBe('unsupported')
    expect(result.current.canShow).toBe(false)
  })

  it('promptInstall returns unavailable when no event has been captured yet (defensive, AC2)', async () => {
    stubDesktop()
    const { result } = renderHook(() => usePwaInstallPrompt())

    let outcome: string = ''
    await act(async () => {
      outcome = await result.current.promptInstall()
    })
    expect(outcome).toBe('unavailable')
  })

  describe('Android path (AC1, AC2)', () => {
    it('captures a fired beforeinstallprompt event, making canShow true and platform android', () => {
      stubDesktop()
      const { result } = renderHook(() => usePwaInstallPrompt())

      expect(result.current.canShow).toBe(false)
      fireBeforeInstallPrompt()

      expect(result.current.platform).toBe('android')
      expect(result.current.canShow).toBe(true)
    })

    it('promptInstall consumes .prompt()/.userChoice and returns accepted, then clears the store', async () => {
      stubDesktop()
      const { result } = renderHook(() => usePwaInstallPrompt())

      const evt = fireBeforeInstallPrompt()

      let outcome: string = ''
      await act(async () => {
        outcome = await result.current.promptInstall()
      })

      expect(evt.prompt).toHaveBeenCalledTimes(1)
      expect(outcome).toBe('accepted')
      expect(usePwaInstallStore.getState().deferredEvent).toBeNull()
      // A second call after the event is consumed must not reuse a stale event.
      let second: string = ''
      await act(async () => {
        second = await result.current.promptInstall()
      })
      expect(second).toBe('unavailable')
    })

    it('returns dismissed when the user dismisses the native prompt', async () => {
      stubDesktop()
      const { result } = renderHook(() => usePwaInstallPrompt())

      fireBeforeInstallPrompt('dismissed')

      let outcome: string = ''
      await act(async () => {
        outcome = await result.current.promptInstall()
      })
      expect(outcome).toBe('dismissed')
      expect(usePwaInstallStore.getState().deferredEvent).toBeNull()
    })
  })
  describe('iOS path (AC3, AC4, AC5)', () => {
    it('is ios with canShow true once the visit-count threshold is met, and promptInstall returns ios-instructions without a native prompt', async () => {
      stubIosSafari()
      localStorage.setItem(VISIT_COUNT_KEY, '2') // return visitor at/above threshold
      const { result } = renderHook(() => usePwaInstallPrompt())

      expect(result.current.platform).toBe('ios')
      expect(result.current.canShow).toBe(true)

      let outcome: string = ''
      await act(async () => {
        outcome = await result.current.promptInstall()
      })
      // iOS never triggers a native prompt — only signals the caller.
      expect(outcome).toBe('ios-instructions')
      expect(usePwaInstallStore.getState().deferredEvent).toBeNull()
    })

    it('is ios but canShow stays false below the visit-count threshold (first visit)', () => {
      stubIosSafari()
      // Visit count starts at 0 and the single mount increment reaches 1 (< 2).
      const { result } = renderHook(() => usePwaInstallPrompt())

      expect(result.current.platform).toBe('ios')
      expect(result.current.canShow).toBe(false)
    })
  })

  describe('dismiss / cooldown (AC6, AC7, AC8)', () => {
    it('dismissPermanently makes canShow false unconditionally (AC6)', () => {
      stubIosSafari()
      localStorage.setItem(VISIT_COUNT_KEY, '2') // return visitor at/above threshold
      const { result } = renderHook(() => usePwaInstallPrompt())
      expect(result.current.canShow).toBe(true)

      act(() => {
        result.current.dismissPermanently()
      })
      expect(result.current.canShow).toBe(false)

      // Unconditionally false now regardless of eligibility conditions.
      localStorage.setItem(VISIT_COUNT_KEY, '5')
      fireBeforeInstallPrompt()
      expect(result.current.canShow).toBe(false)
    })

    it('remindLater starts a cooldown that suppresses canShow (AC7)', () => {
      stubIosSafari()
      localStorage.setItem(VISIT_COUNT_KEY, '2') // return visitor at/above threshold
      const { result } = renderHook(() => usePwaInstallPrompt())
      expect(result.current.canShow).toBe(true)

      act(() => {
        result.current.remindLater()
      })
      expect(result.current.canShow).toBe(false)
    })

    it('canShow returns true again exactly once a 14-day cooldown has elapsed (AC7, fake timers)', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      stubIosSafari()
      localStorage.setItem(VISIT_COUNT_KEY, '2') // return visitor at/above threshold

      const { result, rerender } = renderHook(() => usePwaInstallPrompt())
      expect(result.current.canShow).toBe(true)

      act(() => {
        result.current.remindLater()
      })
      expect(result.current.canShow).toBe(false)

      act(() => {
        vi.advanceTimersByTime(14 * 24 * 60 * 60 * 1000 + 1)
      })
      rerender()
      expect(result.current.canShow).toBe(true)
    })

    it('dismissPermanently and remindLater are independent (AC8)', () => {
      stubIosSafari()
      localStorage.setItem(VISIT_COUNT_KEY, '2')
      const { result } = renderHook(() => usePwaInstallPrompt())

      act(() => {
        result.current.dismissPermanently()
      })
      act(() => {
        result.current.remindLater()
      })
      // Both suppression mechanisms set; canShow remains false regardless.
      expect(result.current.canShow).toBe(false)
      expect(usePwaInstallStore.getState().deferredEvent).toBeNull()
    })
  })
})
