import { createPublicClient, getAddress, type Address } from "viem";
import { mainnet } from "viem/chains";
import { ethMainnetHttp } from "@/lib/eth-mainnet-http";
import { tryNeynarBidderProfile } from "@/lib/neynar-bidder-profile";
import { normalizeSuperfluidWhoisPayload } from "@/lib/superfluid-whois";

/**
 * Compact server-side identity for OG images and share pages. Same sources as
 * `/api/bidder-profile` but raced against a hard deadline — an OG render must
 * never hang on a slow upstream, a short address is an acceptable fallback.
 */

export type ShareIdentity = {
  displayName: string;
  avatarUrl: string | null;
};

const SUPERFLUID_WHOIS_RESOLVE = "https://whois.superfluid.finance/api/resolve";

const ethClient = createPublicClient({
  chain: mainnet,
  transport: ethMainnetHttp(),
});

export function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function tryWhois(checksum: Address): Promise<ShareIdentity | null> {
  try {
    const res = await fetch(`${SUPERFLUID_WHOIS_RESOLVE}/${checksum}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const n = normalizeSuperfluidWhoisPayload(await res.json());
    if (!n.displayName && !n.avatarUrl) return null;
    return {
      displayName: n.displayName ?? shortAddress(checksum),
      avatarUrl: n.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

async function tryEns(checksum: Address): Promise<ShareIdentity | null> {
  try {
    const ensName = await ethClient.getEnsName({ address: checksum });
    if (!ensName) return null;
    let avatarUrl: string | null = null;
    try {
      avatarUrl = await ethClient.getEnsAvatar({ name: ensName });
    } catch {
      /* avatar optional */
    }
    return { displayName: ensName, avatarUrl };
  } catch {
    return null;
  }
}

async function tryNeynar(checksum: Address): Promise<ShareIdentity | null> {
  try {
    const fc = await tryNeynarBidderProfile(checksum);
    if (!fc) return null;
    return { displayName: fc.displayName, avatarUrl: fc.avatarUrl };
  } catch {
    return null;
  }
}

/**
 * Farcaster first (this ships into Farcaster feeds), then Superfluid whois,
 * then ENS. The whole chain races a deadline; losers fall back to the short
 * address so callers always render something.
 */
export async function resolveShareIdentity(
  address: Address,
  opts: { timeoutMs?: number } = {},
): Promise<ShareIdentity> {
  const checksum = getAddress(address);
  const fallback: ShareIdentity = {
    displayName: shortAddress(checksum),
    avatarUrl: null,
  };

  const chain = (async () => {
    return (
      (await tryNeynar(checksum)) ??
      (await tryWhois(checksum)) ??
      (await tryEns(checksum)) ??
      fallback
    );
  })();

  const deadline = new Promise<ShareIdentity>((resolve) =>
    setTimeout(() => resolve(fallback), opts.timeoutMs ?? 3000),
  );

  return Promise.race([chain, deadline]);
}
