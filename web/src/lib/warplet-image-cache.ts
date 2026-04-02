import { unstable_cache } from "next/cache";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import { imageUrlFromTokenUri } from "@/lib/warplet-metadata";

const warpletTokenUriAbi = [
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
] as const;

export type CachedWarpletImage = {
  base64: string;
  contentType: string;
};

function warpletPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ||
        "https://mainnet.base.org",
    ),
  });
}

async function loadWarpletImageFromChain(fid: number): Promise<CachedWarpletImage> {
  const warplets = CONTRACTS.warplets;
  if (warplets.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    throw new Error("warplets not configured");
  }

  const client = warpletPublicClient();
  const tokenUri = await client.readContract({
    address: warplets,
    abi: warpletTokenUriAbi,
    functionName: "tokenURI",
    args: [BigInt(fid)],
  });

  const imageUrl = imageUrlFromTokenUri(tokenUri);
  if (!imageUrl) {
    throw new Error("no image in tokenURI");
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30_000);
  let imgRes: Response;
  try {
    imgRes = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "WarpletGobbler/1.0" },
    });
  } finally {
    clearTimeout(t);
  }

  if (!imgRes.ok) {
    throw new Error(`image fetch ${imgRes.status}`);
  }

  const arrayBuffer = await imgRes.arrayBuffer();
  const contentType =
    imgRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";

  return {
    base64: Buffer.from(arrayBuffer).toString("base64"),
    contentType,
  };
}

/**
 * One resolver per `fid` — immutable metadata + art; `revalidate: false` keeps disk/memory entry until deploy bust.
 */
export const getCachedWarpletImage = unstable_cache(
  async (fid: number) => loadWarpletImageFromChain(fid),
  ["warplet-image-v1"],
  { revalidate: false },
);
