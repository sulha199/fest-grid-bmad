import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  queryGeolocationPermissionStatus,
  subscribeToGeolocationPermissionChanges,
} from './query-geolocation-permission'

describe('queryGeolocationPermissionStatus (Story 0.39 AC2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(['granted', 'denied', 'prompt'] as const)('resolves %s from the Permissions API', async (state) => {
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn().mockResolvedValue({ state }) },
    })

    await expect(queryGeolocationPermissionStatus()).resolves.toBe(state)
  })

  it('degrades to unsupported when navigator.permissions is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    await expect(queryGeolocationPermissionStatus()).resolves.toBe('unsupported')
  })

  it('degrades to unsupported when navigator itself is unavailable', async () => {
    vi.stubGlobal('navigator', undefined)
    await expect(queryGeolocationPermissionStatus()).resolves.toBe('unsupported')
  })

  it('degrades to unsupported when .query() throws (e.g. older Safari rejecting the permission name)', async () => {
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn().mockRejectedValue(new Error('not supported')) },
    })
    await expect(queryGeolocationPermissionStatus()).resolves.toBe('unsupported')
  })
})

describe('subscribeToGeolocationPermissionChanges (Story 0.39 AC2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fires onChange with the updated status when the PermissionStatus change event dispatches', async () => {
    let changeHandler: (() => void) | undefined
    const permissionStatus = {
      state: 'prompt',
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === 'change') changeHandler = handler
      }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn().mockResolvedValue(permissionStatus) },
    })

    const onChange = vi.fn()
    await subscribeToGeolocationPermissionChanges(onChange)

    expect(permissionStatus.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    permissionStatus.state = 'granted'
    changeHandler?.()

    expect(onChange).toHaveBeenCalledWith('granted')
  })

  it('the returned unsubscribe function removes the change listener', async () => {
    const permissionStatus = {
      state: 'prompt',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn().mockResolvedValue(permissionStatus) },
    })

    const unsubscribe = await subscribeToGeolocationPermissionChanges(vi.fn())
    unsubscribe()

    expect(permissionStatus.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('is a no-op (resolves a no-op unsubscribe) when the Permissions API is unsupported', async () => {
    vi.stubGlobal('navigator', {})
    const unsubscribe = await subscribeToGeolocationPermissionChanges(vi.fn())
    expect(() => unsubscribe()).not.toThrow()
  })

  it('is a no-op when .query() throws', async () => {
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn().mockRejectedValue(new Error('nope')) },
    })
    const unsubscribe = await subscribeToGeolocationPermissionChanges(vi.fn())
    expect(() => unsubscribe()).not.toThrow()
  })
})
