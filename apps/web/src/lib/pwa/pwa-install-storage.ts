const DISMISSED_KEY = 'festdaily_pwa_install_dismissed'
const REMIND_AT_KEY = 'festdaily_pwa_install_remind_at'
const VISIT_COUNT_KEY = 'festdaily_pwa_visit_count'
const REMIND_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

/**
 * The concrete iOS engagement threshold (AC4). Per the UX spec's "exact
 * threshold left to the implementation story" note, iOS eligibility requires
 * the local visitor to have reached their **2nd** page view (i.e. not the
 * very first-ever visit). This is deliberately the smallest concrete value
 * that mirrors Chrome's "not on the first visit" spirit without inventing an
 * elaborate dwell-timer (iOS has no engagement signal to hook into anyway).
 */
export const IOS_VISIT_THRESHOLD = 2

/**
 * Story 0.38a (AC4, AC6-AC9) — persisted (localStorage) dismiss/cooldown/
 * visit-count state for the PWA install prompt. Like Story 0.39's
 * viewer-location storage, every function degrades gracefully on
 * `localStorage` failure: a read failure is treated as "not dismissed / not
 * cooling down / zero visits"; a write failure is a silent no-op. This is the
 * raw `localStorage` state that EXPERIENCE.md's "per-device, not backend
 * `mySettings`" rule requires — never React Query/nuqs.
 */

export function isPermanentlyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function dismissPermanently(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, 'true')
  } catch {
    // Silent no-op on write failure.
  }
}

/** Returns the cooldown's expiry as a `Date`, or `null` if none active. */
export function getRemindCooldownExpiry(): Date | null {
  try {
    const raw = localStorage.getItem(REMIND_AT_KEY)
    if (!raw) return null
    const expiry = new Date(raw)
    if (Number.isNaN(expiry.getTime())) return null
    return expiry.getTime() > Date.now() ? expiry : null
  } catch {
    return null
  }
}

/** Stores an ISO-8601 expiry 14 days out (so reads never re-derive "now + 14d"). */
export function startRemindCooldown(): void {
  try {
    const expiry = new Date(Date.now() + REMIND_COOLDOWN_MS)
    localStorage.setItem(REMIND_AT_KEY, expiry.toISOString())
  } catch {
    // Silent no-op on write failure.
  }
}

export function getVisitCount(): number {
  try {
    const raw = localStorage.getItem(VISIT_COUNT_KEY)
    if (!raw) return 0
    const count = Number(raw)
    return Number.isFinite(count) && count >= 0 ? count : 0
  } catch {
    return 0
  }
}

/** Increments the visit counter and returns the new value. */
export function incrementAndGetVisitCount(): number {
  try {
    const next = getVisitCount() + 1
    localStorage.setItem(VISIT_COUNT_KEY, String(next))
    return next
  } catch {
    return getVisitCount()
  }
}
