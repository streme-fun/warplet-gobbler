"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, isAddressEqual, zeroAddress, type Address } from "viem";
import { useLegacyAuctionTools } from "@/hooks/useLegacyAuctionTools";
import {
  classifyLegacyAuctionState,
  legacyAuctionStatusLabel,
  type LegacyAuctionState,
  type LegacyHeldWarpletStatus,
} from "@/lib/legacy-auction";

function shortAddress(address?: Address | null) {
  if (!address || isAddressEqual(address, zeroAddress)) return "None";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash: `0x${string}`) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatUtc(endTime: bigint) {
  if (endTime <= 0n) return "Unset";
  const ms = Number(endTime) * 1000;
  if (!Number.isSafeInteger(ms)) return `${endTime.toString()} unix`;
  return new Date(ms).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function formatRemaining(endTime: bigint, nowUnix: number) {
  if (endTime <= 0n) return "No end time";
  if (BigInt(nowUnix) >= endTime) return "Ended";
  const total = Number(endTime - BigInt(nowUnix));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function heldStatusLabel(status: LegacyHeldWarpletStatus) {
  switch (status) {
    case "current":
      return "current auction";
    case "queued":
      return "queued";
    case "held-needs-rescue-check":
      return "held / needs rescue check";
  }
}

function heldStatusClass(status: LegacyHeldWarpletStatus) {
  switch (status) {
    case "current":
      return "border-primary/40 bg-primary/10 text-primary";
    case "queued":
      return "border-secondary/40 bg-secondary/10 text-secondary";
    case "held-needs-rescue-check":
      return "border-warning/50 bg-warning/10 text-warning";
  }
}

function stateBadgeClass(state: LegacyAuctionState) {
  if (state.canSettleAndStartNext || state.canExtend) {
    return "border-warning/60 bg-warning/15 text-warning";
  }
  if (state.canBid) return "border-primary/50 bg-primary/15 text-primary";
  if (state.status === "paused") return "border-error/50 bg-error/15 text-error";
  return "border-base-content/20 bg-base-300/70 text-base-content/70";
}

function txStageLabel(stage: string) {
  switch (stage) {
    case "signing":
      return "Awaiting wallet";
    case "confirming":
      return "Confirming on Base";
    case "syncing":
      return "Refreshing state";
    default:
      return "Working";
  }
}

function MachineStep({
  label,
  detail,
  active,
}: {
  label: string;
  detail: string;
  active: boolean;
}) {
  return (
    <li
      className={`rounded-md border px-3 py-2 ${
        active
          ? "border-primary/50 bg-primary/10 text-base-content"
          : "border-base-content/10 bg-base-300/45 text-base-content/65"
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            active
              ? "bg-primary shadow-[0_0_10px_rgba(0,245,255,0.65)]"
              : "bg-base-content/25"
          }`}
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-xs leading-snug text-base-content/60">
            {detail}
          </p>
        </div>
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-base-content/10 bg-base-300/40 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
        {label}
      </p>
          <p className="mt-1 break-words text-sm font-semibold text-base-content">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 break-words text-xs text-base-content/55">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export default function LegacyAuctionToolsPanel() {
  const legacy = useLegacyAuctionTools();
  const [nowUnix, setNowUnix] = useState(() => Math.floor(Date.now() / 1000));
  const [bidAmount, setBidAmount] = useState("");

  useEffect(() => {
    const id = setInterval(
      () => setNowUnix(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const auctionState = useMemo(
    () =>
      classifyLegacyAuctionState({
        auction: legacy.currentAuction,
        paused: legacy.paused,
        nowUnix,
      }),
    [legacy.currentAuction, legacy.paused, nowUnix],
  );

  const parsedBidWei = useMemo(() => {
    if (!bidAmount.trim()) return null;
    try {
      return legacy.parseBidAmount(bidAmount);
    } catch {
      return null;
    }
  }, [bidAmount, legacy]);

  const bidInputError = useMemo(() => {
    if (!bidAmount.trim()) return null;
    if (parsedBidWei == null) return "Invalid amount";
    if (legacy.minNextBidWei != null && parsedBidWei < legacy.minNextBidWei) {
      return `Minimum is ${legacy.formatBidAmount(legacy.minNextBidWei)} ${legacy.bidSymbol}`;
    }
    return null;
  }, [bidAmount, legacy, parsedBidWei]);

  const current = legacy.currentAuction;
  const canSubmitBid =
    legacy.isConnected &&
    auctionState.canBid &&
    parsedBidWei != null &&
    parsedBidWei > 0n &&
    bidInputError == null &&
    !legacy.isTxPending;

  const fillMinBid = () => {
    if (legacy.minNextBidWei == null) return;
    setBidAmount(formatUnits(legacy.minNextBidWei, legacy.bidDecimals));
  };

  const submitBid = () => {
    if (!canSubmitBid || parsedBidWei == null) return;
    void legacy.bid(parsedBidWei);
  };

  const stateLabel = legacyAuctionStatusLabel(auctionState.status);
  const highBidLabel =
    current == null
      ? "Loading"
      : `${legacy.formatBidAmount(current.highBid)} ${legacy.bidSymbol}`;
  const minBidLabel =
    legacy.minNextBidWei == null
      ? "Loading"
      : `${legacy.formatBidAmount(legacy.minNextBidWei)} ${legacy.bidSymbol}`;
  const reserveLabel =
    legacy.reservePriceWei == null
      ? "Loading"
      : `${legacy.formatBidAmount(legacy.reservePriceWei)} ${legacy.bidSymbol}`;
  const endLabel = current == null ? "Loading" : formatUtc(current.endTime);
  const endDetail =
    current == null ? "" : formatRemaining(current.endTime, nowUnix);
  const rescueCount = legacy.rescueCandidates.length;

  return (
    <section className="mt-8 w-full max-w-5xl rounded-lg border border-base-content/10 bg-base-200/80 p-4 text-base-content shadow-2xl backdrop-blur-md sm:p-5">
      <div className="flex flex-col gap-3 border-b border-base-content/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-normal">
              Legacy auction tools
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${stateBadgeClass(
                auctionState,
              )}`}
            >
              {stateLabel}
            </span>
          </div>
          <p className="mt-1 break-all text-xs text-base-content/55">
            AuctionSell {shortAddress(legacy.auctionAddress)} / GobbledWarplets{" "}
            {shortAddress(legacy.gobbledWarpletsAddress)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <ConnectButton.Custom>
            {({ account, mounted, openAccountModal, openConnectModal }) => {
              const connected = mounted && account;
              return (
                <button
                  type="button"
                  onClick={connected ? openAccountModal : openConnectModal}
                  className="btn btn-sm min-h-0 rounded-md border border-base-content/20 bg-base-300/60 px-3 text-xs font-medium normal-case text-base-content hover:border-primary/50 hover:bg-primary/10"
                >
                  {connected ? account.displayName : "Connect wallet"}
                </button>
              );
            }}
          </ConnectButton.Custom>
          <p className="text-xs text-base-content/50">
            {legacy.address
              ? `Connected ${shortAddress(legacy.address)}`
              : "Wallet not connected"}
          </p>
        </div>
      </div>

      {legacy.readError ? (
        <div className="mt-4 rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          Legacy reads failed. Check the Base RPC and refresh.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Current token"
          value={
            current && current.tokenId > 0n ? `#${current.tokenId}` : "None"
          }
          detail={
            legacy.isReading
              ? "Refreshing"
              : legacy.paused
                ? "Paused"
                : "Not paused"
          }
        />
        <Stat
          label="High bid"
          value={highBidLabel}
          detail={`High bidder ${shortAddress(current?.highBidder)}`}
        />
        <Stat label="End time" value={endLabel} detail={endDetail} />
        <Stat
          label="Reserve / min next"
          value={reserveLabel}
          detail={`${minBidLabel} / +${legacy.minBidIncrementPct ?? "?"}%`}
        />
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
          State machine
        </p>
        <ol className="mt-2 grid gap-2 md:grid-cols-4">
          <MachineStep
            label="Live auction"
            detail={
              auctionState.canBid
                ? stateLabel
                : auctionState.ended
                  ? "Auction ended"
                  : "Waiting"
            }
            active={auctionState.canBid}
          />
          <MachineStep
            label="Settle/start next"
            detail={
              auctionState.canSettleAndStartNext
                ? "Ended with bids / can settle"
                : "Needs ended auction with bids"
            }
            active={auctionState.canSettleAndStartNext}
          />
          <MachineStep
            label="Extend"
            detail={
              auctionState.canExtend
                ? "Ended without bids / can extend"
                : "Needs ended auction without bids"
            }
            active={auctionState.canExtend}
          />
          <MachineStep
            label="Legacy claim"
            detail={
              rescueCount > 0
                ? `${rescueCount} claim candidate${rescueCount === 1 ? "" : "s"}`
                : "No claim candidates"
            }
            active={rescueCount > 0}
          />
        </ol>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border border-base-content/10 bg-base-300/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Manual bid</p>
            <button
              type="button"
              onClick={fillMinBid}
              disabled={legacy.minNextBidWei == null || legacy.isTxPending}
              className="btn btn-xs min-h-0 rounded-md border border-primary/30 bg-primary/10 px-2 text-[11px] font-semibold normal-case text-primary hover:bg-primary/20 disabled:border-base-content/10 disabled:bg-base-300/40 disabled:text-base-content/35"
            >
              Fill min
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="legacy-bid-amount">
              WARPGOBB bid amount
            </label>
            <input
              id="legacy-bid-amount"
              value={bidAmount}
              onChange={(event) => setBidAmount(event.target.value)}
              inputMode="decimal"
              placeholder={`Amount in ${legacy.bidSymbol}`}
              className="input input-sm min-h-0 flex-1 rounded-md border-base-content/15 bg-base-100/60 text-sm"
            />
            <button
              type="button"
              onClick={submitBid}
              disabled={!canSubmitBid}
              className="btn btn-sm min-h-0 rounded-md bg-primary px-4 text-sm font-semibold normal-case text-primary-content hover:bg-primary/90 disabled:bg-base-300 disabled:text-base-content/35"
            >
              {legacy.activeAction === "bid" && legacy.txStage !== "idle"
                ? txStageLabel(legacy.txStage)
                : "Bid"}
            </button>
          </div>
          <p className="mt-2 text-xs text-base-content/55">
            Minimum {minBidLabel}; bids use ERC777 send to legacy AuctionSell.
          </p>
          {bidInputError ? (
            <p className="mt-2 text-xs text-error">{bidInputError}</p>
          ) : null}
        </div>

        <div className="rounded-md border border-base-content/10 bg-base-300/35 p-3">
          <p className="text-sm font-semibold">Manual auction actions</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void legacy.settleAndStartNext()}
              disabled={
                !legacy.isConnected ||
                !auctionState.canSettleAndStartNext ||
                legacy.isTxPending
              }
              className="btn btn-sm min-h-0 rounded-md bg-secondary px-3 text-sm font-semibold normal-case text-secondary-content hover:bg-secondary/90 disabled:bg-base-300 disabled:text-base-content/35"
            >
              {legacy.activeAction === "settle-start-next" &&
              legacy.txStage !== "idle"
                ? txStageLabel(legacy.txStage)
                : "Settle/start next"}
            </button>
            <button
              type="button"
              onClick={() => void legacy.extendAuction()}
              disabled={
                !legacy.isConnected ||
                !auctionState.canExtend ||
                legacy.isTxPending
              }
              className="btn btn-sm min-h-0 rounded-md border border-warning/50 bg-warning/15 px-3 text-sm font-semibold normal-case text-warning hover:bg-warning/25 disabled:border-base-content/10 disabled:bg-base-300 disabled:text-base-content/35"
            >
              {legacy.activeAction === "extend" && legacy.txStage !== "idle"
                ? txStageLabel(legacy.txStage)
                : "Extend"}
            </button>
          </div>
          {legacy.txHash ? (
            <p className="mt-3 break-all text-xs text-success/90">
              Last tx {shortHash(legacy.txHash)}
            </p>
          ) : null}
          {legacy.txError ? (
            <div className="mt-3 rounded-md border border-error/40 bg-error/10 px-2 py-1.5 text-xs text-error">
              {legacy.txError}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            Queue
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {legacy.queuedTokenIds.length > 0 ? (
              legacy.queuedTokenIds.map((id) => (
                <span
                  key={id.toString()}
                  className="rounded-full border border-secondary/40 bg-secondary/10 px-2 py-1 text-xs font-semibold text-secondary"
                >
                  #{id.toString()}
                </span>
              ))
            ) : (
              <span className="text-sm text-base-content/55">
                No queued tokens
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            Held Warplets
          </p>
          <div className="mt-2 space-y-2">
            {legacy.heldWarplets.length > 0 ? (
              legacy.heldWarplets.map((warplet) => {
                const rescueAction = `rescue-${warplet.tokenId.toString()}`;
                const rescueInfo =
                  legacy.settledRescueByToken[warplet.tokenId.toString()];
                const connectedWinner =
                  legacy.address != null &&
                  rescueInfo != null &&
                  isAddressEqual(legacy.address, rescueInfo.winner);
                const canRescue =
                  legacy.isConnected &&
                  warplet.status === "held-needs-rescue-check" &&
                  connectedWinner &&
                  !legacy.isTxPending;
                return (
                  <div
                    key={warplet.tokenId.toString()}
                    className="flex flex-col gap-2 rounded-md border border-base-content/10 bg-base-300/35 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        Warplet #{warplet.tokenId.toString()}
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${heldStatusClass(
                          warplet.status,
                        )}`}
                      >
                        {heldStatusLabel(warplet.status)}
                      </span>
                      {rescueInfo ? (
                        <p className="mt-1 break-all text-[11px] text-base-content/55">
                          Winner wallet: {shortAddress(rescueInfo.winner)}
                        </p>
                      ) : warplet.status === "held-needs-rescue-check" ? (
                        <p className="mt-1 text-[11px] text-base-content/55">
                          Checking settlement record...
                        </p>
                      ) : null}
                    </div>
                    {warplet.status === "held-needs-rescue-check" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void legacy.rescueWarplet(warplet.tokenId)
                        }
                        disabled={!canRescue}
                        className="btn btn-xs min-h-0 rounded-md border border-warning/50 bg-warning/15 px-3 text-[11px] font-semibold normal-case text-warning hover:bg-warning/25 disabled:border-base-content/10 disabled:bg-base-300 disabled:text-base-content/35"
                      >
                        {legacy.activeAction === rescueAction &&
                        legacy.txStage !== "idle"
                          ? txStageLabel(legacy.txStage)
                          : connectedWinner
                            ? "Claim Warplet"
                            : rescueInfo
                              ? "Connect winner wallet"
                              : "Checking claim"}
                      </button>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-base-content/55">
                No Warplets held by legacy AuctionSell.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
