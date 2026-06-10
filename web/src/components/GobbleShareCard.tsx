"use client";

/* eslint-disable @next/next/no-img-element */

import ShareCastButton from "@/components/ShareCastButton";
import { useAddMiniApp } from "@/hooks/useAddMiniApp";
import { formatCompactAmount, formatUsdLabel } from "@/lib/share/format-amount";
import { gobbleCastText, gobbleShareUrl } from "@/lib/share/share-links";
import { warpletImageSrc } from "@/lib/warplet-image-src";

/**
 * Post-gobble receipt — shown the moment the jaws animation ends. This is the
 * single highest-energy moment in the product, so it gets the hardest sell:
 * brag (share loop) and pot alerts (notification loop), nothing else.
 */
export default function GobbleShareCard({
  fid,
  tokens,
  usd,
  txHash,
  symbol,
  onDismiss,
}: {
  fid: number;
  tokens: number;
  usd: number | null;
  txHash: string;
  symbol: string;
  onDismiss: () => void;
}) {
  const { added, maybePromptAdd } = useAddMiniApp();
  const amountLabel = formatCompactAmount(tokens);
  const usdLabel = formatUsdLabel(usd);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-primary/30 bg-base-200 p-6 text-center shadow-2xl shadow-primary/20 animate-fade-up-delay-1">
        <button
          type="button"
          onClick={onDismiss}
          className="btn btn-ghost btn-xs absolute right-2 top-2 h-7 w-7 min-h-0 p-0 text-base-content/40 hover:text-base-content/80"
          aria-label="Dismiss"
        >
          ✕
        </button>

        <p className="text-[11px] uppercase tracking-[0.3em] text-base-content/40">
          the gobbler is satisfied
        </p>

        <div className="mx-auto mt-4 w-32 h-32 rounded-xl overflow-hidden border-2 border-primary/50 grayscale-[35%]">
          <img
            src={warpletImageSrc(fid)}
            alt={`Warplet #${fid}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
        <p className="mt-2 font-mono text-xs text-base-content/50">
          WARPLET #{fid} · GOBBLED
        </p>

        <div className="mt-4">
          <p className="font-mono text-3xl font-semibold text-primary streaming-glow">
            +{amountLabel}{" "}
            <span className="text-base text-base-content/50">${symbol}</span>
          </p>
          {usdLabel ? (
            <p className="text-xs text-base-content/40 mt-1">({usdLabel})</p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <ShareCastButton
            className="btn-primary"
            label="Brag on Farcaster"
            buildPayload={(viewerFid) => ({
              text: gobbleCastText({
                tokenId: fid,
                amountLabel,
                symbol,
              }),
              embeds: [gobbleShareUrl(txHash, { ref: viewerFid })],
            })}
          />
          {!added ? (
            <button
              type="button"
              onClick={() => void maybePromptAdd()}
              className="btn btn-ghost btn-sm text-base-content/60"
            >
              🔔 Alert me when the pot fattens
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
