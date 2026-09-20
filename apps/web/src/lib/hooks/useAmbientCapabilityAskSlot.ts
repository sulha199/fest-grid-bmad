import { useAmbientCapabilityAskSlotStore } from '@/lib/state/ambient-capability-ask-slot-store'

/**
 * Story 0.42 — one participant registered with the shared Ambient Capability
 * Ask slot. `id` identifies the participant (e.g. `'pwa-install'`,
 * `'location'`); `canShow` is that participant's own eligibility, computed
 * entirely by the participant itself.
 */
export interface AmbientCapabilityAskParticipant {
  id: string
  canShow: boolean
}

/**
 * Story 0.42 — resolves which (if any) Ambient Capability Ask participant
 * should render its banner right now.
 *
 * Rules (AC4-AC7):
 * - List position IS the priority order — index 0 is highest priority, never
 *   a separate numeric field. A future participant joins by array position.
 * - Returns the `id` of the first participant whose `canShow` is `true`, or
 *   `null` if none is eligible.
 * - If the slot's own session-dismiss flag is `true`, returns `null`
 *   unconditionally, checked BEFORE the priority scan (a dismissed slot never
 *   inspects `canShow` at all).
 * - Not memoized against its own prior return value — recomputes from the
 *   current `participants` array and the current `dismissedThisSession` flag
 *   on every render, exactly like a plain derived-state selector.
 */
export function useAmbientCapabilityAskSlot(
  participants: AmbientCapabilityAskParticipant[]
): string | null {
  const dismissedThisSession = useAmbientCapabilityAskSlotStore((state) => state.dismissedThisSession)

  if (dismissedThisSession) return null

  const winner = participants.find((participant) => participant.canShow)
  return winner ? winner.id : null
}
