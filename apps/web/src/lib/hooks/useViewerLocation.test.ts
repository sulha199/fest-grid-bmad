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

type TestPermissionState = 'granted' | 'denied' | 'prompt'

/**
 * Stubs `navigator.permissions` with a shared, mutable `PermissionStatus`-like
 * object, so a test can (a) drive a real `change` notification instead of only
 * the one-shot initial query result and (b) hold the initial query open to
 * assert the pre-resolution render state.
 */
function stubPermissionApi(state: TestPermissionState, options: { deferQuery?: boolean } = {}) {
  const listeners = new Set<() => void>()
  const status = {
    state,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener)
    },
  }
  const pending: Array<(value: typeof status) => void> = []
  const query = vi.fn(() =>
    options.deferQuery
      ? new Promise<typeof status>((resolve) => {
          pending.push(resolve)
        })
      : Promise.resolve(status)
  )

  vi.stubGlobal('navigator', { geolocation: {}, permissions: { query } })

  return {
    query,
    status,
    pending,
    notifyChange: (next: TestPermissionState) => {
      status.state = next
      listeners.forEach((listener) => listener())
    },
  }
}

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

  // Story 1.i1f review findings 1, 3, 4, 5, 6 — the post-review patch pass.
  describe('post-review patches (findings 1, 3, 4, 5, 6)', () => {
    it('clears the cached coordinate when the browser later reports permission denied (finding 1)', async () => {
      const permission = stubPermissionApi('granted')
      mockCapture.mockResolvedValue({ latitude: 4, longitude: 5 })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      await waitFor(() => expect(result.current.coordinate).toEqual({ latitude: 4, longitude: 5 }))

      await act(async () => {
        permission.notifyChange('denied')
      })

      await waitFor(() => expect(result.current.permissionStatus).toBe('denied'))
      expect(result.current.coordinate).toBeNull()
    })

    it('keeps the permission-change subscription alive after the first consumer unmounts (finding 3)', async () => {
      const permission = stubPermissionApi('prompt')
      mockCapture.mockResolvedValue({ latitude: 1, longitude: 1 })

      const useViewerLocation = await loadHook()
      const first = renderHook(() => useViewerLocation())
      await waitFor(() => expect(first.result.current.permissionStatus).toBe('prompt'))

      first.unmount()

      await act(async () => {
        permission.notifyChange('granted')
      })

      const second = renderHook(() => useViewerLocation())
      await waitFor(() => expect(second.result.current.permissionStatus).toBe('granted'))
    })

    it('shares one in-flight geolocation capture between concurrent ambient callers (finding 4)', async () => {
      stubPermissionApi('granted')
      const resolvers: Array<(value: { latitude: number; longitude: number }) => void> = []
      mockCapture.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)))

      const useViewerLocation = await loadHook()
      const first = renderHook(() => useViewerLocation())
      const second = renderHook(() => useViewerLocation())

      await waitFor(() => expect(first.result.current.permissionStatus).toBe('granted'))
      expect(second.result.current.permissionStatus).toBe('granted')
      // AC3's silent self-capture already started the one real getCurrentPosition.
      expect(mockCapture).toHaveBeenCalledTimes(1)

      const [firstCoord, secondCoord] = await act(async () => {
        const p1 = first.result.current.captureAmbient()
        const p2 = second.result.current.captureAmbient()
        resolvers.forEach((resolve) => resolve({ latitude: 7, longitude: 8 }))
        return Promise.all([p1, p2])
      })

      expect(mockCapture).toHaveBeenCalledTimes(1)
      expect(firstCoord).toEqual({ latitude: 7, longitude: 8 })
      expect(secondCoord).toEqual({ latitude: 7, longitude: 8 })
    })

    it('withholds ambient-ask eligibility until the permission status has actually resolved (finding 5)', async () => {
      const permission = stubPermissionApi('prompt', { deferQuery: true })

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())

      // SSR-equivalent first render: the browser's answer is still unknown, so
      // nothing may claim eligibility yet.
      expect(result.current.permissionStatus).toBe('prompt')
      expect(result.current.canShowAmbientAsk).toBe(false)

      await act(async () => {
        permission.pending.splice(0).forEach((resolve) => resolve(permission.status))
      })

      await waitFor(() => expect(result.current.canShowAmbientAsk).toBe(true))
    })

    it('dismissPermanently() re-renders the calling hook instance so eligibility updates immediately (finding 6)', async () => {
      stubPermissionApi('prompt')

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())
      await waitFor(() => expect(result.current.canShowAmbientAsk).toBe(true))

      act(() => {
        result.current.dismissPermanently()
      })

      // No Zustand update happens in between — this instance's own render must
      // reflect the persisted dismissal.
      expect(result.current.canShowAmbientAsk).toBe(false)
    })

    it('remindLater() re-renders the calling hook instance so eligibility updates immediately (finding 6)', async () => {
      stubPermissionApi('prompt')

      const useViewerLocation = await loadHook()
      const { result } = renderHook(() => useViewerLocation())
      await waitFor(() => expect(result.current.canShowAmbientAsk).toBe(true))

      act(() => {
        result.current.remindLater()
      })

      expect(result.current.canShowAmbientAsk).toBe(false)
    })
  })
})
