# telegram-notifier

A small, vanilla Telegram Bot API wrapper for sending messages to one specific chat.

## Choices

- **Formatting mode:** HTML only
- **Scope:** one bot + one default chat
- **Supports:** text, emojis, and photos/images

## Install / workspace use

This package is intended to live inside the monorepo workspace.

## Usage

```ts
import { createTelegramNotifier } from "telegram-notifier";

const notifier = createTelegramNotifier({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!,
});

await notifier.sendMessage("Hello 👋 from the bot");

await notifier.sendMessage({
  html: "<b>Build finished</b> ✅\n<i>Everything passed.</i>",
  disableLinkPreview: true,
});

await notifier.sendPhoto({
  photo: "https://picsum.photos/1200/800",
  captionText: "Fresh screenshot 🖼️",
});

await notifier.sendPhoto({
  photo: { path: "./artifacts/screenshot.png" },
  captionHtml: "<b>Local image upload</b> ✅",
});
```

## API

### `createTelegramNotifier(config)`

Creates a notifier locked to one bot token + one default chat.

Config:
- `botToken: string`
- `chatId: string | number`
- `defaultMessageThreadId?: number`
- `defaultSilent?: boolean`
- `fetch?: typeof fetch` — optional injection for tests/runtime control

### `notifier.sendMessage(input)`

Input can be:
- `string` — treated as plain text and safely escaped for HTML parse mode
- `{ text: string, ... }` — plain text, escaped automatically
- `{ html: string, ... }` — already-formatted HTML

Extra options:
- `silent?: boolean`
- `messageThreadId?: number`
- `replyToMessageId?: number`
- `disableLinkPreview?: boolean`

### `notifier.sendPhoto(options)`

`photo` can be:
- public URL string / `URL`
- local file path via `{ path: string }`
- raw bytes (`Uint8Array`, `Buffer`, `ArrayBuffer`, `Blob`)

Caption options:
- `captionText?: string` — escaped automatically
- `captionHtml?: string` — raw HTML

Extra options:
- `fileName?: string`
- `mimeType?: string`
- `silent?: boolean`
- `messageThreadId?: number`
- `replyToMessageId?: number`

## Notes

- This package intentionally uses **Telegram HTML parse mode only**.
- Plain text is escaped automatically.
- If you pass HTML, you are responsible for valid Telegram-supported HTML.
