import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAmbientCapabilityAskSlot } from './useAmbientCapabilityAskSlot'
import { useAmbientCapabilityAskSlotStore } from '@/lib/state/ambient-capability-ask-slot-store'

describe('useAmbientCapabilityAskSlot (Story 0.42 AC4-AC7)', () => {
  beforeEach(() => {
    useAmbientCapabilityAskSlotStore.setState({ dismissedThisSession: false })
  })

  it('returns the first (highest-priority, by list position) participant with canShow: true', () => {
    const { result } = renderHook(() =>
      useAmbientCapabilityAskSlot([
        { id: 'pwa-install', canShow: true },
        { id: 'location', canShow: true },
      ])
    )
    expect(result.current).toBe('pwa-install')
  });

  it('skips a lower-priority participant when a higher-priority one is not eligible', () => {
    const { result } = renderHook(() =>
      useAmbientCapabilityAskSlot([
        { id: 'pwa-install', canShow: false },
        { id: 'location', canShow: true },
      ])
    )
    expect(result.current).toBe('location')
  });

  it('returns null when no participant has canShow: true', () => {
    const { result } = renderHook(() =>
      useAmbientCapabilityAskSlot([
        { id: 'pwa-install', canShow: false },
        { id: 'location', canShow: false },
      ])
    )
    expect(result.current).toBeNull()
  });

  it('returns null for an empty participants array', () => {
    const { result } = renderHook(() => useAmbientCapabilityAskSlot([]))
    expect(result.current).toBeNull()
  });

  it('returns null unconditionally once the slot is dismissed for the session, regardless of canShow/priority', () => {
    useAmbientCapabilityAskSlotStore.getState().markDismissedThisSession()

    const { result } = renderHook(() =>
      useAmbientCapabilityAskSlot([{ id: 'pwa-install', canShow: true }])
    )
    expect(result.current).toBeNull()
  });

  it('recomputes on every render — reacts to a participants array change without a stale cached result', () => {
    const { result, rerender } = renderHook(
      ({ participants }) => useAmbientCapabilityAskSlot(participants),
      { initialProps: { participants: [{ id: 'pwa-install', canShow: false }] } }
    )
    expect(result.current).toBeNull()

    rerender({ participants: [{ id: 'pwa-install', canShow: true }] })
    expect(result.current).toBe('pwa-install')
  });

  it('recomputes on every render — reacts to the store dismissing mid-session', () => {
    const { result, rerender } = renderHook(() =>
      useAmbientCapabilityAskSlot([{ id: 'pwa-install', canShow: true }])
    )
    expect(result.current).toBe('pwa-install')

    useAmbientCapabilityAskSlotStore.getState().markDismissedThisSession()
    rerender();
    expect(result.current).toBeNull()
  });
});
