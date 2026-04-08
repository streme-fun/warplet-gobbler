import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const wagmiState = vi.hoisted(() => ({
  isConnected: false,
  isPending: false,
  error: null as Error | null,
  connectors: [] as { id: string; name: string }[],
  connectAsync: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    isConnected: wagmiState.isConnected,
    address: wagmiState.isConnected ? ("0x0000000000000000000000000000000000000001" as const) : undefined,
  }),
  useConnect: () => ({
    connectAsync: wagmiState.connectAsync,
    connectors: wagmiState.connectors,
    isPending: wagmiState.isPending,
    error: wagmiState.error,
    reset: wagmiState.reset,
  }),
}));

import { useFarcasterMiniAppAutoConnect } from "./useFarcasterMiniAppAutoConnect";

const farcasterConnector = { id: "farcaster", name: "Farcaster" };

describe("useFarcasterMiniAppAutoConnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wagmiState.isConnected = false;
    wagmiState.isPending = false;
    wagmiState.error = null;
    wagmiState.connectors = [farcasterConnector];
    wagmiState.connectAsync.mockResolvedValue(undefined);
  });

  it("does nothing when disabled", async () => {
    renderHook(() => useFarcasterMiniAppAutoConnect(false));

    await act(async () => {
      await Promise.resolve();
    });

    expect(wagmiState.connectAsync).not.toHaveBeenCalled();
  });

  it("calls connectAsync with the farcaster connector when enabled and disconnected", async () => {
    renderHook(() => useFarcasterMiniAppAutoConnect(true));

    await waitFor(() => {
      expect(wagmiState.connectAsync).toHaveBeenCalledTimes(1);
    });

    expect(wagmiState.connectAsync).toHaveBeenCalledWith({
      connector: farcasterConnector,
    });
  });

  it("does not call connect when there is no farcaster connector", async () => {
    wagmiState.connectors = [{ id: "injected", name: "Injected" }];

    renderHook(() => useFarcasterMiniAppAutoConnect(true));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(wagmiState.connectAsync).not.toHaveBeenCalled();
  });

  it("does not call connect when already connected", async () => {
    wagmiState.isConnected = true;

    renderHook(() => useFarcasterMiniAppAutoConnect(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(wagmiState.connectAsync).not.toHaveBeenCalled();
  });

  it("sets autoFailed when connectAsync rejects", async () => {
    wagmiState.connectAsync.mockRejectedValue(new Error("user rejected"));

    const { result } = renderHook(() => useFarcasterMiniAppAutoConnect(true));

    await waitFor(() => {
      expect(result.current.autoFailed).toBe(true);
    });
  });

  it("retry resets wagmi state and clears autoFailed for another attempt", async () => {
    wagmiState.connectAsync.mockRejectedValueOnce(new Error("fail once"));
    wagmiState.connectAsync.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useFarcasterMiniAppAutoConnect(true));

    await waitFor(() => {
      expect(result.current.autoFailed).toBe(true);
    });

    act(() => {
      result.current.retry();
    });

    expect(wagmiState.reset).toHaveBeenCalled();
    expect(result.current.autoFailed).toBe(false);

    await waitFor(() => {
      expect(wagmiState.connectAsync).toHaveBeenCalledTimes(2);
    });
  });

  it("clears autoFailed when enabled goes false", async () => {
    wagmiState.connectAsync.mockRejectedValue(new Error("fail"));

    const { result, rerender } = renderHook(
      ({ enabled }) => useFarcasterMiniAppAutoConnect(enabled),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(result.current.autoFailed).toBe(true);
    });

    rerender({ enabled: false });

    expect(result.current.autoFailed).toBe(false);
  });
});
