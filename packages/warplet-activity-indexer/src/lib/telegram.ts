import { telegramRoutes, type ActivityType } from "../env.js";
import { createTelegramNotifier, type TelegramMessage } from "./telegram-notifier.js";

const notifiers = new Map<string, ReturnType<typeof createTelegramNotifier>>();

export async function sendTelegramNotification(
  type: ActivityType,
  html: string,
): Promise<TelegramMessage | null> {
  const route = telegramRoutes[type];
  if (!route) return null;

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

  try {
    return await notifier.sendMessage({ html, disableLinkPreview: true });
  } catch (error) {
    console.error(`[warplet-activity-indexer] Telegram notify failed for ${type}`, error);
    return null;
  }
}
