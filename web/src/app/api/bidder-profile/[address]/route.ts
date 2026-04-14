import { NextResponse } from "next/server";
import { createPublicClient, getAddress, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { ethMainnetHttp } from "@/lib/eth-mainnet-http";
import { tryNeynarBidderProfile } from "@/lib/neynar-bidder-profile";
import { normalizeSuperfluidWhoisPayload } from "@/lib/superfluid-whois";

export const runtime = "nodejs";

const SUPERFLUID_WHOIS_RESOLVE =
  "https://whois.superfluid.finance/api/resolve";

const ethClient = createPublicClient({
  chain: mainnet,
  transport: ethMainnetHttp(),
});

export async function GET(
  _request: Request,
  { params }: { params: { address: string } },
) {
  const raw = params.address;
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const checksum = getAddress(raw);

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let source: "whois" | "ens" | "farcaster" | "mixed" | "address" =
    "address";

  try {
    const whoisRes = await fetch(`${SUPERFLUID_WHOIS_RESOLVE}/${checksum}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (whoisRes.ok) {
      const json: unknown = await whoisRes.json();
      const n = normalizeSuperfluidWhoisPayload(json);
      if (n.displayName) displayName = n.displayName;
      if (n.avatarUrl) avatarUrl = n.avatarUrl;
      if (n.displayName || n.avatarUrl) source = "whois";
    }
  } catch {
    /* whois optional */
  }

  try {
    const ensName = await ethClient.getEnsName({ address: checksum });
    if (ensName) {
      if (!displayName) {
        displayName = ensName;
        if (source === "whois") source = "mixed";
        else source = "ens";
      }
      if (!avatarUrl) {
        const av = await ethClient.getEnsAvatar({ name: ensName });
        if (av) {
          avatarUrl = av;
          if (source === "ens") source = "mixed";
        }
      }
    }
  } catch {
    /* ENS optional */
  }

  try {
    const fc = await tryNeynarBidderProfile(checksum);
    if (fc) {
      const hadName = Boolean(displayName);
      const hadAvatar = Boolean(avatarUrl);
      if (!displayName) displayName = fc.displayName;
      if (!avatarUrl && fc.avatarUrl) avatarUrl = fc.avatarUrl;
      const usedFc =
        (!hadName && Boolean(fc.displayName)) ||
        (!hadAvatar && Boolean(fc.avatarUrl));
      if (usedFc) {
        if (source === "address") source = "farcaster";
        else source = "mixed";
      }
    }
  } catch {
    /* Neynar optional — set NEYNAR_API_KEY for Farcaster resolution */
  }

  return NextResponse.json(
    {
      address: checksum,
      displayName,
      avatarUrl,
      source,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
