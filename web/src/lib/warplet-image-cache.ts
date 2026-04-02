import { unstable_cache } from "next/cache";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { CONTRACTS, ZERO_ADDRESS } from "@/lib/contracts";
import { warpletImageFetchCandidates } from "@/lib/warplet-metadata";

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

  const urls = warpletImageFetchCandidates(tokenUri);
  if (urls.length === 0) {
    throw new Error("no image in tokenURI");
  }

  const arrayBuffer = await fetchImageFirstOk(urls);
  const contentType = sniffImageContentType(arrayBuffer);

  return {
    base64: Buffer.from(arrayBuffer).toString("base64"),
    contentType,
  };
}

const FETCH_MS = 35_000;
const BETWEEN_ROUNDS_MS = 600;

function sniffImageContentType(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf.slice(0, 12));
  if (u8.length >= 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e) {
    return "image/png";
  }
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) {
    return "image/jpeg";
  }
  if (u8.length >= 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46) {
    return "image/webp";
  }
  return "image/png";
}

/** Try several gateways + two rounds — avoids ipfs.io throttling when many Warplets load at once. */
async function fetchImageFirstOk(urls: string[]): Promise<ArrayBuffer> {
  let lastErr: Error = new Error("no image url");
  for (let round = 0; round < 2; round++) {
    if (round > 0) {
      await new Promise((r) => setTimeout(r, BETWEEN_ROUNDS_MS * round));
    }
    for (const url of urls) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), FETCH_MS);
      try {
        const imgRes = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "image/*,*/*;q=0.8",
            "User-Agent": "WarpletGobbler/1.0",
          },
        });
        if (!imgRes.ok) {
          lastErr = new Error(`image fetch ${imgRes.status} ${url.slice(0, 48)}`);
          continue;
        }
        const buf = await imgRes.arrayBuffer();
        if (buf.byteLength < 64) {
          lastErr = new Error("image too small");
          continue;
        }
        return buf;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      } finally {
        clearTimeout(t);
      }
    }
  }
  throw lastErr;
}

/**
 * One resolver per `fid` — immutable metadata + art; `revalidate: false` keeps disk/memory entry until deploy bust.
 */
export const getCachedWarpletImage = unstable_cache(
  async (fid: number) => loadWarpletImageFromChain(fid),
  ["warplet-image-v1"],
  { revalidate: false },
);
