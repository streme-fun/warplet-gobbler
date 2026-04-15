import { createTelegramNotifier, type TelegramMessage } from "telegram-notifier";
import { telegramRoutes, type ActivityType } from "../env.js";

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

  return notifier.sendMessage({ html, disableLinkPreview: true });
}
