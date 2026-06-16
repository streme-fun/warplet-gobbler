import { describe, expect, it, vi } from "vitest";
import { createWalletConnectStorage } from "./walletconnect-storage";

describe("createWalletConnectStorage", () => {
  it("falls back to memory when browser storage is unavailable", async () => {
    const originalWindow = globalThis.window;
    vi.stubGlobal("window", undefined);

    try {
      const storage = createWalletConnectStorage();
      await storage.setItem("session", { topic: "abc" });

      await expect(storage.getKeys()).resolves.toEqual(["session"]);
      await expect(storage.getItem("session")).resolves.toEqual({
        topic: "abc",
      });
      await expect(storage.getEntries()).resolves.toEqual([
        ["session", { topic: "abc" }],
      ]);

      await storage.removeItem("session");
      await expect(storage.getKeys()).resolves.toEqual([]);
    } finally {
      vi.unstubAllGlobals();
      if (originalWindow !== undefined) vi.stubGlobal("window", originalWindow);
    }
  });
});
