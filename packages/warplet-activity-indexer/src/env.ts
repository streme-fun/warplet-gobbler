const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const optionalString = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
};

const optionalNumber = (name: string): number | undefined => {
  const value = process.env[name];
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const optionalBoolean = (name: string, fallback = false): boolean => {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
};

export type ActivityType =
  | "BID_PLACED"
  | "WARPLET_GOBBLED"
  | "AUCTION_SETTLED"
  | "NEW_USER_INTERACTION";

export type TelegramRoute = {
  botToken: string;
  chatId: string;
  messageThreadId?: number;
  silent: boolean;
};

function parseRoute(prefix: string, fallback?: TelegramRoute): TelegramRoute | undefined {
  const botToken = optionalString(`${prefix}_BOT_TOKEN`) ?? fallback?.botToken;
  const chatId = optionalString(`${prefix}_CHAT_ID`) ?? fallback?.chatId;

  if (!botToken || !chatId) return fallback;

  return {
    botToken,
    chatId,
    messageThreadId:
      optionalNumber(`${prefix}_MESSAGE_THREAD_ID`) ?? fallback?.messageThreadId,
    silent: optionalBoolean(`${prefix}_SILENT`, fallback?.silent ?? false),
  };
}

export const env = {
  ponderRpcUrl8453: required("PONDER_RPC_URL_8453"),
  ponderWsUrl8453: process.env.PONDER_WS_URL_8453,
  auctionSellAddress: required("PONDER_AUCTION_SELL_ADDRESS") as `0x${string}`,
  dutchAuctionAddress: required("PONDER_DUTCH_AUCTION_ADDRESS") as `0x${string}`,
  startBlockRaw: process.env.PONDER_START_BLOCK ?? "latest",
  telegramDedupeFile: optionalString("INDEXER_TELEGRAM_DEDUPE_FILE"),
  neynarApiKey: process.env.NEYNAR_API_KEY,
  neynarClientId: process.env.NEYNAR_CLIENT_ID,
  notifyOnBackfill: optionalBoolean("INDEXER_NOTIFY_ON_BACKFILL", true),
  notifyFromBlockRaw: optionalString("INDEXER_NOTIFY_FROM_BLOCK"),
};

export const startBlock: number | "latest" = (() => {
  if (env.startBlockRaw === "latest") return "latest";
  const parsed = Number(env.startBlockRaw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("PONDER_START_BLOCK must be a non-negative integer or 'latest'");
  }
  return parsed;
})();

export const notifyFromBlock: bigint | undefined = (() => {
  if (env.notifyOnBackfill) return undefined;
  if (!env.notifyFromBlockRaw) return undefined;
  const parsed = Number(env.notifyFromBlockRaw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("INDEXER_NOTIFY_FROM_BLOCK must be a non-negative integer");
  }
  return BigInt(parsed);
})();

const defaultTelegramRoute = parseRoute("TELEGRAM_DEFAULT") ?? parseRoute("TELEGRAM");

export const telegramRoutes: Partial<Record<ActivityType, TelegramRoute>> = {
  BID_PLACED: parseRoute("TELEGRAM_BID_PLACED", defaultTelegramRoute),
  WARPLET_GOBBLED: parseRoute("TELEGRAM_WARPLET_GOBBLED", defaultTelegramRoute),
  AUCTION_SETTLED: parseRoute("TELEGRAM_AUCTION_SETTLED", defaultTelegramRoute),
  NEW_USER_INTERACTION: parseRoute("TELEGRAM_NEW_USER_INTERACTION", defaultTelegramRoute),
};

export const neynarEnabled = Boolean(env.neynarApiKey);
