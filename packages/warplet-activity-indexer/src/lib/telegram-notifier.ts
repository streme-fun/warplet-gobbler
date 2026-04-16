import { basename } from "node:path";
import { readFile } from "node:fs/promises";

export type ChatId = string | number;

export type TelegramMessage = {
  message_id: number;
  chat?: { id: number | string; type?: string; title?: string };
  text?: string;
  caption?: string;
};

export type TelegramNotifierConfig = {
  botToken: string;
  chatId: ChatId;
  defaultMessageThreadId?: number;
  defaultSilent?: boolean;
  fetch?: typeof fetch;
};

type SendMessageOptions = {
  text?: string;
  html?: string;
  silent?: boolean;
  messageThreadId?: number;
  replyToMessageId?: number;
  disableLinkPreview?: boolean;
};

type PhotoInput =
  | string
  | URL
  | Uint8Array
  | ArrayBuffer
  | Blob
  | { path: string; fileName?: string; mimeType?: string };

type SendPhotoOptions = {
  photo: PhotoInput;
  captionText?: string;
  captionHtml?: string;
  fileName?: string;
  mimeType?: string;
  silent?: boolean;
  messageThreadId?: number;
  replyToMessageId?: number;
};

type TelegramApiSuccess<T> = {
  ok: true;
  result: T;
};

type TelegramApiFailure = {
  ok: false;
  error_code?: number;
  description?: string;
};

export class TelegramNotifierError extends Error {
  public readonly status?: number;
  public readonly errorCode?: number;
  public readonly description?: string;

  constructor(message: string, opts?: { status?: number; errorCode?: number; description?: string }) {
    super(message);
    this.name = "TelegramNotifierError";
    this.status = opts?.status;
    this.errorCode = opts?.errorCode;
    this.description = opts?.description;
  }
}

export function escapeTelegramHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

export function createTelegramNotifier(config: TelegramNotifierConfig) {
  return new TelegramNotifier(config);
}

class TelegramNotifier {
  private readonly botToken: string;
  private readonly chatId: ChatId;
  private readonly defaultMessageThreadId?: number;
  private readonly defaultSilent: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(config: TelegramNotifierConfig) {
    if (!config.botToken) throw new Error("botToken is required");
    if (config.chatId === "" || config.chatId === null || config.chatId === undefined) {
      throw new Error("chatId is required");
    }

    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.defaultMessageThreadId = config.defaultMessageThreadId;
    this.defaultSilent = config.defaultSilent ?? false;
    this.fetchImpl = config.fetch ?? fetch;
  }

  async sendMessage(input: string | SendMessageOptions): Promise<TelegramMessage> {
    const options = typeof input === "string" ? { text: input } : input;
    const text = resolveHtmlContent({ text: options.text, html: options.html });

    const body = new URLSearchParams();
    body.set("chat_id", String(this.chatId));
    body.set("parse_mode", "HTML");
    body.set("text", text);

    const silent = options.silent ?? this.defaultSilent;
    if (silent) body.set("disable_notification", "true");
    if (options.disableLinkPreview) {
      body.set("link_preview_options", JSON.stringify({ is_disabled: true }));
    }

    const messageThreadId = options.messageThreadId ?? this.defaultMessageThreadId;
    if (messageThreadId != null) body.set("message_thread_id", String(messageThreadId));
    if (options.replyToMessageId != null) {
      body.set("reply_parameters", JSON.stringify({ message_id: options.replyToMessageId }));
    }

    return this.request<TelegramMessage>("sendMessage", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  async sendPhoto(options: SendPhotoOptions): Promise<TelegramMessage> {
    const body = new FormData();
    body.set("chat_id", String(this.chatId));
    body.set("parse_mode", "HTML");

    const silent = options.silent ?? this.defaultSilent;
    if (silent) body.set("disable_notification", "true");

    const messageThreadId = options.messageThreadId ?? this.defaultMessageThreadId;
    if (messageThreadId != null) body.set("message_thread_id", String(messageThreadId));
    if (options.replyToMessageId != null) {
      body.set("reply_parameters", JSON.stringify({ message_id: options.replyToMessageId }));
    }

    const caption = resolveOptionalHtmlContent({ text: options.captionText, html: options.captionHtml });
    if (caption) body.set("caption", caption);

    const photoPart = await resolvePhotoInput(options.photo, {
      fileName: options.fileName,
      mimeType: options.mimeType,
    });

    if (typeof photoPart === "string") body.set("photo", photoPart);
    else body.set("photo", photoPart.blob, photoPart.fileName);

    return this.request<TelegramMessage>("sendPhoto", { method: "POST", body });
  }

  private async request<T>(method: string, init: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`https://api.telegram.org/bot${this.botToken}/${method}`, init);
    const data = (await response.json()) as TelegramApiSuccess<T> | TelegramApiFailure;

    if (!response.ok || !data.ok) {
      const failure = data as TelegramApiFailure;
      throw new TelegramNotifierError(
        failure.description ?? `Telegram API request failed for ${method}`,
        {
          status: response.status,
          errorCode: failure.error_code,
          description: failure.description,
        },
      );
    }

    return data.result;
  }
}

function resolveHtmlContent(input: { text?: string; html?: string }): string {
  const value = resolveOptionalHtmlContent(input);
  if (!value) throw new Error("Provide exactly one of text or html");
  return value;
}

function resolveOptionalHtmlContent(input: { text?: string; html?: string }): string | undefined {
  const hasText = input.text != null;
  const hasHtml = input.html != null;

  if (hasText && hasHtml) throw new Error("Provide either text or html, not both");
  if (hasHtml) return input.html;
  if (hasText) return escapeTelegramHtml(input.text ?? "");
  return undefined;
}

type BinaryPhotoPart = {
  blob: Blob;
  fileName: string;
};

async function resolvePhotoInput(
  input: PhotoInput,
  options: { fileName?: string; mimeType?: string },
): Promise<string | BinaryPhotoPart> {
  if (input instanceof URL) return input.toString();
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) return input;
    const file = await readFile(input);
    return {
      blob: new Blob([file], { type: options.mimeType ?? inferMimeTypeFromName(input) }),
      fileName: options.fileName ?? basename(input),
    };
  }

  if (typeof input === "object" && input !== null && "path" in input) {
    const file = await readFile(input.path);
    return {
      blob: new Blob([file], { type: input.mimeType ?? options.mimeType ?? inferMimeTypeFromName(input.path) }),
      fileName: input.fileName ?? options.fileName ?? basename(input.path),
    };
  }

  if (input instanceof Blob) {
    return { blob: input, fileName: options.fileName ?? "image" };
  }

  const uint8 = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;
  return {
    blob: new Blob([arrayBuffer], { type: options.mimeType ?? "application/octet-stream" }),
    fileName: options.fileName ?? "image",
  };
}

function inferMimeTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
