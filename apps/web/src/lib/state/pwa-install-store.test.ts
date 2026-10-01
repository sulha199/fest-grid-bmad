import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  usePwaInstallStore,
  type BeforeInstallPromptEvent,
} from './pwa-install-store'

/** A cancelable `beforeinstallprompt` event carrying the real contract's prompt/userChoice. */
class FakeBeforeInstallPromptEvent extends Event {
  prompt = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>

  constructor(outcome: 'accepted' | 'dismissed' = 'accepted') {
    super('beforeinstallprompt', { cancelable: true })
    this.userChoice = Promise.resolve({ outcome, platform: 'web' })
  }
}

describe('usePwaInstallStore (Story 0.38a AC1, AC2 — Task 1)', () => {
  beforeEach(() => {
    // The store is a module singleton — reset between tests.
    usePwaInstallStore.setState({ deferredEvent: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with deferredEvent: null', () => {
    expect(usePwaInstallStore.getState().deferredEvent).toBeNull()
  })

  it('setDeferredEvent stores an event and can clear it back to null', () => {
    const fake = new FakeBeforeInstallPromptEvent()
    usePwaInstallStore.getState().setDeferredEvent(fake as unknown as BeforeInstallPromptEvent)
    expect(usePwaInstallStore.getState().deferredEvent).toBe(fake)

    usePwaInstallStore.getState().setDeferredEvent(null)
    expect(usePwaInstallStore.getState().deferredEvent).toBeNull()
  })

  it('captures a dispatched cancelable beforeinstallprompt event, calling preventDefault (AC1)', () => {
    const evt = new FakeBeforeInstallPromptEvent()
    window.dispatchEvent(evt)

    expect(usePwaInstallStore.getState().deferredEvent).toBe(evt)
    expect(evt.defaultPrevented).toBe(true)
  })

  it('attaches no additional beforeinstallprompt listener when the (cached) module is re-imported (Task 1.3 guard)', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    await import('./pwa-install-store')
    await import('./pwa-install-store')

    const registrations = addSpy.mock.calls.filter(
      ([type]) => type === 'beforeinstallprompt'
    )
    // The module-level guard + module caching mean no second listener is added.
    expect(registrations).toHaveLength(0)
    addSpy.mockRestore()
  })
})
