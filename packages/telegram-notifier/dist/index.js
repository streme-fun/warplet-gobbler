import { basename } from "node:path";
import { readFile } from "node:fs/promises";
export class TelegramNotifierError extends Error {
    status;
    errorCode;
    description;
    constructor(message, opts) {
        super(message);
        this.name = "TelegramNotifierError";
        this.status = opts?.status;
        this.errorCode = opts?.errorCode;
        this.description = opts?.description;
    }
}
export function createTelegramNotifier(config) {
    return new TelegramNotifier(config);
}
export class TelegramNotifier {
    botToken;
    chatId;
    defaultMessageThreadId;
    defaultSilent;
    fetchImpl;
    constructor(config) {
        if (!config.botToken)
            throw new Error("botToken is required");
        if (config.chatId === "" || config.chatId === null || config.chatId === undefined) {
            throw new Error("chatId is required");
        }
        this.botToken = config.botToken;
        this.chatId = config.chatId;
        this.defaultMessageThreadId = config.defaultMessageThreadId;
        this.defaultSilent = config.defaultSilent ?? false;
        this.fetchImpl = config.fetch ?? fetch;
    }
    async sendMessage(input) {
        const options = normalizeMessageInput(input);
        const text = resolveHtmlContent({ text: options.text, html: options.html });
        const body = new URLSearchParams();
        body.set("chat_id", String(this.chatId));
        body.set("parse_mode", "HTML");
        body.set("text", text);
        const silent = options.silent ?? this.defaultSilent;
        if (silent)
            body.set("disable_notification", "true");
        if (options.disableLinkPreview)
            body.set("link_preview_options", JSON.stringify({ is_disabled: true }));
        const messageThreadId = options.messageThreadId ?? this.defaultMessageThreadId;
        if (messageThreadId != null)
            body.set("message_thread_id", String(messageThreadId));
        if (options.replyToMessageId != null)
            body.set("reply_parameters", JSON.stringify({ message_id: options.replyToMessageId }));
        return this.request("sendMessage", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body,
        });
    }
    async sendPhoto(options) {
        const body = new FormData();
        body.set("chat_id", String(this.chatId));
        body.set("parse_mode", "HTML");
        const silent = options.silent ?? this.defaultSilent;
        if (silent)
            body.set("disable_notification", "true");
        const messageThreadId = options.messageThreadId ?? this.defaultMessageThreadId;
        if (messageThreadId != null)
            body.set("message_thread_id", String(messageThreadId));
        if (options.replyToMessageId != null)
            body.set("reply_parameters", JSON.stringify({ message_id: options.replyToMessageId }));
        const caption = resolveOptionalHtmlContent({ text: options.captionText, html: options.captionHtml });
        if (caption)
            body.set("caption", caption);
        const photoPart = await resolvePhotoInput(options.photo, {
            fileName: options.fileName,
            mimeType: options.mimeType,
        });
        if (typeof photoPart === "string") {
            body.set("photo", photoPart);
        }
        else {
            body.set("photo", photoPart.blob, photoPart.fileName);
        }
        return this.request("sendPhoto", {
            method: "POST",
            body,
        });
    }
    async request(method, init) {
        const response = await this.fetchImpl(apiUrl(this.botToken, method), init);
        const data = (await response.json());
        if (!response.ok || !data.ok) {
            const failure = data;
            throw new TelegramNotifierError(failure.description ?? `Telegram API request failed for ${method}`, {
                status: response.status,
                errorCode: failure.error_code,
                description: failure.description,
            });
        }
        return data.result;
    }
}
export function escapeTelegramHtml(input) {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;");
}
function normalizeMessageInput(input) {
    return typeof input === "string" ? { text: input } : input;
}
function resolveHtmlContent(input) {
    const value = resolveOptionalHtmlContent(input);
    if (!value) {
        throw new Error("Provide exactly one of text or html");
    }
    return value;
}
function resolveOptionalHtmlContent(input) {
    const hasText = input.text != null;
    const hasHtml = input.html != null;
    if (hasText && hasHtml) {
        throw new Error("Provide either text or html, not both");
    }
    if (hasHtml)
        return input.html;
    if (hasText)
        return plainTextToTelegramHtml(input.text ?? "");
    return undefined;
}
function plainTextToTelegramHtml(input) {
    return escapeTelegramHtml(input).replace(/\r?\n/g, "<br>");
}
async function resolvePhotoInput(input, options) {
    if (input instanceof URL)
        return input.toString();
    if (typeof input === "string") {
        if (isHttpUrl(input))
            return input;
        const file = await readFile(input);
        return {
            blob: new Blob([file], { type: options.mimeType ?? inferMimeTypeFromName(input) }),
            fileName: options.fileName ?? basename(input),
        };
    }
    if (isPathInput(input)) {
        const file = await readFile(input.path);
        return {
            blob: new Blob([file], { type: input.mimeType ?? options.mimeType ?? inferMimeTypeFromName(input.path) }),
            fileName: input.fileName ?? options.fileName ?? basename(input.path),
        };
    }
    if (input instanceof Blob) {
        return {
            blob: input,
            fileName: options.fileName ?? "image",
        };
    }
    const uint8 = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
    return {
        blob: new Blob([arrayBuffer], { type: options.mimeType ?? "application/octet-stream" }),
        fileName: options.fileName ?? "image",
    };
}
function isHttpUrl(value) {
    return /^https?:\/\//i.test(value);
}
function isPathInput(value) {
    return typeof value === "object" && value !== null && "path" in value;
}
function inferMimeTypeFromName(name) {
    const lower = name.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
        return "image/jpeg";
    if (lower.endsWith(".png"))
        return "image/png";
    if (lower.endsWith(".gif"))
        return "image/gif";
    if (lower.endsWith(".webp"))
        return "image/webp";
    return "application/octet-stream";
}
function apiUrl(botToken, method) {
    return `https://api.telegram.org/bot${botToken}/${method}`;
}
//# sourceMappingURL=index.js.map