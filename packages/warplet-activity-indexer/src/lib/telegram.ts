import { telegramRoutes, type ActivityType } from "../env.js";
import { createTelegramNotifier, type TelegramMessage } from "./telegram-notifier.js";
import { env } from "../env.js";
import { FileBackedMessageDeduper } from "./telegram-dedupe.js";

const notifiers = new Map<string, ReturnType<typeof createTelegramNotifier>>();
const deduper = new FileBackedMessageDeduper(env.telegramDedupeFile);

export type TelegramNotificationResult = {
  outcome: "sent" | "deduped" | "skipped" | "failed";
  message?: TelegramMessage;
};

export async function sendTelegramNotification(
  type: ActivityType,
  html: string,
  options?: { dedupeKey?: string },
): Promise<TelegramNotificationResult> {
  const route = telegramRoutes[type];
  if (!route) return { outcome: "skipped" };

  const cacheKey = `${route.botToken}:${route.chatId}:${route.messageThreadId ?? "main"}:${route.silent}`;
  let notifier = notifiers.get(cacheKey);

  if (!notifier) {
    notifier = createTelegramNotifier({
      botToken: route.botToken,
      chatId: route.chatId,
      defaultMessageThreadId: route.messageThreadId,
      defaultSilent: route.silent,
    });
    notifiers.set(cacheKey, notifier);
  }

  const dedupeKey = options?.dedupeKey
    ? `${type}:${route.chatId}:${route.messageThreadId ?? "main"}:${options.dedupeKey}`
    : undefined;

  if (dedupeKey && (await deduper.has(dedupeKey))) {
    return { outcome: "deduped" };
  }

  try {
    const message = await notifier.sendMessage({ html, disableLinkPreview: true });
    if (dedupeKey) await deduper.mark(dedupeKey);
    return { outcome: "sent", message };
  } catch (error) {
    console.error(`[warplet-activity-indexer] Telegram notify failed for ${type}`, error);
    return { outcome: "failed" };
  }
}
