import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const farcasterSdk = vi.hoisted(() => {
  const ctx = {
    user: { fid: 999, displayName: "Test User" },
  };
  return {
    isInMiniApp: vi.fn(),
    contextPromise: Promise.resolve(ctx) as Promise<typeof ctx>,
    ready: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    openUrl: vi.fn(),
  };
});

vi.mock("@farcaster/miniapp-sdk", () => ({
  sdk: {
    isInMiniApp: () => farcasterSdk.isInMiniApp(),
    get context() {
      return farcasterSdk.contextPromise;
    },
    actions: {
      ready: () => farcasterSdk.ready(),
      close: farcasterSdk.close,
      openUrl: farcasterSdk.openUrl,
    },
  },
}));

import { useMiniApp } from "./useMiniApp";

describe("useMiniApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    farcasterSdk.isInMiniApp.mockReset();
    farcasterSdk.ready.mockReset();
    farcasterSdk.ready.mockResolvedValue(undefined);
    farcasterSdk.contextPromise = Promise.resolve({
      user: { fid: 999, displayName: "Test User" },
    });
  });

  it("marks loaded and not mini app when host says we are outside a mini app", async () => {
    farcasterSdk.isInMiniApp.mockResolvedValue(false);

    const { result } = renderHook(() => useMiniApp());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.isMiniApp).toBe(false);
    expect(result.current.context).toBeNull();
    expect(farcasterSdk.ready).not.toHaveBeenCalled();
  });

  it("loads context, calls ready once, then marks loaded inside a mini app", async () => {
    farcasterSdk.isInMiniApp.mockResolvedValue(true);

    const { result } = renderHook(() => useMiniApp());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.isMiniApp).toBe(true);
    expect(result.current.context).toEqual({
      user: { fid: 999, displayName: "Test User" },
    });
    expect(farcasterSdk.ready).toHaveBeenCalledTimes(1);
  });

  it("still marks loaded if initialization throws", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    farcasterSdk.isInMiniApp.mockRejectedValue(new Error("sdk boom"));

    const { result } = renderHook(() => useMiniApp());

    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.isMiniApp).toBe(false);
    expect(farcasterSdk.ready).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("close and openUrl forward to the SDK", () => {
    farcasterSdk.isInMiniApp.mockResolvedValue(false);

    const { result } = renderHook(() => useMiniApp());

    result.current.close();
    result.current.openUrl("https://example.com");

    expect(farcasterSdk.close).toHaveBeenCalledTimes(1);
    expect(farcasterSdk.openUrl).toHaveBeenCalledWith("https://example.com");
  });
});
