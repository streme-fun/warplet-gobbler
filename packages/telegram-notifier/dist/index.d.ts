export type FetchLike = typeof fetch;
export type ChatId = string | number;
export type MessageInput = string | SendMessageOptions;
export type SendMessageOptions = {
    text?: string;
    html?: string;
    silent?: boolean;
    messageThreadId?: number;
    replyToMessageId?: number;
    disableLinkPreview?: boolean;
};
export type PhotoInput = string | URL | Uint8Array | ArrayBuffer | Blob | {
    path: string;
    fileName?: string;
    mimeType?: string;
};
export type SendPhotoOptions = {
    photo: PhotoInput;
    captionText?: string;
    captionHtml?: string;
    fileName?: string;
    mimeType?: string;
    silent?: boolean;
    messageThreadId?: number;
    replyToMessageId?: number;
};
export type TelegramNotifierConfig = {
    botToken: string;
    chatId: ChatId;
    defaultMessageThreadId?: number;
    defaultSilent?: boolean;
    fetch?: FetchLike;
};
export type TelegramMessage = {
    message_id: number;
    chat?: {
        id: number | string;
        type?: string;
        title?: string;
    };
    text?: string;
    caption?: string;
};
export type TelegramApiSuccess<T> = {
    ok: true;
    result: T;
};
export type TelegramApiFailure = {
    ok: false;
    error_code?: number;
    description?: string;
};
export declare class TelegramNotifierError extends Error {
    readonly status?: number;
    readonly errorCode?: number;
    readonly description?: string;
    constructor(message: string, opts?: {
        status?: number;
        errorCode?: number;
        description?: string;
    });
}
export declare function createTelegramNotifier(config: TelegramNotifierConfig): TelegramNotifier;
export declare class TelegramNotifier {
    private readonly botToken;
    private readonly chatId;
    private readonly defaultMessageThreadId?;
    private readonly defaultSilent;
    private readonly fetchImpl;
    constructor(config: TelegramNotifierConfig);
    sendMessage(input: MessageInput): Promise<TelegramMessage>;
    sendPhoto(options: SendPhotoOptions): Promise<TelegramMessage>;
    private request;
}
export declare function escapeTelegramHtml(input: string): string;
//# sourceMappingURL=index.d.ts.map