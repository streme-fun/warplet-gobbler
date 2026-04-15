import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createTelegramNotifier,
  escapeTelegramHtml,
} from "../src/lib/telegram-notifier.js";

test("escapeTelegramHtml escapes Telegram HTML-sensitive characters", () => {
  assert.equal(
    escapeTelegramHtml('<hello & "world">'),
    "&lt;hello &amp; &quot;world&quot;&gt;",
  );
});

test("sendMessage posts escaped HTML text to the configured chat", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const notifier = createTelegramNotifier({
    botToken: "secret-token",
    chatId: "-100123",
    fetch: async (url, init) => {
      requestUrl = String(url);
      requestInit = init;
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 1, text: "ok" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  await notifier.sendMessage("Hello <team> 👋");

  assert.equal(requestUrl, "https://api.telegram.org/botsecret-token/sendMessage");
  assert.equal(requestInit?.method, "POST");
  assert.ok(requestInit?.body instanceof URLSearchParams);
  const body = requestInit?.body as URLSearchParams;
  assert.equal(body.get("chat_id"), "-100123");
  assert.equal(body.get("parse_mode"), "HTML");
  assert.equal(body.get("text"), "Hello &lt;team&gt; 👋");
});

test("sendPhoto supports local file paths and escaped captions", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const tempDir = await mkdtemp(join(tmpdir(), "telegram-notifier-"));
  const filePath = join(tempDir, "shot.png");
  await writeFile(filePath, Buffer.from([1, 2, 3, 4]));

  const notifier = createTelegramNotifier({
    botToken: "secret-token",
    chatId: 42,
    fetch: async (url, init) => {
      requestUrl = String(url);
      requestInit = init;
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 2, caption: "ok" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  await notifier.sendPhoto({
    photo: { path: filePath },
    captionText: "Done <now> ✅",
  });

  assert.equal(requestUrl, "https://api.telegram.org/botsecret-token/sendPhoto");
  assert.equal(requestInit?.method, "POST");
  assert.ok(requestInit?.body instanceof FormData);

  const body = requestInit?.body as FormData;
  assert.equal(body.get("chat_id"), "42");
  assert.equal(body.get("parse_mode"), "HTML");
  assert.equal(body.get("caption"), "Done &lt;now&gt; ✅");

  const photo = body.get("photo");
  assert.ok(photo instanceof File);
  assert.equal(photo.name, "shot.png");
  assert.equal(photo.type, "image/png");
});
