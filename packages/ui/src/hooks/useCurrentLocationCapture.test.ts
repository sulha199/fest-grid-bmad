import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useCurrentLocationCapture } from "./useCurrentLocationCapture";

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

  describe("captureIfPermissionGranted", () => {
    it("resolves a coordinate when the Permissions API reports 'granted', without a fresh prompt", async () => {
      const mockCoords = { latitude: -6.2088, longitude: 106.8456 };
      const mockGetCurrentPosition = vi.fn((success) => success({ coords: mockCoords }));
      const mockQuery = vi.fn().mockResolvedValue({ state: "granted" });

      vi.stubGlobal("window", {
        navigator: {
          geolocation: { getCurrentPosition: mockGetCurrentPosition },
          permissions: { query: mockQuery },
        },
      });

      const { result } = renderHook(() => useCurrentLocationCapture());

      let captureResult;
      await act(async () => {
        captureResult = await result.current.captureIfPermissionGranted();
      });

      expect(mockQuery).toHaveBeenCalledWith({ name: "geolocation" });
      expect(mockGetCurrentPosition).toHaveBeenCalled();
      expect(captureResult).toEqual(mockCoords);
    });

    it("resolves undefined without calling getCurrentPosition when permission is 'prompt'", async () => {
      const mockGetCurrentPosition = vi.fn();
      const mockQuery = vi.fn().mockResolvedValue({ state: "prompt" });

      vi.stubGlobal("window", {
        navigator: {
          geolocation: { getCurrentPosition: mockGetCurrentPosition },
          permissions: { query: mockQuery },
        },
      });

      const { result } = renderHook(() => useCurrentLocationCapture());

      let captureResult;
      await act(async () => {
        captureResult = await result.current.captureIfPermissionGranted();
      });

      expect(captureResult).toBeUndefined();
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    });

    it("resolves undefined without calling getCurrentPosition when permission is 'denied'", async () => {
      const mockGetCurrentPosition = vi.fn();
      const mockQuery = vi.fn().mockResolvedValue({ state: "denied" });

      vi.stubGlobal("window", {
        navigator: {
          geolocation: { getCurrentPosition: mockGetCurrentPosition },
          permissions: { query: mockQuery },
        },
      });

      const { result } = renderHook(() => useCurrentLocationCapture());

      let captureResult;
      await act(async () => {
        captureResult = await result.current.captureIfPermissionGranted();
      });

      expect(captureResult).toBeUndefined();
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    });

    it("resolves undefined when the Permissions API is unsupported", async () => {
      vi.stubGlobal("window", {
        navigator: {
          geolocation: { getCurrentPosition: vi.fn() },
          // no `permissions` property at all
        },
      });

      const { result } = renderHook(() => useCurrentLocationCapture());

      let captureResult;
      await act(async () => {
        captureResult = await result.current.captureIfPermissionGranted();
      });

      expect(captureResult).toBeUndefined();
    });

    it("resolves undefined when navigator.geolocation is unavailable", async () => {
      vi.stubGlobal("window", { navigator: {} });

      const { result } = renderHook(() => useCurrentLocationCapture());

      let captureResult;
      await act(async () => {
        captureResult = await result.current.captureIfPermissionGranted();
      });

      expect(captureResult).toBeUndefined();
    });

    it("resolves undefined when permissions.query rejects", async () => {
      const mockGetCurrentPosition = vi.fn();
      const mockQuery = vi.fn().mockRejectedValue(new Error("not supported"));

      vi.stubGlobal("window", {
        navigator: {
          geolocation: { getCurrentPosition: mockGetCurrentPosition },
          permissions: { query: mockQuery },
        },
      });

      const { result } = renderHook(() => useCurrentLocationCapture());

      let captureResult;
      await act(async () => {
        captureResult = await result.current.captureIfPermissionGranted();
      });

      expect(captureResult).toBeUndefined();
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    });

    it("resolves undefined when granted but the underlying capture fails", async () => {
      const mockGetCurrentPosition = vi.fn((_success, error) =>
        error({ code: 2, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
      );
      const mockQuery = vi.fn().mockResolvedValue({ state: "granted" });

      vi.stubGlobal("window", {
        navigator: {
          geolocation: { getCurrentPosition: mockGetCurrentPosition },
          permissions: { query: mockQuery },
        },
      });

      const { result } = renderHook(() => useCurrentLocationCapture());

      let captureResult;
      await act(async () => {
        captureResult = await result.current.captureIfPermissionGranted();
      });

      expect(captureResult).toBeUndefined();
    });
  });
});
