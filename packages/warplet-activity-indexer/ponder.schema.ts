import { index, onchainEnum, onchainTable } from "ponder";

export const activityEventType = onchainEnum("activity_event_type", [
  "BID_PLACED",
  "WARPLET_GOBBLED",
  "AUCTION_SETTLED",
  "NEW_USER_INTERACTION",
]);

export const user = onchainTable(
  "user",
  (t) => ({
    address: t.hex().primaryKey(),
    firstSeenAt: t.bigint().notNull(),
    firstSeenBlockNumber: t.bigint().notNull(),
    firstSeenEventId: t.text().notNull(),
    firstInteractionType: activityEventType("first_interaction_type").notNull(),
    interactionCount: t.integer().notNull().default(0),
    lastSeenAt: t.bigint().notNull(),
    lastSeenBlockNumber: t.bigint().notNull(),
    lastEventId: t.text().notNull(),
    neynarFid: t.bigint(),
    neynarUsername: t.text(),
    neynarDisplayName: t.text(),
    neynarPfpUrl: t.text(),
    neynarBio: t.text(),
    neynarFollowerCount: t.integer(),
    neynarFollowingCount: t.integer(),
    neynarEnrichedAt: t.bigint(),
  }),
  (table) => ({
    firstSeenBlockIdx: index().on(table.firstSeenBlockNumber),
    lastSeenBlockIdx: index().on(table.lastSeenBlockNumber),
    neynarFidIdx: index().on(table.neynarFid),
  }),
);

export const activityEvent = onchainTable(
  "activity_event",
  (t) => ({
    id: t.text().primaryKey(),
    type: activityEventType("type").notNull(),
    chainId: t.integer().notNull(),
    contractAddress: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    transactionHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    actorAddress: t.hex(),
    secondaryAddress: t.hex(),
    tokenId: t.bigint(),
    amount: t.bigint(),
    payout: t.bigint(),
    gobbledTokenId: t.bigint(),
    summary: t.text().notNull(),
    metadata: t.json().$type<Record<string, unknown>>(),
    telegramNotifiedAt: t.bigint(),
  }),
  (table) => ({
    typeBlockIdx: index().on(table.type, table.blockNumber),
    actorIdx: index().on(table.actorAddress),
    txIdx: index().on(table.transactionHash),
  }),
);
