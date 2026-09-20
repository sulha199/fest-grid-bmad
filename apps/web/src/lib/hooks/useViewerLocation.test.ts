import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// The hook uses a module-level guard (`permissionQueryStarted`) so the
// permission query only ever runs once per module instance — reset modules
// AND re-mock `@festgrid/ui` fresh before every test so each test gets an
// independent guard/store instance.
async function loadHook() {
  vi.resetModules()
  vi.doMock('@festgrid/ui', () => ({
    useCurrentLocationCapture: () => ({
      isAvailable: true,
      isCapturing: false,
      capture: mockCapture,
    }),
  }))
  const mod = await import('./useViewerLocation')
  return mod.useViewerLocation
}

const mockCapture = vi.fn()

describe('useViewerLocation (Story 0.39 AC2-AC5, AC9, AC10)', () => {
  beforeEach(() => {
    localStorage.clear()
    mockCapture.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(['granted', 'denied', 'prompt'] as const)(
    'reflects %s permission status after the async query resolves',
    async (state) => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state, addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      await waitFor(() => {
        expect(result.current.permissionStatus).toBe(state)
      })
    }
  )

  it('degrades to unsupported when the Permissions API is unavailable', async () => {
    vi.stubGlobal('navigator', { geolocation: {} })

    const useViewerLocation = await loadHook()
    const { result } = renderHook(() => useViewerLocation())

    await waitFor(() => {
      expect(result.current.permissionStatus).toBe('unsupported')
    })
  })

  describe('captureAmbient vs captureExplicit (AC10)', () => {
    it('captureExplicit always calls the real capture, even with a cached coordinate', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state: 'granted', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })
      mockCapture.mockResolvedValue({ latitude: 1, longitude: 2 })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      await act(async () => {
        await result.current.captureExplicit()
      })
      expect(mockCapture).toHaveBeenCalledTimes(1)
      expect(result.current.coordinate).toEqual({ latitude: 1, longitude: 2 })

      mockCapture.mockResolvedValue({ latitude: 9, longitude: 9 })
      await act(async () => {
        await result.current.captureExplicit()
      })
      // A second explicit call forces a fresh read again — never returns the cache.
      expect(mockCapture).toHaveBeenCalledTimes(2)
      expect(result.current.coordinate).toEqual({ latitude: 9, longitude: 9 });
    });

    it('captureAmbient returns the cached coordinate without calling capture again once one exists', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state: 'granted', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })
      mockCapture.mockResolvedValue({ latitude: 1, longitude: 2 })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      await act(async () => {
        await result.current.captureExplicit()
      })
      expect(mockCapture).toHaveBeenCalledTimes(1)

      const ambientResult = await act(async () => result.current.captureAmbient())
      expect(mockCapture).toHaveBeenCalledTimes(1)
      expect(ambientResult).toEqual({ latitude: 1, longitude: 2 });
    });

    it('captureAmbient never calls capture when permission is not granted', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      await waitFor(() => expect(result.current.permissionStatus).toBe('prompt'))

      const ambientResult = await act(async () => result.current.captureAmbient())
      expect(mockCapture).not.toHaveBeenCalled()
      expect(ambientResult).toBeUndefined();
    });

    it('AC3 — silently self-captures once permission is already granted and nothing is cached yet', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state: 'granted', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })
      mockCapture.mockResolvedValue({ latitude: 5, longitude: 6 })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      await waitFor(() => {
        expect(result.current.coordinate).toEqual({ latitude: 5, longitude: 6 })
      })
      expect(mockCapture).toHaveBeenCalledTimes(1)
    })
  })

  describe('canShowAmbientAsk / dismiss / cooldown (AC5, AC9)', () => {
    it('is true when permission is prompt and nothing is dismissed/cooling down', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      await waitFor(() => expect(result.current.permissionStatus).toBe('prompt'))
      expect(result.current.canShowAmbientAsk).toBe(true)
    })

    it('is false once permission is granted', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state: 'granted', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })
      mockCapture.mockResolvedValue({ latitude: 1, longitude: 1 })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      await waitFor(() => expect(result.current.permissionStatus).toBe('granted'))
      expect(result.current.canShowAmbientAsk).toBe(false)
    })

    it('is false once permission is denied', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state: 'denied', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      await waitFor(() => expect(result.current.permissionStatus).toBe('denied'))
      expect(result.current.canShowAmbientAsk).toBe(false)
    })

    it('dismissPermanently() persists and canShowAmbientAsk becomes false for a fresh hook instance', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())
      await waitFor(() => expect(result.current.permissionStatus).toBe('prompt'))

      act(() => {
        result.current.dismissPermanently()
      })

      const useViewerLocationAgain = await loadHook()
      const { result: result2 } = renderHook(() => useViewerLocationAgain())
      await waitFor(() => expect(result2.current.permissionStatus).toBe('prompt'))
      expect(result2.current.canShowAmbientAsk).toBe(false)
    })

    it('remindLater() starts a cooldown and canShowAmbientAsk becomes false for a fresh hook instance', async () => {
      vi.stubGlobal('navigator', {
        geolocation: {},
        permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt', addEventListener: vi.fn(), removeEventListener: vi.fn() }) },
      })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())
      await waitFor(() => expect(result.current.permissionStatus).toBe('prompt'))

      act(() => {
        result.current.remindLater()
      })

      const useViewerLocationAgain = await loadHook()
      const { result: result2 } = renderHook(() => useViewerLocationAgain())
      await waitFor(() => expect(result2.current.permissionStatus).toBe('prompt'))
      expect(result2.current.canShowAmbientAsk).toBe(false)
    })
  })
})
