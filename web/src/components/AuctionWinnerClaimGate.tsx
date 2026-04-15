"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { warpletImageSrc } from "@/lib/warplet-image-src";
import BidderAvatarName from "./BidderAvatarName";
import {
  rescueStageCtaLabel,
  type ClaimAction,
} from "./LastAuctionWinnerBanner";

const FALLBACK_GOBBLED = "/gobbled-warplet.jpg";

/** Same PNG bytes mint pins to IPFS (1200×1200 composite). */
function compositeImageUrl(tokenId: number) {
  return `/api/gobbled-composite-image?tokenId=${encodeURIComponent(String(tokenId))}`;
}

function shortAddr(a: Address) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function AuctionWinnerClaimGate({
  tokenId,
  winnerAddress,
  winAmountLabel,
  bidSymbol,
  viewerAddress,
  viewerDisplayName,
  viewerPfpUrl,
  claim,
}: {
  tokenId: number;
  winnerAddress: Address;
  winAmountLabel: string;
  bidSymbol: string;
  viewerAddress?: Address | null;
  /** Mini App display name — preferred for the congratulations line. */
  viewerDisplayName?: string | null;
  /** Mini App profile image when ENS/whois has no avatar. */
  viewerPfpUrl?: string | null;
  claim: ClaimAction;
}) {
  const compositeSrc = useMemo(() => compositeImageUrl(tokenId), [tokenId]);
  const [gobbledSrc, setGobbledSrc] = useState(compositeSrc);
  const [gobbledReady, setGobbledReady] = useState(false);

  useEffect(() => {
    setGobbledSrc(compositeSrc);
    setGobbledReady(false);
  }, [compositeSrc]);

  const claimBusy =
    claim.stage === "preparing" ||
    claim.stage === "awaiting-wallet" ||
    claim.stage === "confirming";
  const claimDone = claim.stage === "success";

  const frameClass =
    "relative mx-auto aspect-square w-full max-w-[11.5rem] overflow-hidden rounded-lg border-0 bg-transparent shadow-none sm:max-w-[12.5rem] sm:rounded-xl sm:border sm:border-base-content/15 sm:bg-base-300/30 sm:shadow-lg sm:shadow-black/25";

  return (
    <div className="w-full max-w-2xl mx-auto px-1 sm:px-2">
      <div className="text-[0.85em] sm:text-[0.9em] animate-fade-up">
      <div className="relative overflow-hidden rounded-none border-0 bg-transparent px-2 py-4 shadow-none sm:rounded-2xl sm:border sm:border-success/30 sm:bg-gradient-to-b sm:from-success/[0.08] sm:via-base-100/40 sm:to-base-200/30 sm:px-8 sm:py-9 sm:shadow-[0_0_64px_-18px_rgba(34,197,94,0.3)]">
        <div
          className="pointer-events-none absolute -right-20 -top-20 hidden h-52 w-52 rounded-full bg-secondary/20 blur-3xl sm:block"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-12 hidden h-44 w-44 rounded-full bg-success/15 blur-3xl sm:block"
          aria-hidden
        />

        <div className="text-center mb-6 sm:mb-8">
          <p className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-base-content leading-tight">
            Congratulations
          </p>
          <div className="flex justify-center mt-3 sm:mt-4">
            <div className="inline-flex max-w-full">
              <BidderAvatarName
                address={winnerAddress}
                viewerAddress={viewerAddress ?? undefined}
                displayNameOverride={viewerDisplayName}
                avatarUrlOverride={viewerPfpUrl}
                showYouWhenViewer={false}
                showViewerBadge={false}
                size="lg"
              />
            </div>
          </div>
          <p className="mt-4 sm:mt-5 text-lg sm:text-xl md:text-2xl text-base-content/90 font-medium leading-snug">
            You rescued Warplet{" "}
            <span className="text-secondary">#{tokenId}</span>
          </p>
          <p className="mt-3 text-sm sm:text-base text-base-content/75 font-mono tabular-nums leading-snug">
            with a {winAmountLabel}{" "}
            <span className="text-base-content/60">{bidSymbol}</span> bid
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 w-full max-w-md mx-auto mb-6 sm:mb-8 items-stretch">
          <div className={frameClass}>
            <img
              src={warpletImageSrc(tokenId)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
              loading="eager"
              decoding="async"
            />
          </div>
          <div className={frameClass}>
            {!gobbledReady ? (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-secondary/20 via-base-300/40 to-success/10" />
            ) : null}
            <img
              src={gobbledSrc}
              alt=""
              className={`absolute inset-0 h-full w-full object-contain bg-[#13111C] transition-opacity duration-300 ${
                gobbledReady ? "opacity-100" : "opacity-0"
              }`}
              draggable={false}
              loading="eager"
              decoding="async"
              onLoad={() => setGobbledReady(true)}
              onError={() => {
                setGobbledSrc(FALLBACK_GOBBLED);
                setGobbledReady(true);
              }}
            />
          </div>
        </div>

        {claim.visible ? (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={claim.onClaim}
              disabled={claimBusy || claimDone}
              className="btn btn-success mb-8 sm:mb-4 min-w-[min(100%,240px)] uppercase tracking-wider text-sm shadow-md shadow-success/15"
            >
              {claimBusy ? (
                <span className="loading loading-spinner loading-sm mr-2" />
              ) : null}
              {rescueStageCtaLabel(claim.stage)}
            </button>
            {claim.error ? (
              <p className="text-xs text-error text-center max-w-md break-words px-2">
                {claim.error}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-center text-xs text-warning/90">
            Claiming isn&apos;t available here yet. If you&apos;re the winner, hang tight —
            this step will unlock soon. ({shortAddr(winnerAddress)})
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
