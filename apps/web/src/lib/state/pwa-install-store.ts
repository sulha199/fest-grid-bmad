import { create } from 'zustand'

/**
 * The `BeforeInstallPromptEvent` browser event type. It is a real standard
 * event (web.dev / MDN) but is NOT yet shipped in this repo's TypeScript
 * `lib.dom.d.ts` (verified at implementation time for Story 0.38a), so it is
 * declared locally here per the story's instruction rather than pulling in a
 * third-party `@types` package for a single interface.
 *
 * `userChoice` is a Promise that resolves once the user has answered the
 * native install prompt, with the same shape Chrome's real event exposes.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export interface PwaInstallState {
  /** The captured `beforeinstallprompt` event, or null once consumed/cleared. */
  deferredEvent: BeforeInstallPromptEvent | null
}

export interface PwaInstallActions {
  setDeferredEvent: (event: BeforeInstallPromptEvent | null) => void
}

/**
 * Story 0.38a (AC1, AC2) — Client Global State (zustand) capturing the
 * browser's install-eligibility signal for the PWA install prompt. This
 * store listens for the native `beforeinstallprompt` event exactly once per
 * module lifecycle and exposes the captured event so both Story 0.38
 * consumers (AppShell banner, Settings-tab fallback) share one source of
 * truth instead of each re-implementing `beforeinstallprompt` capture.
 *
 * Per AD-4 rule 3 this is "interface-driven with strictly defined states and
 * actions", mirroring `example-ui-store.ts`'s shape/doc-comment style.
 */
export const usePwaInstallStore = create<PwaInstallState & PwaInstallActions>()((set) => ({
  deferredEvent: null,
  setDeferredEvent: (event) => set({ deferredEvent: event }),
}))

/**
 * Module-level listener guard (AC1, Task 1.3): attaches the
 * `beforeinstallprompt` listener at most once regardless of how many
 * components call the hook, so multiple hook consumers never stack up
 * duplicate listeners. `event.preventDefault()` is called per the standard
 * `beforeinstallprompt` contract so Chrome's own mini-infobar is suppressed
 * in favor of this app's banner (which Story 0.38 renders).
 */
let listenerRegistered = false

function handleBeforeInstallPrompt(event: Event): void {
  event.preventDefault()
  usePwaInstallStore.getState().setDeferredEvent(event as BeforeInstallPromptEvent)
}

function ensureBeforeInstallPromptRegistered(): void {
  if (listenerRegistered) return
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  listenerRegistered = true
}

// Attach once when this store is first imported (i.e. at the point the hook
// that consumes it is first used). SSR-safe via the typeof-window guard.
ensureBeforeInstallPromptRegistered()
