import type { Context as PonderContext } from "ponder:registry";
import { and, desc, eq, lt, or } from "ponder";
import type { NeynarUser } from "./neynar.js";
import { getNeynarUserByAddress } from "./neynar.js";
import { sendTelegramNotification } from "./telegram.js";
import { sendFarcasterNotification } from "./farcaster-notifier.js";
import { activityEvent, user } from "ponder:schema";
import {
  bidTokenSymbol,
  env,
  gobblerAppUrl,
  notifyFromBlock,
  paymentTokenSymbol,
  type ActivityType,
} from "../env.js";
import { escapeHtml, formatActor, formatActorPlain, formatTokenAmount } from "./format.js";

type BaseActivityRecord = {
  id: string;
  type: ActivityType;
  chainId: number;
  contractAddress: `0x${string}`;
  blockNumber: bigint;
  blockTimestamp: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  actorAddress?: `0x${string}`;
  secondaryAddress?: `0x${string}`;
  tokenId?: bigint;
  amount?: bigint;
  payout?: bigint;
  gobbledTokenId?: bigint;
  summary: string;
  metadata?: Record<string, unknown>;
};

type IndexerContext =
  | PonderContext<"AuctionSell:BidPlaced">
  | PonderContext<"DutchAuction:Gobbled">
  | PonderContext<"AuctionSell:AuctionSettled">;

export async function processActivity(
  context: IndexerContext,
  record: BaseActivityRecord,
): Promise<void> {
  const existingEvent = await context.db.find(activityEvent, { id: record.id });

  if (!existingEvent) {
    await context.db
      .insert(activityEvent)
      .values({
        id: record.id,
        type: record.type,
        chainId: record.chainId,
        contractAddress: record.contractAddress,
        blockNumber: record.blockNumber,
        blockTimestamp: record.blockTimestamp,
        transactionHash: record.transactionHash,
        logIndex: record.logIndex,
        actorAddress: record.actorAddress,
        secondaryAddress: record.secondaryAddress,
        tokenId: record.tokenId,
        amount: record.amount,
        payout: record.payout,
        gobbledTokenId: record.gobbledTokenId,
        summary: record.summary,
        metadata: record.metadata ?? {},
      });
  }

  let profile: NeynarUser | null = null;
  let newUserEventId: string | null = null;

  if (record.actorAddress) {
    const { profile: resolvedProfile, isNewUser, newUserEventId: syntheticId } = await upsertUser(
      context,
      record.actorAddress,
      record,
    );
    profile = resolvedProfile;
    newUserEventId = isNewUser ? syntheticId : null;
  }

  if (shouldNotify(record.blockNumber) && !existingEvent?.telegramNotifiedAt) {
    const message = renderTelegramMessage(record, profile);
    const telegramResult = await sendTelegramNotification(record.type, message, {
      dedupeKey: record.id,
    });
    if (telegramResult.outcome === "sent" || telegramResult.outcome === "deduped") {
      await context.db
        .update(activityEvent, { id: record.id })
        .set({ telegramNotifiedAt: BigInt(Math.floor(Date.now() / 1000)) });
    }
  }

  // Farcaster Mini App notifications mirror the Telegram flow (same backfill guard).
  // Stable notificationIds let the web endpoint dedupe, so reprocessing is harmless.
  if (shouldNotify(record.blockNumber)) {
    await dispatchFarcasterNotification(context, record, profile);
  }

  if (newUserEventId && record.actorAddress && shouldNotify(record.blockNumber)) {
    const existingNewUserEvent = await context.db.find(activityEvent, { id: newUserEventId });
    if (existingNewUserEvent?.telegramNotifiedAt) return;

    const newUser = await context.db.find(user, { address: record.actorAddress });
    if (!newUser) return;

    const newUserMessage = renderNewUserTelegramMessage(newUser, record.transactionHash);
    const telegramResult = await sendTelegramNotification("NEW_USER_INTERACTION", newUserMessage, {
      dedupeKey: newUserEventId,
    });
    if (telegramResult.outcome === "sent" || telegramResult.outcome === "deduped") {
      await context.db
        .update(activityEvent, { id: newUserEventId })
        .set({ telegramNotifiedAt: BigInt(Math.floor(Date.now() / 1000)) });
    }
  }
}

async function upsertUser(
  context: IndexerContext,
  address: `0x${string}`,
  record: BaseActivityRecord,
): Promise<{ profile: NeynarUser | null; isNewUser: boolean; newUserEventId: string }> {
  const existing = await context.db.find(user, { address });
  const profile = await resolveProfile(address, existing);

  if (!existing) {
    await context.db.insert(user).values({
      address,
      firstSeenAt: record.blockTimestamp,
      firstSeenBlockNumber: record.blockNumber,
      firstSeenEventId: record.id,
      firstInteractionType: record.type,
      interactionCount: 1,
      lastSeenAt: record.blockTimestamp,
      lastSeenBlockNumber: record.blockNumber,
      lastEventId: record.id,
      neynarFid: profile?.fid != null ? BigInt(profile.fid) : null,
      neynarUsername: profile?.username,
      neynarDisplayName: profile?.displayName,
      neynarPfpUrl: profile?.pfpUrl,
      neynarBio: profile?.bio,
      neynarFollowerCount: profile?.followerCount,
      neynarFollowingCount: profile?.followingCount,
      neynarEnrichedAt: profile ? BigInt(Math.floor(Date.now() / 1000)) : null,
    });

    const syntheticId = `${record.id}:new-user`;
    await context.db.insert(activityEvent).values({
      id: syntheticId,
      type: "NEW_USER_INTERACTION",
      chainId: record.chainId,
      contractAddress: record.contractAddress,
      blockNumber: record.blockNumber,
      blockTimestamp: record.blockTimestamp,
      transactionHash: record.transactionHash,
      logIndex: record.logIndex,
      actorAddress: address,
      summary: `New user ${address} touched the system`,
      metadata: {
        sourceEventId: record.id,
        sourceType: record.type,
        neynar: profile ?? undefined,
      },
    });

    return { profile, isNewUser: true, newUserEventId: syntheticId };
  }

  await context.db
    .update(user, { address })
    .set({
      interactionCount: Number(existing.interactionCount ?? 0) + 1,
      lastSeenAt: record.blockTimestamp,
      lastSeenBlockNumber: record.blockNumber,
      lastEventId: record.id,
      neynarFid: existing.neynarFid ?? (profile?.fid != null ? BigInt(profile.fid) : null),
      neynarUsername: existing.neynarUsername ?? profile?.username,
      neynarDisplayName: existing.neynarDisplayName ?? profile?.displayName,
      neynarPfpUrl: existing.neynarPfpUrl ?? profile?.pfpUrl,
      neynarBio: existing.neynarBio ?? profile?.bio,
      neynarFollowerCount: existing.neynarFollowerCount ?? profile?.followerCount,
      neynarFollowingCount: existing.neynarFollowingCount ?? profile?.followingCount,
      neynarEnrichedAt:
        existing.neynarEnrichedAt ?? (profile ? BigInt(Math.floor(Date.now() / 1000)) : null),
    });

  return { profile, isNewUser: false, newUserEventId: `${record.id}:new-user` };
}

type UserRow = typeof user.$inferSelect | null;

async function resolveProfile(address: `0x${string}`, existing: UserRow): Promise<NeynarUser | null> {
  if (existing?.neynarUsername || existing?.neynarFid) {
    return {
      fid: existing.neynarFid != null ? Number(existing.neynarFid) : undefined,
      username: existing.neynarUsername ?? undefined,
      displayName: existing.neynarDisplayName ?? undefined,
      pfpUrl: existing.neynarPfpUrl ?? undefined,
      bio: existing.neynarBio ?? undefined,
      followerCount: existing.neynarFollowerCount ?? undefined,
      followingCount: existing.neynarFollowingCount ?? undefined,
    };
  }

  try {
    return await getNeynarUserByAddress(address);
  } catch (error) {
    console.error("[warplet-activity-indexer] Neynar enrichment failed", error);
    return null;
  }
}

function shouldNotify(blockNumber: bigint): boolean {
  if (env.notifyOnBackfill) return true;
  if (notifyFromBlock != null) return blockNumber >= notifyFromBlock;
  return env.startBlockRaw === "latest";
}

async function dispatchFarcasterNotification(
  context: IndexerContext,
  record: BaseActivityRecord,
  profile: NeynarUser | null,
): Promise<void> {
  try {
    switch (record.type) {
      case "WARPLET_GOBBLED":
        await sendFarcasterNotification({
          notificationId: `gobble:${record.transactionHash}`,
          title: "THE POT GOT GOBBLED 🦷",
          body: `${formatActorPlain(record.actorAddress, profile)} gobbled Warplet #${record.tokenId?.toString() ?? "?"} and drained ${formatTokenAmount(record.payout)} ${paymentTokenSymbol} — the pot is refilling now.`,
          targetUrl: `${gobblerAppUrl}/g/${record.transactionHash}`,
        });
        return;
      case "AUCTION_SETTLED":
        await sendFarcasterNotification({
          notificationId: `settled:${record.transactionHash}`,
          title: `Warplet #${record.tokenId?.toString() ?? "?"} rescued`,
          body: `${formatActorPlain(record.actorAddress, profile)} won the auction for ${formatTokenAmount(record.amount)} ${bidTokenSymbol}. Next lot is live.`,
          targetUrl: `${gobblerAppUrl}/w/${record.transactionHash}`,
        });
        return;
      case "BID_PLACED":
        await notifyOutbidBidder(context, record, profile);
        return;
      case "NEW_USER_INTERACTION":
        return;
    }
  } catch (error) {
    // Notification dispatch must never break indexing.
    console.error("[warplet-activity-indexer] Farcaster dispatch failed", error);
  }
}

async function notifyOutbidBidder(
  context: IndexerContext,
  record: BaseActivityRecord,
  profile: NeynarUser | null,
): Promise<void> {
  if (record.tokenId == null || !record.actorAddress) return;

  // Most recent bid on the same warplet strictly before this log (the current
  // event row is already inserted, so exclude it by block/log position).
  const previousBids = await context.db.sql
    .select()
    .from(activityEvent)
    .where(
      and(
        eq(activityEvent.type, "BID_PLACED"),
        eq(activityEvent.tokenId, record.tokenId),
        or(
          lt(activityEvent.blockNumber, record.blockNumber),
          and(
            eq(activityEvent.blockNumber, record.blockNumber),
            lt(activityEvent.logIndex, record.logIndex),
          ),
        ),
      ),
    )
    .orderBy(desc(activityEvent.blockNumber), desc(activityEvent.logIndex))
    .limit(1);

  const previousBid = previousBids[0];
  if (!previousBid?.actorAddress) return;
  if (previousBid.actorAddress.toLowerCase() === record.actorAddress.toLowerCase()) return;

  // Only targetable if Neynar enrichment resolved a fid for the outbid wallet.
  const previousBidder = await context.db.find(user, { address: previousBid.actorAddress });
  if (previousBidder?.neynarFid == null) return;
  const fid = Number(previousBidder.neynarFid);
  if (!Number.isSafeInteger(fid) || fid <= 0) return;

  await sendFarcasterNotification({
    notificationId: `outbid:${record.transactionHash}`,
    title: "You got outbid 😤",
    body: `${formatActorPlain(record.actorAddress, profile)} bid ${formatTokenAmount(record.amount)} ${bidTokenSymbol} on Warplet #${record.tokenId.toString()}. Take it back.`,
    targetUrl: `${gobblerAppUrl}/buy`,
    targetFids: [fid],
  });
}

function renderTelegramMessage(record: BaseActivityRecord, profile: NeynarUser | null): string {
  const actor = formatActor(record.actorAddress, profile);
  const txUrl = `https://basescan.org/tx/${record.transactionHash}`;
  const tx = `<a href="${txUrl}">tx</a>`;

  switch (record.type) {
    case "BID_PLACED":
      return [
        `🟢 <b>Bid</b> #${record.tokenId?.toString() ?? "?"}`,
        `${actor}`,
        `<b>${formatTokenAmount(record.amount)}</b> · ${tx}`,
      ].join("\n");
    case "WARPLET_GOBBLED":
      return [
        `🔴 <b>Gobbled</b> #${record.tokenId?.toString() ?? "?"}`,
        `${actor}`,
        `<b>${formatTokenAmount(record.payout)}</b> out · ${tx}`,
      ].join("\n");
    case "AUCTION_SETTLED":
      return [
        `🟢 <b>Settled</b> #${record.tokenId?.toString() ?? "?"}`,
        `${actor}`,
        `<b>${formatTokenAmount(record.amount)}</b> · receipt <b>#${record.gobbledTokenId?.toString() ?? "?"}</b> · ${tx}`,
      ].join("\n");
    case "NEW_USER_INTERACTION":
      return [
        `🟢 <b>New user</b>`,
        `${actor}`,
        `${tx}`,
      ].join("\n");
  }
}

function renderNewUserTelegramMessage(
  newUser: any,
  transactionHash?: `0x${string}`,
): string {
  const tx = transactionHash
    ? `<a href="https://basescan.org/tx/${transactionHash}">tx</a>`
    : null;
  const identity = [
    newUser.neynarDisplayName ? escapeHtml(newUser.neynarDisplayName) : null,
    newUser.neynarUsername ? `@${escapeHtml(newUser.neynarUsername)}` : null,
    `<code>${newUser.address.slice(0, 6)}…${newUser.address.slice(-4)}</code>`,
  ]
    .filter(Boolean)
    .join(" · ");

  const bits = [`🟢 <b>New user</b>`, identity];
  if (newUser.neynarFollowerCount != null) {
    bits.push(`<b>${newUser.neynarFollowerCount}</b> followers`);
  }
  if (tx) bits.push(tx);

  return bits.join("\n");
}
