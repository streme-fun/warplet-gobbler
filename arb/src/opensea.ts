import type { Address } from "viem";
import { encodeFunctionData, parseAbiItem } from "viem";
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

type OpenSeaFulfillmentResponse = {
  fulfillment_data: {
    transaction: {
      function: string;
      to: string;
      value: string;
      input_data: {
        parameters: {
          considerationToken: string;
          considerationIdentifier: string;
          considerationAmount: string;
          offerer: string;
          zone: string;
          offerToken: string;
          offerIdentifier: string;
          offerAmount: string;
          basicOrderType: number;
          startTime: string;
          endTime: string;
          zoneHash: string;
          salt: string;
          offererConduitKey: string;
          fulfillerConduitKey: string;
          totalOriginalAdditionalRecipients: string;
          additionalRecipients: Array<{ amount: string; recipient: string }>;
          signature: string;
        };
      };
    };
  };
};

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

  const json = (await res.json()) as OpenSeaFulfillmentResponse;
  const tx = json.fulfillment_data.transaction;
  const params = tx.input_data.parameters;
  const abiItem = parseAbiItem(`function ${tx.function}`);
  const functionName = tx.function.slice(0, tx.function.indexOf("("));
  const data = encodeFunctionData({
    abi: [abiItem],
    functionName,
    args: [[
      params.considerationToken,
      BigInt(params.considerationIdentifier),
      BigInt(params.considerationAmount),
      params.offerer,
      params.zone,
      params.offerToken,
      BigInt(params.offerIdentifier),
      BigInt(params.offerAmount),
      params.basicOrderType,
      BigInt(params.startTime),
      BigInt(params.endTime),
      params.zoneHash as `0x${string}`,
      BigInt(params.salt),
      params.offererConduitKey as `0x${string}`,
      params.fulfillerConduitKey as `0x${string}`,
      BigInt(params.totalOriginalAdditionalRecipients),
      params.additionalRecipients.map((recipient) => [
        BigInt(recipient.amount),
        recipient.recipient as Address,
      ]),
      params.signature as `0x${string}`,
    ]],
  });

  return {
    to: tx.to as Address,
    value: BigInt(tx.value),
    data,
  };
}
