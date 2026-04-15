import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, isHex, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { baseHttp } from "@/lib/base-http";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";
import { uploadToPinata } from "@/app/utils/pinata";
import { CONTRACTS } from "@/lib/contracts";
import { gobbledWarpletsAbi } from "@/abi/gobbledWarplets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Produces the full payload a winner needs to call `GobbledWarplets.rescueWarplet`:
 *  1. Generate (or reuse cached) gobbled image via `ensureGobbledImage`
 *  2. Fetch the raw PNG bytes from the Vercel Blob URL
 *  3. Upload the raw PNG to Pinata → image URL
 *  4. Build ERC-721 metadata JSON, upload that to Pinata → `tokenURI`
 *  5. Read the receipt id encoding from chain (`gobbleCount` × `WARPLET_ID_PADDING`)
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
): Promise<bigint> {
  const [gobbleCount, padding] = await Promise.all([
    publicClient.readContract({
      address: contract,
      abi: gobbledWarpletsAbi,
      functionName: "gobbleCount",
      args: [warpletId],
    }),
    publicClient.readContract({
      address: contract,
      abi: gobbledWarpletsAbi,
      functionName: "WARPLET_ID_PADDING",
    }),
  ]);
  if (gobbleCount === 0n) {
    throw new Error(
      "No reservation exists for this warplet — has the auction settled?",
    );
  }
  return (gobbleCount - 1n) * padding + warpletId;
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

    const gobbledContract = CONTRACTS.gobbledWarplets;
    if (gobbledContract === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json(
        { success: false, error: "Claiming isn’t available right now." },
        { status: 500 },
      );
    }

    const warpletId = BigInt(warpletIdNum);

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
    const receiptTokenId = await readReceiptTokenId(gobbledContract, warpletId);
    const padding = await publicClient.readContract({
      address: gobbledContract,
      abi: gobbledWarpletsAbi,
      functionName: "WARPLET_ID_PADDING",
    });
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

/** Map internal failures to actionable copy; keep generic fallback for unknowns. */
function mintErrorForClient(message: string): string {
  if (message.includes("No reservation exists"))
    return "This Warplet isn’t ready to claim yet. Give it a moment and try again.";
  if (message.includes("Source warplet image not found"))
    return "We couldn’t generate the claim artwork for this Warplet yet. Please try again shortly.";
  if (/pinata|PINATA|JWT/i.test(message))
    return "We couldn’t prepare the claim assets right now. Please try again shortly.";
  if (/GEMINI|genai|GoogleGenerativeAI/i.test(message))
    return "We couldn’t prepare the claim artwork right now. Please try again shortly.";
  if (/blob|BLOB|vercel.*storage/i.test(message) && /token|auth|401|403/i.test(message))
    return "We couldn’t save the claim assets right now. Please try again shortly.";
  if (
    /HTTP request failed|fetch failed|Fetch failed|ECONNRESET|ETIMEDOUT|timeout|429|503|502/i.test(
      message,
    )
  )
    return "The claim service is having trouble reaching Base right now. Please try again shortly.";
  return "Could not prepare your claim right now. Please try again later.";
}
