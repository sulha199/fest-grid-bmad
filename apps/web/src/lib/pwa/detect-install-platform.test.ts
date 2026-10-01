import { describe, it, expect, afterEach, vi } from 'vitest'
import { detectInstallPlatform } from './detect-install-platform'

interface StubEnvOptions {
  ua: string
  maxTouchPoints?: number
  standalone?: boolean
  displayMode?: 'standalone' | 'browser'
}

/** Stubs the browser globals `detectInstallPlatform` reads from. */
function stubEnv(opts: StubEnvOptions): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' && opts.displayMode === 'standalone',
      media: query,
    })),
  })
  vi.stubGlobal('navigator', {
    userAgent: opts.ua,
    maxTouchPoints: opts.maxTouchPoints ?? 0,
    standalone: opts.standalone ?? false,
  })
}

const IOS_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const IPADOS_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const DESKTOP_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const ANDROID_CHROME_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('detectInstallPlatform (Story 0.38a AC3 — platform matrix)', () => {
  it('returns ios for an iOS Safari UA that is not already standalone', () => {
    stubEnv({ ua: IOS_SAFARI_UA })
    expect(detectInstallPlatform(false)).toBe('ios')
  })

  it('returns unsupported for an iOS Safari UA that is already standalone (navigator.standalone)', () => {
    stubEnv({ ua: IOS_SAFARI_UA, standalone: true })
    expect(detectInstallPlatform(false)).toBe('unsupported')
  })

  it('returns unsupported for an iOS Safari UA running in display-mode: standalone', () => {
    stubEnv({ ua: IOS_SAFARI_UA, displayMode: 'standalone' })
    expect(detectInstallPlatform(false)).toBe('unsupported')
  })

  it('returns ios for iPadOS desktop-mode UA with >1 touch points (and not standalone)', () => {
    stubEnv({ ua: IPADOS_DESKTOP_UA, maxTouchPoints: 5 })
    expect(detectInstallPlatform(false)).toBe('ios')
  })

  it('returns android for a desktop Chrome UA once a real beforeinstallprompt event was captured', () => {
    stubEnv({ ua: DESKTOP_CHROME_UA })
    expect(detectInstallPlatform(true)).toBe('android')
  })

  it('returns unsupported for a desktop Chrome UA with no captured event', () => {
    stubEnv({ ua: DESKTOP_CHROME_UA })
    expect(detectInstallPlatform(false)).toBe('unsupported')
  })

  it('returns unsupported for an Android Chrome UA with no captured event yet (not android until the event fires)', () => {
    stubEnv({ ua: ANDROID_CHROME_UA })
    expect(detectInstallPlatform(false)).toBe('unsupported')
  })
})
