---
title: "feat: Gobbled Warplet Image Pipeline"
type: feat
date: 2026-04-03
---

# feat: Gobbled Warplet Image Pipeline

## Overview

Two-phase AI image pipeline for gobbled warplets: generate an ooze-covered version of each warplet when it's deposited into the DutchAuction, then upload to IPFS when the auction closes for NFT minting.

## Problem Statement / Motivation

When a user gobbles a warplet (deposits it into the DutchAuction for a payout), the warplet enters an auction queue. Currently there's no visual distinction between a fresh warplet and a gobbled one. The gobbled version — covered in black ooze, resigned and unhappy — becomes a unique NFT that the auction winner receives.

## Proposed Solution

**One idempotent endpoint** that checks for an existing image, generates if missing, returns the URL either way. Core logic extracted into a shared module for testability and reuse by the future mint endpoint.

1. `POST /api/gobbled-image` — Idempotent: check blob, generate if missing, return URL
2. `POST /api/mint-gobbled-nft` — Fetch gobbled image from blob, upload to Pinata IPFS, return IPFS link

Generation is fire-and-forget from the frontend — triggered after gobble tx confirmation but not awaited. The idempotent endpoint IS the safety net (call it again anytime to get the image).

## Technical Considerations

### FID as tokenId

The frontend passes `selectedFid` to `gobbleWarplet()` as the tokenId argument (`web/src/app/page.tsx:148`). FID === tokenId for the Warplets collection. Use `tokenId` as the single canonical identifier. The source image URL is derived from tokenId: `warplets/warplet-${tokenId}.png`.

### Source images

Source warplet images live in Vercel Blob at:

```
https://qcntgudzysvobg72.public.blob.vercel-storage.com/warplets/warplet-{tokenId}.png
```

### On-chain verification (API protection)

Before calling Gemini, verify the tokenId was actually gobbled: read `ownerOf(tokenId)` on the Warplets contract and check it equals the DutchAuction's `nftReserve` address. This prevents abuse — without it, anyone can hit the endpoint and drain Gemini API credits. One `publicClient.readContract` call, inlined at the top of the handler.

### Idempotency

The endpoint checks Vercel Blob for an existing image before calling Gemini. Prefix match must include `.png` extension to avoid `warplet-1` matching `warplet-10`.

### Vercel function timeout

Gemini image generation + blob upload could take 10-30s. Set `maxDuration = 60` on API routes.

### Gemini safety filters

Try primary prompt. If safety-filtered, try fallback prompt. If both fail, return error. Two attempts, no retry framework.

## Acceptance Criteria

### Phase 1: Shared generation module

- [x] Install dependencies: `@google/genai`, `@vercel/blob`, `pinata`
- [x] Add env vars to `web/.env.example`: `GEMINI_API_KEY`, `warpletgobbler_READ_WRITE_TOKEN`, `PINATA_JWT`, `PINATA_GATEWAY_URL`
- [x] Create `web/src/lib/generate-gobbled-image.ts`
  - `ensureGobbledImage(tokenId: number): Promise<{ url: string }>` — pure logic, no request/response objects
  - Checks Vercel Blob for `gobbled-warplets/warplet-${tokenId}-gobbled.png` (include `.png` in prefix)
  - If exists: return URL
  - Fetches source image from Vercel Blob (`warplets/warplet-${tokenId}.png`), validate response is 200
  - Sends to Gemini `gemini-3.1-flash-image-preview` with prompt: "Cover this creature in black ooze and make it look resigned and unhappy"
  - Guard AI response: check `imagePart?.inlineData?.data` exists before accessing, throw descriptive error if missing
  - If safety-filtered: retry with fallback prompt "Apply a dark, gloomy transformation to this creature"
  - Stores result at `gobbled-warplets/warplet-${tokenId}-gobbled.png` in Vercel Blob
  - Returns `{ url: string }`

### Phase 2: API route

- [x] Create `POST /api/gobbled-image` route (`web/src/app/api/gobbled-image/route.ts`)
  - Thin handler: validate input, verify on-chain, call shared module, format response
  - Input validation: `tokenId` must be a positive integer
  - On-chain verification: `ownerOf(tokenId)` on Warplets contract must equal DutchAuction `nftReserve` address (use viem `publicClient.readContract`)
  - Calls `ensureGobbledImage(tokenId)`
  - Returns `{ success: true, blobUrl, tokenId }` or `{ success: false, error }` with appropriate status code
  - `export const maxDuration = 60`

### Phase 3: Frontend integration

- [x] In `handleSell()` (`web/src/app/page.tsx`), after `waitForTransactionReceipt` and before `startSellAnimation()`:
  - Fire-and-forget: `fetch('/api/gobbled-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenId: selectedFid }) }).catch(console.error)`
  - Do NOT await — let animation play immediately

### Phase 4: Pinata utility + Mint endpoint

- [x] Create `web/src/app/utils/pinata.ts` (adapted from reference project)
  - `uploadToPinata(file: File): Promise<string>` using PinataSDK
  - Uses `PINATA_JWT` and `PINATA_GATEWAY_URL` env vars
- [x] Create `POST /api/mint-gobbled-nft` route (`web/src/app/api/mint-gobbled-nft/route.ts`)
  - Accepts `{ tokenId }`
  - Fetches gobbled image from Vercel Blob (via `ensureGobbledImage` — generates if missing)
  - Generates metadata image via `ImageResponse` (1200x1200 square with gobbled warplet + branding)
  - Uploads to Pinata IPFS via `uploadToPinata()`
  - Returns `{ ipfsLink, tokenId }`
  - Note: trigger mechanism TBD — AuctionSell is a stub

### Phase 5: Update env documentation

- [x] Update `web/.env.example` with new env vars
- [x] Update `CLAUDE.md` environment variables section

## Implementation Reference

### Shared module:

```typescript
// web/src/lib/generate-gobbled-image.ts
import { put, list } from "@vercel/blob";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const PRIMARY_PROMPT =
  "Cover this creature in black ooze and make it look resigned and unhappy";
const FALLBACK_PROMPT = "Apply a dark, gloomy transformation to this creature";
const BLOB_TOKEN = process.env.warpletgobbler_READ_WRITE_TOKEN!;
const SOURCE_BASE =
  "https://qcntgudzysvobg72.public.blob.vercel-storage.com/warplets";

export async function ensureGobbledImage(
  tokenId: number,
): Promise<{ url: string }> {
  // 1. Check if already exists (include .png to avoid prefix collisions)
  const existing = await list({
    prefix: `gobbled-warplets/warplet-${tokenId}-gobbled.png`,
    token: BLOB_TOKEN,
  });
  if (existing.blobs.length > 0) {
    return { url: existing.blobs[0].url };
  }

  // 2. Fetch source image
  const sourceUrl = `${SOURCE_BASE}/warplet-${tokenId}.png`;
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) {
    throw new Error(`Source warplet image not found: ${sourceResponse.status}`);
  }
  const sourceBuffer = await sourceResponse.arrayBuffer();
  const sourceBase64 = Buffer.from(sourceBuffer).toString("base64");

  // 3. Generate via Gemini (with fallback prompt)
  const imageBuffer = await generateWithFallback(sourceBase64);

  // 4. Store in Vercel Blob
  const blob = await put(
    `gobbled-warplets/warplet-${tokenId}-gobbled.png`,
    imageBuffer,
    {
      access: "public",
      contentType: "image/png",
      token: BLOB_TOKEN,
    },
  );

  return { url: blob.url };
}

async function generateWithFallback(sourceBase64: string): Promise<Buffer> {
  for (const prompt of [PRIMARY_PROMPT, FALLBACK_PROMPT]) {
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: sourceBase64 } },
        ],
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData,
      );

      if (!imagePart?.inlineData?.data) {
        continue; // try fallback prompt
      }

      return Buffer.from(imagePart.inlineData.data as string, "base64");
    } catch {
      continue; // try fallback prompt
    }
  }

  throw new Error("Image generation failed after primary and fallback prompts");
}
```

### API route (thin handler):

```typescript
// web/src/app/api/gobbled-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { ensureGobbledImage } from "@/lib/generate-gobbled-image";
import { CONTRACTS } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const publicClient = createPublicClient({ chain: base, transport: http() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tokenId = Number(body.tokenId);

    if (!Number.isInteger(tokenId) || tokenId < 0) {
      return NextResponse.json(
        { success: false, error: "Invalid tokenId" },
        { status: 400 },
      );
    }

    // Verify on-chain: tokenId must be owned by nftReserve (i.e., actually gobbled)
    const owner = await publicClient.readContract({
      address: CONTRACTS.warplets,
      abi: [
        {
          name: "ownerOf",
          type: "function",
          stateMutability: "view",
          inputs: [{ type: "uint256" }],
          outputs: [{ type: "address" }],
        },
      ],
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });

    const nftReserve = await publicClient.readContract({
      address: CONTRACTS.dutchAuction,
      abi: [
        {
          name: "nftReserve",
          type: "function",
          stateMutability: "view",
          inputs: [],
          outputs: [{ type: "address" }],
        },
      ],
      functionName: "nftReserve",
    });

    if (owner !== nftReserve) {
      return NextResponse.json(
        { success: false, error: "Token not gobbled" },
        { status: 403 },
      );
    }

    const result = await ensureGobbledImage(tokenId);
    return NextResponse.json({ success: true, blobUrl: result.url, tokenId });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Generation failed",
      },
      { status: 500 },
    );
  }
}
```

### Frontend integration:

```typescript
// web/src/app/page.tsx — inside handleSell(), after tx confirmation
const receipt = await publicClient.waitForTransactionReceipt({
  hash: gobbleHash,
});

// Fire-and-forget gobbled image generation
fetch("/api/gobbled-image", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tokenId: selectedFid }),
}).catch(console.error);

startSellAnimation(selectedFid);
```

## Dependencies & Risks

| Risk                                     | Mitigation                                                    |
| ---------------------------------------- | ------------------------------------------------------------- |
| Gemini safety filter rejects ooze prompt | Two-attempt fallback: primary prompt, then toned-down prompt  |
| API credit drain from abuse              | On-chain verification: ownerOf(tokenId) must equal nftReserve |
| Gemini returns no image                  | Guard with null check, throw descriptive error                |
| Source warplet image missing             | Validate fetch response status before proceeding              |
| Blob prefix collision (tokenId 1 vs 10)  | Include `.png` extension in prefix match                      |
| Vercel function timeout                  | Set `maxDuration = 60` on routes                              |
| AuctionSell stub blocks mint trigger     | Mint endpoint works but trigger mechanism is TBD              |

## New Files

```
web/src/lib/generate-gobbled-image.ts              (core generation logic)
web/src/app/api/gobbled-image/route.ts             (idempotent generate endpoint)
web/src/app/api/mint-gobbled-nft/route.ts          (IPFS upload for NFT metadata)
web/src/app/utils/pinata.ts                        (Pinata upload utility)
```

## Modified Files

```
web/src/app/page.tsx                               (add fire-and-forget API call in handleSell)
web/package.json                                   (add @google/genai, @vercel/blob, pinata)
web/.env.example                                   (add new env vars)
```

## References

- Brainstorm: `docs/brainstorms/2026-04-03-gobbled-warplet-image-pipeline-brainstorm.md`
- Reference implementation: WarpletSpace mirror-selfie and warpclaw flows (provided in brainstorm)
- Integration point: `web/src/app/page.tsx:148-154` (handleSell after tx confirmation)
- Gobble hook: `web/src/hooks/useDutchAuction.ts:280` (gobbleWarplet function)
- Existing API patterns: `web/src/app/api/bidder-profile/[address]/route.ts`
