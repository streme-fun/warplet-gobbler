import type { Address } from "viem";

const key = (addr: string) =>
  `warpletgobbler:ownedWarplets:${addr.toLowerCase()}`;

export type OwnedWarpletsCachePayload = {
  v: 1;
  balance: string;
  tokenIds: string[];
  updatedAt: number;
};

export function readOwnedWarpletsCache(
  address: Address | undefined,
): OwnedWarpletsCachePayload | null {
  if (!address || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(address));
    if (!raw) return null;
    const p = JSON.parse(raw) as OwnedWarpletsCachePayload;
    if (p.v !== 1 || !Array.isArray(p.tokenIds)) return null;
    return p;
  } catch {
    return null;
  }
}

export function writeOwnedWarpletsCache(
  address: Address,
  balance: bigint,
  tokenIds: bigint[],
) {
  if (typeof window === "undefined") return;
  try {
    const payload: OwnedWarpletsCachePayload = {
      v: 1,
      balance: balance.toString(),
      tokenIds: tokenIds.map((t) => t.toString()),
      updatedAt: Date.now(),
    };
    localStorage.setItem(key(address), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearOwnedWarpletsCache(address: Address) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(address));
  } catch {
    /* empty */
  }
}
