import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCurrentLocationCapture, type GeolocationCaptureError } from "./use-current-location-capture"

describe("useCurrentLocationCapture", () => {
  const originalGeolocation = global.navigator?.geolocation

  beforeEach(() => {
    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: vi.fn(),
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalGeolocation) {
      vi.stubGlobal("navigator", { geolocation: originalGeolocation })
    }
  })

  it("should be unavailable if navigator.geolocation is undefined", () => {
    vi.stubGlobal("window", {
      navigator: {},
    })

    const { result } = renderHook(() => useCurrentLocationCapture())
    expect(result.current.isAvailable).toBe(false)
  })

  it("should be available if navigator.geolocation is defined", () => {
    const { result } = renderHook(() => useCurrentLocationCapture())
    expect(result.current.isAvailable).toBe(true)
  })

  it("should capture position successfully", async () => {
    const mockCoords = { latitude: -6.2088, longitude: 106.8456 }
    const mockGetCurrentPosition = vi.fn((success) =>
      success({
        coords: mockCoords,
      })
    )

    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: mockGetCurrentPosition,
        },
      },
    })

    const { result } = renderHook(() => useCurrentLocationCapture())
    expect(result.current.isAvailable).toBe(true)

    let captureResult
    await act(async () => {
      captureResult = await result.current.capture()
    })

    expect(captureResult).toEqual(mockCoords)
    expect(result.current.isCapturing).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("should handle permission-denied error", async () => {
    const mockGetCurrentPosition = vi.fn((success, error) =>
      error({
        code: 1, // PERMISSION_DENIED
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    )

    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: mockGetCurrentPosition,
        },
      },
    })

    const { result } = renderHook(() => useCurrentLocationCapture())

    await act(async () => {
      await expect(result.current.capture()).rejects.toThrow("permission-denied")
    })

    expect(result.current.error).toBe("permission-denied")
    expect(result.current.isCapturing).toBe(false)
  })

  it("should handle timeout error", async () => {
    const mockGetCurrentPosition = vi.fn((success, error) =>
      error({
        code: 3, // TIMEOUT
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    )

    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: mockGetCurrentPosition,
        },
      },
    })

    const { result } = renderHook(() => useCurrentLocationCapture())

    await act(async () => {
      await expect(result.current.capture()).rejects.toThrow("timeout")
    })

    expect(result.current.error).toBe("timeout")
    expect(result.current.isCapturing).toBe(false)
  })

  it("should handle unavailable error", async () => {
    const mockGetCurrentPosition = vi.fn((success, error) =>
      error({
        code: 2, // POSITION_UNAVAILABLE
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    )

    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: mockGetCurrentPosition,
        },
      },
    })

    const { result } = renderHook(() => useCurrentLocationCapture())

    await act(async () => {
      await expect(result.current.capture()).rejects.toThrow("unavailable")
    })

    expect(result.current.error).toBe("unavailable")
    expect(result.current.isCapturing).toBe(false)
  })
})
