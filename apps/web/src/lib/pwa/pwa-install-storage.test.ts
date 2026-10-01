import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  IOS_VISIT_THRESHOLD,
  isPermanentlyDismissed,
  dismissPermanently,
  getRemindCooldownExpiry,
  startRemindCooldown,
  getVisitCount,
  incrementAndGetVisitCount,
} from './pwa-install-storage'

describe('pwa-install-storage (Story 0.38a AC4, AC6-AC9)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('isPermanentlyDismissed / dismissPermanently (AC6)', () => {
    it('is false before dismissPermanently() is called', () => {
      expect(isPermanentlyDismissed()).toBe(false)
    })

    it('is true and survives repeated reads after dismissPermanently()', () => {
      dismissPermanently()
      expect(isPermanentlyDismissed()).toBe(true)
      expect(isPermanentlyDismissed()).toBe(true)
    })
  })

  describe('startRemindCooldown / getRemindCooldownExpiry (AC7)', () => {
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
      localStorage.setItem('festdaily_pwa_install_remind_at', past)
      expect(getRemindCooldownExpiry()).toBeNull()
    })

    it('returns null for a malformed stored value instead of throwing', () => {
      localStorage.setItem('festdaily_pwa_install_remind_at', 'not-a-date')
      expect(getRemindCooldownExpiry()).toBeNull()
    })
  })

  describe('visit count (AC4)', () => {
    it('starts at 0 before any visit is recorded', () => {
      expect(getVisitCount()).toBe(0)
    })

    it('incrementAndGetVisitCount increments and returns the new value', () => {
      expect(incrementAndGetVisitCount()).toBe(1)
      expect(incrementAndGetVisitCount()).toBe(2)
      expect(getVisitCount()).toBe(2)
    })

    it('returns 0 for a malformed stored value instead of throwing', () => {
      localStorage.setItem('festdaily_pwa_visit_count', 'nope')
      expect(getVisitCount()).toBe(0)
    })

    it('treats the exported threshold as 2 (rationale recorded in code comments)', () => {
      expect(IOS_VISIT_THRESHOLD).toBe(2)
    })
  })

  describe('independence (AC8 — calling one action never affects the other)', () => {
    it('dismissPermanently() does not start a cooldown', () => {
      dismissPermanently()
      expect(getRemindCooldownExpiry()).toBeNull()
    })

    it('startRemindCooldown() does not permanently dismiss', () => {
      startRemindCooldown()
      expect(isPermanentlyDismissed()).toBe(false)
    })
  })

  describe('degrade-on-throw (a throwing localStorage — AC9)', () => {
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

    it('getVisitCount() returns 0 (not throws) when localStorage.getItem throws', () => {
      expect(() => getVisitCount()).not.toThrow()
      expect(getVisitCount()).toBe(0)
    })

    it('incrementAndGetVisitCount() degrades (not throws) when localStorage.setItem throws', () => {
      expect(() => incrementAndGetVisitCount()).not.toThrow()
    })
  })
})
