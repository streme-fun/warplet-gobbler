import { type Address, encodeFunctionData } from "viem";
import { OPENSEA_API_KEY, WARPLETS_COLLECTION_SLUG } from "./config.js";
import { log } from "./logger.js";

const BASE_URL = "https://api.opensea.io/api/v2";

const headers = (): Record<string, string> => ({
  accept: "application/json",
  "x-api-key": OPENSEA_API_KEY,
});

// ─── Types ────────────────────────────────────────────────────────────

export interface Listing {
  orderHash: string;
  tokenId: string;
  priceWei: bigint;
  currency: Address;
  seller: Address;
  expiry: number;
  protocolAddress: Address;
  raw: OpenseaListing;
}

interface OpenseaListing {
  order_hash: string;
  protocol_address: string;
  protocol_data: {
    parameters: {
      offerer: string;
      offer: Array<{
        itemType: number;
        token: string;
        identifierOrCriteria: string;
        startAmount: string;
        endAmount: string;
      }>;
      consideration: Array<{
        itemType: number;
        token: string;
        identifierOrCriteria: string;
        startAmount: string;
        endAmount: string;
        recipient: string;
      }>;
      endTime: string;
    };
  };
}

export interface FulfillmentData {
  to: Address;
  value: bigint;
  data: `0x${string}`;
}

// ─── Fetch listings ───────────────────────────────────────────────────

export async function fetchListings(): Promise<Listing[]> {
  const url = `${BASE_URL}/listings/collection/${WARPLETS_COLLECTION_SLUG}/all?limit=50`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    log.error("OpenSea listings fetch failed", { status: res.status, body: await res.text() });
    return [];
  }
  const json = (await res.json()) as { listings: OpenseaListing[] };
  return (json.listings ?? []).map(parseListing).filter(Boolean) as Listing[];
}

function parseListing(raw: OpenseaListing): Listing | null {
  try {
    const params = raw.protocol_data.parameters;
    const offer = params.offer[0];
    if (!offer) return null;

    // Drop expired listings — fulfillment would fail at the API layer.
    const expiry = Number(params.endTime);
    if (expiry > 0 && expiry < Math.floor(Date.now() / 1000)) return null;

    // Sum all consideration items to get total price
    const totalPriceWei = params.consideration.reduce(
      (sum, c) => sum + BigInt(c.startAmount),
      0n,
    );

    // Determine token ID from offer
    const tokenId = offer.identifierOrCriteria;

    // Currency: if consideration itemType is 0, it's native ETH; 1 = ERC20
    const currency = params.consideration[0]?.token ?? "0x0000000000000000000000000000000000000000";

    return {
      orderHash: raw.order_hash,
      tokenId,
      priceWei: totalPriceWei,
      currency: currency as Address,
      seller: params.offerer as Address,
      expiry,
      protocolAddress: raw.protocol_address as Address,
      raw,
    };
  } catch {
    log.warn("Failed to parse listing", { hash: raw.order_hash });
    return null;
  }
}

// ─── Get fulfillment calldata ─────────────────────────────────────────

// ─── Seaport ABI (just the fulfillment function we need) ─────────────

const seaportFulfillAbi = [
  {
    type: "function",
    name: "fulfillBasicOrder_efficient_6GL6yc",
    stateMutability: "payable",
    inputs: [
      {
        name: "parameters",
        type: "tuple",
        components: [
          { name: "considerationToken", type: "address" },
          { name: "considerationIdentifier", type: "uint256" },
          { name: "considerationAmount", type: "uint256" },
          { name: "offerer", type: "address" },
          { name: "zone", type: "address" },
          { name: "offerToken", type: "address" },
          { name: "offerIdentifier", type: "uint256" },
          { name: "offerAmount", type: "uint256" },
          { name: "basicOrderType", type: "uint8" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "zoneHash", type: "bytes32" },
          { name: "salt", type: "uint256" },
          { name: "offererConduitKey", type: "bytes32" },
          { name: "fulfillerConduitKey", type: "bytes32" },
          { name: "totalOriginalAdditionalRecipients", type: "uint256" },
          {
            name: "additionalRecipients",
            type: "tuple[]",
            components: [
              { name: "amount", type: "uint256" },
              { name: "recipient", type: "address" },
            ],
          },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── Get fulfillment calldata ─────────────────────────────────────────

export async function getFulfillment(
  listing: Listing,
  fulfillerAddress: Address,
): Promise<FulfillmentData | null> {
  const url = `${BASE_URL}/listings/fulfillment_data`;
  const body = {
    listing: {
      hash: listing.orderHash,
      chain: "base",
      protocol_address: listing.protocolAddress,
    },
    fulfiller: {
      address: fulfillerAddress,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    log.error("OpenSea fulfillment failed", { status: res.status, body: await res.text() });
    return null;
  }

  const json = (await res.json()) as {
    fulfillment_data: {
      transaction: {
        function: string;
        to: string;
        value: number;
        input_data: { parameters: Record<string, unknown> };
      };
    };
  };

  const tx = json.fulfillment_data.transaction;
  const params = tx.input_data.parameters;

  try {
    // ABI-encode the Seaport fulfillBasicOrder call from the decoded parameters.
    const calldata = encodeFunctionData({
      abi: seaportFulfillAbi,
      functionName: "fulfillBasicOrder_efficient_6GL6yc",
      args: [
        {
          considerationToken: params.considerationToken as Address,
          considerationIdentifier: BigInt(params.considerationIdentifier as string),
          considerationAmount: BigInt(params.considerationAmount as string),
          offerer: params.offerer as Address,
          zone: params.zone as Address,
          offerToken: params.offerToken as Address,
          offerIdentifier: BigInt(params.offerIdentifier as string),
          offerAmount: BigInt(params.offerAmount as string),
          basicOrderType: Number(params.basicOrderType),
          startTime: BigInt(params.startTime as string),
          endTime: BigInt(params.endTime as string),
          zoneHash: params.zoneHash as `0x${string}`,
          salt: BigInt(params.salt as string),
          offererConduitKey: params.offererConduitKey as `0x${string}`,
          fulfillerConduitKey: params.fulfillerConduitKey as `0x${string}`,
          totalOriginalAdditionalRecipients: BigInt(
            params.totalOriginalAdditionalRecipients as string,
          ),
          additionalRecipients: (
            params.additionalRecipients as Array<{ amount: string; recipient: string }>
          ).map((r) => ({
            amount: BigInt(r.amount),
            recipient: r.recipient as Address,
          })),
          signature: params.signature as `0x${string}`,
        },
      ],
    });

    return {
      to: tx.to as Address,
      value: BigInt(tx.value),
      data: calldata,
    };
  } catch (err) {
    log.error("Failed to encode Seaport calldata", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
