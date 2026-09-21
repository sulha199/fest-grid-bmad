import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useCurrentLocationCapture, GeolocationCaptureFailure, isGeolocationCaptureFailure } from "./useCurrentLocationCapture";

describe("useCurrentLocationCapture", () => {
  const originalGeolocation = global.navigator?.geolocation;

  beforeEach(() => {
    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: vi.fn(),
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    if (originalGeolocation) {
      vi.stubGlobal("navigator", { geolocation: originalGeolocation });
    }
  });

  it("should be unavailable if navigator.geolocation is undefined", () => {
    vi.stubGlobal("window", {
      navigator: {},
    });

    const { result } = renderHook(() => useCurrentLocationCapture());
    expect(result.current.isAvailable).toBe(false);
  });

  it("should be available if navigator.geolocation is defined", () => {
    const { result } = renderHook(() => useCurrentLocationCapture());
    expect(result.current.isAvailable).toBe(true);
  });

  it("should capture position successfully", async () => {
    const mockCoords = { latitude: -6.2088, longitude: 106.8456 };
    const mockGetCurrentPosition = vi.fn((success) =>
      success({
        coords: mockCoords,
      })
    );

    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: mockGetCurrentPosition,
        },
      },
    });

    const { result } = renderHook(() => useCurrentLocationCapture());
    expect(result.current.isAvailable).toBe(true);

    let captureResult;
    await act(async () => {
      captureResult = await result.current.capture();
    });

    expect(captureResult).toEqual(mockCoords);
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle permission-denied error", async () => {
    const mockGetCurrentPosition = vi.fn((success, error) =>
      error({
        code: 1, // PERMISSION_DENIED
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    );

    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: mockGetCurrentPosition,
        },
      },
    });

    const { result } = renderHook(() => useCurrentLocationCapture());

    await act(async () => {
      await expect(result.current.capture()).rejects.toThrow("permission-denied");
    });

    expect(result.current.error).toBe("permission-denied");
    expect(result.current.isCapturing).toBe(false);
  });

  it("should handle timeout error", async () => {
    const mockGetCurrentPosition = vi.fn((success, error) =>
      error({
        code: 3, // TIMEOUT
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    );

    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: mockGetCurrentPosition,
        },
      },
    });

    const { result } = renderHook(() => useCurrentLocationCapture());

    await act(async () => {
      await expect(result.current.capture()).rejects.toThrow("timeout");
    });

    expect(result.current.error).toBe("timeout");
    expect(result.current.isCapturing).toBe(false);
  });

  it("should handle unavailable error", async () => {
    const mockGetCurrentPosition = vi.fn((success, error) =>
      error({
        code: 2, // POSITION_UNAVAILABLE
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    );

    vi.stubGlobal("window", {
      navigator: {
        geolocation: {
          getCurrentPosition: mockGetCurrentPosition,
        },
      },
    });

    const { result } = renderHook(() => useCurrentLocationCapture());

    await act(async () => {
      await expect(result.current.capture()).rejects.toThrow("unavailable");
    });

    expect(result.current.error).toBe("unavailable");
    expect(result.current.isCapturing).toBe(false);
  });

  // Story 1.i1f review finding 9 — the typed failure reason callers now read to
  // tag analytics outcomes (previously every failure collapsed into 'denied').
  describe("typed capture failures", () => {
    it("rejects with a GeolocationCaptureFailure carrying the permission-denied code", async () => {
      vi.stubGlobal("window", {
        navigator: {
          geolocation: {
            getCurrentPosition: vi.fn((_success, error) =>
              error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
            ),
          },
        },
      });

      const { result } = renderHook(() => useCurrentLocationCapture());

      let rejection: unknown;
      await act(async () => {
        rejection = await result.current.capture().catch((err) => err);
      });

      expect(rejection).toBeInstanceOf(GeolocationCaptureFailure);
      expect(isGeolocationCaptureFailure(rejection)).toBe(true);
      expect((rejection as GeolocationCaptureFailure).code).toBe("permission-denied");
      // The message stays the bare code, so any existing message-based caller
      // (`rejects.toThrow("permission-denied")`) keeps working.
      expect((rejection as GeolocationCaptureFailure).message).toBe("permission-denied");
    });

    it("does not classify an unrelated rejection as a capture failure", () => {
      expect(isGeolocationCaptureFailure(new Error("something else"))).toBe(false);
      expect(isGeolocationCaptureFailure(undefined)).toBe(false);
    });
  });
});
