import { describe, it, expect, beforeEach } from 'vitest'
import { useAmbientCapabilityAskSlotStore } from './ambient-capability-ask-slot-store'

describe('useAmbientCapabilityAskSlotStore (Story 0.42 AC8-10)', () => {
  beforeEach(() => {
    // Reset between tests — Zustand stores are module-singleton state.
    useAmbientCapabilityAskSlotStore.setState({ dismissedThisSession: false })
  })

  it('initializes with dismissedThisSession: false', () => {
    expect(useAmbientCapabilityAskSlotStore.getState().dismissedThisSession).toBe(false)
  })

  it('markDismissedThisSession flips the flag to true and it stays true across repeated reads', () => {
    useAmbientCapabilityAskSlotStore.getState().markDismissedThisSession()

    expect(useAmbientCapabilityAskSlotStore.getState().dismissedThisSession).toBe(true)
    expect(useAmbientCapabilityAskSlotStore.getState().dismissedThisSession).toBe(true)

    // No "un-dismiss" action exists on the store.
    expect(
      (useAmbientCapabilityAskSlotStore.getState() as Record<string, unknown>).unmark
    ).toBeUndefined()
  })
})
