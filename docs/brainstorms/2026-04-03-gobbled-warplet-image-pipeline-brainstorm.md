# Gobbled Warplet Image Pipeline

**Date:** 2026-04-03
**Status:** Ready for planning

## What We're Building

A two-phase image pipeline for "gobbled" warplets:

1. **Generation phase** — When a warplet is deposited into the DutchAuction (gobbled), generate an AI-transformed version: the original warplet covered in black ooze, looking resigned and unhappy.
2. **Mint phase** — When an auction closes, the gobbled image is uploaded to Pinata IPFS for on-chain NFT metadata.

The user never explicitly triggers generation — it happens automatically after their gobble transaction confirms. Only auction winners end up with a minted NFT.

## Why This Approach

**Check-or-generate pattern** — Generate on gobble + a check endpoint that auto-generates if the image is missing. This makes the pipeline self-healing: if the initial generation call fails (network drop, timeout), the image will be created the first time anyone requests it.

This mirrors the check-warpclaw/check-selfie pattern from the reference WarpletSpace project.

## Key Decisions

| Decision           | Choice                                                                                        | Rationale                                                   |
| ------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Generation trigger | Automatic after gobble tx confirms (frontend fires API call)                                  | User doesn't need to know about it; generation is invisible |
| Self-healing       | Check-or-generate endpoint for resilience                                                     | If frontend call fails, image gets created on next access   |
| Image key          | By tokenId (`gobbled-warplets/warplet-{tokenId}-gobbled.png`)                                 | Ties to NFT identity, not user identity                     |
| Source image       | Warplet image at `warplets/warplet-{fid}.png` in Vercel Blob; FID derived from NFT attributes | Uses existing blob store for source images                  |
| AI model           | `gemini-3.1-flash-image-preview`                                                              | User-specified model                                        |
| Prompt             | "Cover this creature in black ooze and make it look resigned and unhappy"                     | User-specified prompt                                       |
| Blob storage       | Same warpletspace blob store, `gobbled-warplets/` prefix                                      | Reuse existing infrastructure                               |
| IPFS upload        | Auto on auction close — Pinata upload triggered when auction settles                          | Matches reference project's mint flow                       |
| Mint trigger       | Automatic on auction close (detection method TBD with AuctionSell implementation)             | AuctionSell is still a stub                                 |

## Architecture

```
Gobble tx confirms (frontend)
        │
        ▼
POST /api/generate-gobbled-image
  ├─ Input: { tokenId, fid }
  ├─ Fetch warplet image from blob (warplets/warplet-{fid}.png)
  ├─ Send to Gemini 3.1 Flash Image with ooze prompt
  ├─ Upload result to Vercel Blob (gobbled-warplets/warplet-{tokenId}-gobbled.png)
  └─ Return blob URL

GET /api/check-gobbled-image?tokenId=X
  ├─ Check blob storage via list()
  ├─ If exists → return URL
  └─ If missing → trigger generation (needs fid lookup from NFT attributes)

Auction closes (on-chain event, detection TBD)
        │
        ▼
POST /api/mint-gobbled-nft
  ├─ Input: { tokenId }
  ├─ Fetch gobbled image from Vercel Blob
  ├─ Generate OG/metadata image via ImageResponse
  ├─ Upload to Pinata IPFS
  └─ Return IPFS link for on-chain tokenURI
```

## New Dependencies

- `@google/genai` — Gemini API client
- `@vercel/blob` — Blob storage (put, list)
- `pinata` — IPFS upload for NFT metadata

## New Environment Variables

- `GEMINI_API_KEY` — Google Gemini API key
- `warpletgobbler_READ_WRITE_TOKEN` — Vercel Blob token (shared with existing blob store)
- `PINATA_JWT` — Pinata authentication
- `PINATA_GATEWAY_URL` — Pinata gateway for CID-to-URL conversion

## New API Routes

1. `POST /api/generate-gobbled-image` — Generate ooze warplet, save to Vercel Blob
2. `GET /api/check-gobbled-image` — Check if gobbled image exists, generate if missing
3. `POST /api/mint-gobbled-nft` — Upload gobbled image to Pinata IPFS for minting

## Open Questions

- **FID from tokenId**: How exactly to resolve tokenId → FID for the check endpoint's auto-generate path? On-chain attribute read, or maintain a mapping?
- **Auction close detection**: AuctionSell is a stub — the mint-gobbled-nft trigger mechanism depends on how auction settlement is implemented.
- **Rate limiting**: Should the generation endpoints have any protection against abuse?
