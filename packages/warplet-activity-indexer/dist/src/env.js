const required = (name) => {
    const value = process.env[name];
    if (!value)
        throw new Error(`${name} is required`);
    return value;
};
const optionalString = (name) => {
    const value = process.env[name];
    return value && value.trim() ? value.trim() : undefined;
};
const optionalNumber = (name) => {
    const value = process.env[name];
    if (!value)
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};
const optionalBoolean = (name, fallback = false) => {
    const value = process.env[name];
    if (value == null || value === "")
        return fallback;
    return value === "1" || value.toLowerCase() === "true";
};
function parseRoute(prefix, fallback) {
    const botToken = optionalString(`${prefix}_BOT_TOKEN`) ?? fallback?.botToken;
    const chatId = optionalString(`${prefix}_CHAT_ID`) ?? fallback?.chatId;
    if (!botToken || !chatId)
        return fallback;
    return {
        botToken,
        chatId,
        messageThreadId: optionalNumber(`${prefix}_MESSAGE_THREAD_ID`) ?? fallback?.messageThreadId,
        silent: optionalBoolean(`${prefix}_SILENT`, fallback?.silent ?? false),
    };
}
export const env = {
    ponderRpcUrl8453: required("PONDER_RPC_URL_8453"),
    ponderWsUrl8453: process.env.PONDER_WS_URL_8453,
    auctionSellAddress: required("PONDER_AUCTION_SELL_ADDRESS"),
    dutchAuctionAddress: required("PONDER_DUTCH_AUCTION_ADDRESS"),
    startBlockRaw: process.env.PONDER_START_BLOCK ?? "latest",
    neynarApiKey: process.env.NEYNAR_API_KEY,
    neynarClientId: process.env.NEYNAR_CLIENT_ID,
    notifyOnBackfill: optionalBoolean("INDEXER_NOTIFY_ON_BACKFILL", true),
    notifyFromBlockRaw: optionalString("INDEXER_NOTIFY_FROM_BLOCK"),
};
export const startBlock = (() => {
    if (env.startBlockRaw === "latest")
        return "latest";
    const parsed = Number(env.startBlockRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("PONDER_START_BLOCK must be a non-negative integer or 'latest'");
    }
    return parsed;
})();
export const notifyFromBlock = (() => {
    if (env.notifyOnBackfill)
        return undefined;
    if (!env.notifyFromBlockRaw)
        return undefined;
    const parsed = Number(env.notifyFromBlockRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("INDEXER_NOTIFY_FROM_BLOCK must be a non-negative integer");
    }
    return BigInt(parsed);
})();
const defaultTelegramRoute = parseRoute("TELEGRAM_DEFAULT") ?? parseRoute("TELEGRAM");
export const telegramRoutes = {
    BID_PLACED: parseRoute("TELEGRAM_BID_PLACED", defaultTelegramRoute),
    WARPLET_GOBBLED: parseRoute("TELEGRAM_WARPLET_GOBBLED", defaultTelegramRoute),
    AUCTION_SETTLED: parseRoute("TELEGRAM_AUCTION_SETTLED", defaultTelegramRoute),
    NEW_USER_INTERACTION: parseRoute("TELEGRAM_NEW_USER_INTERACTION", defaultTelegramRoute),
};
export const telegramEnabled = Object.values(telegramRoutes).some(Boolean);
export const neynarEnabled = Boolean(env.neynarApiKey);
//# sourceMappingURL=env.js.map