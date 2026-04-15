import { getNeynarUserByAddress } from "./neynar.js";
import { sendTelegramNotification } from "./telegram.js";
import { activityEvent, user } from "ponder:schema";
import { env, notifyFromBlock } from "../env.js";
import { escapeHtml, formatActor, formatTokenAmount } from "./format.js";
export async function processActivity(context, record) {
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
    let profile = null;
    let newUserEventId = null;
    if (record.actorAddress) {
        const { profile: resolvedProfile, isNewUser, newUserEventId: syntheticId } = await upsertUser(context, record.actorAddress, record);
        profile = resolvedProfile;
        newUserEventId = isNewUser ? syntheticId : null;
    }
    if (shouldNotify(record.blockNumber)) {
        const message = renderTelegramMessage(record, profile);
        const telegramMessage = await sendTelegramNotification(record.type, message);
        if (telegramMessage) {
            await context.db
                .update(activityEvent, { id: record.id })
                .set({ telegramNotifiedAt: BigInt(Math.floor(Date.now() / 1000)) });
        }
    }
    if (newUserEventId && shouldNotify(record.blockNumber)) {
        const newUser = await context.db.find(user, { address: record.actorAddress });
        const newUserMessage = renderNewUserTelegramMessage(newUser, record.transactionHash);
        const telegramMessage = await sendTelegramNotification("NEW_USER_INTERACTION", newUserMessage);
        if (telegramMessage) {
            await context.db
                .update(activityEvent, { id: newUserEventId })
                .set({ telegramNotifiedAt: BigInt(Math.floor(Date.now() / 1000)) });
        }
    }
}
async function upsertUser(context, address, record) {
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
        neynarEnrichedAt: existing.neynarEnrichedAt ?? (profile ? BigInt(Math.floor(Date.now() / 1000)) : null),
    });
    return { profile, isNewUser: false, newUserEventId: `${record.id}:new-user` };
}
async function resolveProfile(address, existing) {
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
    }
    catch (error) {
        console.error("[warplet-activity-indexer] Neynar enrichment failed", error);
        return null;
    }
}
function shouldNotify(blockNumber) {
    if (env.notifyOnBackfill)
        return true;
    if (notifyFromBlock != null)
        return blockNumber >= notifyFromBlock;
    return env.startBlockRaw === "latest";
}
function renderTelegramMessage(record, profile) {
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
function renderNewUserTelegramMessage(newUser, transactionHash) {
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
    if (tx)
        bits.push(tx);
    return bits.join("\n");
}
//# sourceMappingURL=event-processor.js.map