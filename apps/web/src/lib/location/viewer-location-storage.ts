const DISMISSED_KEY = 'festdaily_viewer_location_dismissed'
const REMIND_AT_KEY = 'festdaily_viewer_location_remind_at'
const REMIND_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

/**
 * Story 0.39 (AC9) — persisted (localStorage) dismiss/cooldown state for the
 * viewer-location ambient ask, scoped ONLY to this ask's own eligibility.
 * Never reads, writes, or duplicates Story 0.42's separate, in-memory,
 * session-only `dismissedThisSession` flag — the two are structurally
 * distinct concerns.
 *
 * Every function degrades gracefully on `localStorage` failure: a read
 * failure is treated as "not dismissed / not cooling down"; a write failure
 * is a silent no-op. Mirrors this project's existing degrade-gracefully
 * convention.
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

/**
 * Returns the cooldown's expiry as a `Date`, or `null` if no cooldown is
 * currently active (never started, or already elapsed).
 */
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

export function startRemindCooldown(): void {
  try {
    const expiry = new Date(Date.now() + REMIND_COOLDOWN_MS)
    localStorage.setItem(REMIND_AT_KEY, expiry.toISOString())
  } catch {
    // Silent no-op on write failure.
  }
}
