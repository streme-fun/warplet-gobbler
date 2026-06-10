import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  isAddressEqual,
  isHex,
  type Address,
  type Hex,
  zeroAddress,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { baseHttp } from "@/lib/base-http";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";
import { uploadToPinata } from "@/app/utils/pinata";
import { CONTRACTS } from "@/lib/contracts";
import { gobbledWarpletsAbi } from "@/abi/gobbledWarplets";
import {
  parseOptionalGobbledTokenId,
  resolveReceiptTokenId,
} from "@/lib/gobbled-token-id";
import { mintErrorForClient } from "@/lib/mint-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Produces the full payload a winner needs to call `GobbledWarplets.rescueWarplet`:
 *  1. Generate (or reuse cached) gobbled image via `ensureGobbledImage`
 *  2. Fetch the raw PNG bytes from the Vercel Blob URL
 *  3. Upload the raw PNG to Pinata → image URL
 *  4. Build ERC-721 metadata JSON, upload that to Pinata → `tokenURI`
 *  5. Use the reserved receipt id from `AuctionSettled.gobbledTokenId` when provided;
 *     fall back to the latest receipt id encoding (`gobbleCount` × `WARPLET_ID_PADDING`)
 *  6. Sign EIP-712 `Mint(uint256 tokenId,string uri,uint256 deadline)` with the
 *     `tokenURISetter` private key
 *  7. Return `{ tokenId, warpletId, uri, deadline, signature }`
 *
 * The frontend can then call
 *   `gobbledWarplets.rescueWarplet(tokenId, uri, deadline, signature)`
 * directly with the response.
 */

const SIGNATURE_TTL_SECONDS = 60 * 30; // 30 minutes — well over a typical wallet flow

const publicClient = createPublicClient({ chain: base, transport: baseHttp() });

const auctionSellGobbledWarpletsAbi = [
  {
    type: "function",
    name: "gobbledWarplets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

function getSignerAccount() {
  const raw = process.env.GOBBLED_TOKEN_URI_SETTER_PRIVATE_KEY;
  if (!raw) {
    throw new Error("GOBBLED_TOKEN_URI_SETTER_PRIVATE_KEY not configured");
  }
  const normalized = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!isHex(normalized) || normalized.length !== 66) {
    throw new Error("GOBBLED_TOKEN_URI_SETTER_PRIVATE_KEY is malformed");
  }
  return privateKeyToAccount(normalized);
}

/** Cached EIP-712 domain — name comes from the contract (`OZ.EIP712(name_, "1")`). */
let cachedDomainName: string | null = null;
async function getDomainName(contract: Address): Promise<string> {
  if (cachedDomainName) return cachedDomainName;
  const name = await publicClient.readContract({
    address: contract,
    abi: gobbledWarpletsAbi,
    functionName: "name",
  });
  cachedDomainName = name;
  return name;
}

async function readReceiptTokenId(
  contract: Address,
  warpletId: bigint,
  requestedGobbledTokenId?: bigint,
): Promise<{ receiptTokenId: bigint; padding: bigint }> {
  const [padding, gobbleCount] = await Promise.all([
    publicClient.readContract({
      address: contract,
      abi: gobbledWarpletsAbi,
      functionName: "WARPLET_ID_PADDING",
    }),
    publicClient.readContract({
      address: contract,
      abi: gobbledWarpletsAbi,
      functionName: "gobbleCount",
      args: [warpletId],
    }),
  ]);

  const receiptTokenId = resolveReceiptTokenId({
    warpletId,
    padding,
    gobbleCount,
    requestedGobbledTokenId,
  });
  return { receiptTokenId, padding };
}

async function resolveGobbledWarpletsContract(): Promise<Address> {
  if (!isAddressEqual(CONTRACTS.gobbledWarplets, zeroAddress)) {
    return CONTRACTS.gobbledWarplets;
  }
  if (isAddressEqual(CONTRACTS.auctionSell, zeroAddress)) {
    return zeroAddress;
  }
  return publicClient.readContract({
    address: CONTRACTS.auctionSell,
    abi: auctionSellGobbledWarpletsAbi,
    functionName: "gobbledWarplets",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Accept either field name for back-compat with the old image-only response.
    const rawId = body.warpletId ?? body.tokenId;
    const warpletIdNum = Number(rawId);
    if (!Number.isInteger(warpletIdNum) || warpletIdNum < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid warpletId" },
        { status: 400 },
      );
    }

    const gobbledContract = await resolveGobbledWarpletsContract();
    if (isAddressEqual(gobbledContract, zeroAddress)) {
      return NextResponse.json(
        { success: false, error: "Claiming isn’t available right now." },
        { status: 500 },
      );
    }

    const warpletId = BigInt(warpletIdNum);
    const requestedGobbledTokenId = parseOptionalGobbledTokenId(
      body.gobbledTokenId,
    );

    // 1. Generate (or reuse) the gobbled image (Vercel Blob URL).
    const { url: gobbledUrl } = await ensureGobbledImage(warpletIdNum);

    // 2. Fetch the raw PNG bytes from the blob — no compositing, no frame, no label.
    const gobbledRes = await fetch(gobbledUrl);
    if (!gobbledRes.ok) {
      throw new Error(
        `Could not fetch gobbled blob (${gobbledRes.status}): ${gobbledUrl}`,
      );
    }
    const imageArrayBuffer = await gobbledRes.arrayBuffer();

    // 3. Upload the raw gobbled image to Pinata.
    const imageFile = new File(
      [imageArrayBuffer],
      `gobbled-warplet-${warpletIdNum}.png`,
      { type: "image/png" },
    );
    const imageUrl = await uploadToPinata(imageFile);

    // 4. Read receipt id from chain so the metadata + signature line up with what the contract expects.
    const { receiptTokenId, padding } = await readReceiptTokenId(
      gobbledContract,
      warpletId,
      requestedGobbledTokenId,
    );
    const gobbleIndex = receiptTokenId / padding;

    // 5. Build & upload ERC-721 metadata JSON.
    const metadata = {
      name: `Gobbled Warplet #${warpletIdNum}`,
      description:
        "A Warplet that strayed too close to the Gobbler. Once a creature, now a husk.",
      image: imageUrl,
      attributes: [
        { trait_type: "Warplet ID", value: warpletIdNum },
        { trait_type: "Gobble Index", value: Number(gobbleIndex) },
        { trait_type: "Gobbled Token ID", value: receiptTokenId.toString() },
      ],
    };
    const metadataFile = new File(
      [JSON.stringify(metadata)],
      `gobbled-warplet-${warpletIdNum}-metadata.json`,
      { type: "application/json" },
    );
    const tokenUri = await uploadToPinata(metadataFile);

    // 6. Sign EIP-712 `Mint(tokenId, uri, deadline)` with the tokenURISetter key.
    const account = getSignerAccount();
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + SIGNATURE_TTL_SECONDS,
    );
    const domainName = await getDomainName(gobbledContract);

    const signature = await account.signTypedData({
      domain: {
        name: domainName,
        version: "1",
        chainId: base.id,
        verifyingContract: gobbledContract,
      },
      types: {
        Mint: [
          { name: "tokenId", type: "uint256" },
          { name: "uri", type: "string" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Mint",
      message: {
        tokenId: receiptTokenId,
        uri: tokenUri,
        deadline,
      },
    });

    return NextResponse.json({
      success: true,
      warpletId: warpletIdNum,
      tokenId: receiptTokenId.toString(),
      uri: tokenUri,
      deadline: deadline.toString(),
      signature,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mint-gobbled-nft] failed:", err);
    const error = mintErrorForClient(message);
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 500 },
    );
  }
}
