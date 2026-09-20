import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isPermanentlyDismissed,
  dismissPermanently,
  getRemindCooldownExpiry,
  startRemindCooldown,
} from './viewer-location-storage'

describe('viewer-location-storage (Story 0.39 AC9)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('isPermanentlyDismissed / dismissPermanently', () => {
    it('is false before dismissPermanently() is called', () => {
      expect(isPermanentlyDismissed()).toBe(false)
    })

    it('is true and survives a fresh read after dismissPermanently()', () => {
      dismissPermanently()
      expect(isPermanentlyDismissed()).toBe(true)
      expect(isPermanentlyDismissed()).toBe(true)
    })
  })

  describe('startRemindCooldown / getRemindCooldownExpiry', () => {
    it('returns null before startRemindCooldown() is called', () => {
      expect(getRemindCooldownExpiry()).toBeNull()
    })

    it('returns a future expiry ~14 days out after startRemindCooldown()', () => {
      const before = Date.now()
      startRemindCooldown()
      const expiry = getRemindCooldownExpiry()

      expect(expiry).not.toBeNull()
      const deltaMs = expiry!.getTime() - before
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000
      expect(Math.abs(deltaMs - fourteenDaysMs)).toBeLessThan(5000)
    })

    it('returns null once the stored expiry has elapsed', () => {
      const past = new Date(Date.now() - 1000).toISOString()
      localStorage.setItem('festdaily_viewer_location_remind_at', past)
      expect(getRemindCooldownExpiry()).toBeNull()
    })

    it('returns null for a malformed stored value instead of throwing', () => {
      localStorage.setItem('festdaily_viewer_location_remind_at', 'not-a-date')
      expect(getRemindCooldownExpiry()).toBeNull()
    })
  })

  describe('independence (AC9 — calling one never affects the other)', () => {
    it('dismissPermanently() does not start a cooldown', () => {
      dismissPermanently()
      expect(getRemindCooldownExpiry()).toBeNull()
    })

    it('startRemindCooldown() does not permanently dismiss', () => {
      startRemindCooldown()
      expect(isPermanentlyDismissed()).toBe(false)
    })
  })

  describe('degrade-on-throw (a throwing localStorage)', () => {
    let originalLocalStorage: Storage

    beforeEach(() => {
      originalLocalStorage = window.localStorage
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: vi.fn(() => {
            throw new Error('storage disabled')
          }),
          setItem: vi.fn(() => {
            throw new Error('storage disabled')
          }),
        },
      })
    })

    afterEach(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      })
    })

    it('isPermanentlyDismissed() returns false (not throws) when localStorage.getItem throws', () => {
      expect(() => isPermanentlyDismissed()).not.toThrow()
      expect(isPermanentlyDismissed()).toBe(false)
    })

    it('dismissPermanently() is a silent no-op when localStorage.setItem throws', () => {
      expect(() => dismissPermanently()).not.toThrow()
    })

    it('getRemindCooldownExpiry() returns null (not throws) when localStorage.getItem throws', () => {
      expect(() => getRemindCooldownExpiry()).not.toThrow()
      expect(getRemindCooldownExpiry()).toBeNull()
    })

    it('startRemindCooldown() is a silent no-op when localStorage.setItem throws', () => {
      expect(() => startRemindCooldown()).not.toThrow()
    })
  })
})
