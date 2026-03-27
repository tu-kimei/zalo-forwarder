import { config } from '../../config';
import { logger } from '../../lib/logger';

const BASE_URL = `https://api.telegram.org/bot${config.telegram.botToken}`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: InlineKeyboardMarkup;
  disable_web_page_preview?: boolean;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: { id: number; first_name: string };
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function callApi<T>(method: string, body?: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as TelegramApiResponse<T>;

    if (!json.ok) {
      logger.error(`Telegram API error [${method}]`, {
        error_code: json.error_code,
        description: json.description,
      });
      return null;
    }

    return json.result ?? null;
  } catch (err) {
    logger.error(`Telegram API fetch error [${method}]`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ─── Public Methods ──────────────────────────────────────────────────────────

/**
 * Send a text message.
 */
export async function sendMessage(
  chatId: string | number,
  text: string,
  options?: SendMessageOptions,
): Promise<TelegramMessage | null> {
  return callApi<TelegramMessage>('sendMessage', {
    chat_id: chatId,
    text,
    ...options,
  });
}

/**
 * Send a photo with optional caption and inline keyboard.
 */
export async function sendPhoto(
  chatId: string | number,
  photo: string, // URL or file_id
  caption?: string,
  options?: Omit<SendMessageOptions, 'disable_web_page_preview'>,
): Promise<TelegramMessage | null> {
  // Telegram sendPhoto returns a Message with photo field
  return callApi<TelegramMessage>('sendPhoto', {
    chat_id: chatId,
    photo,
    caption,
    ...options,
  });
}

/**
 * Answer a callback query (acknowledge button press).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<boolean> {
  const result = await callApi<boolean>('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  });
  return result === true;
}

/**
 * Edit the reply markup (e.g. remove inline buttons) of a message.
 */
export async function editMessageReplyMarkup(
  chatId: string | number,
  messageId: number,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<TelegramMessage | null> {
  return callApi<TelegramMessage>('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup ?? { inline_keyboard: [] },
  });
}

/**
 * Edit message text (replace content).
 */
export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  options?: SendMessageOptions,
): Promise<TelegramMessage | null> {
  return callApi<TelegramMessage>('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...options,
  });
}

/**
 * Edit message caption (for photo messages).
 */
export async function editMessageCaption(
  chatId: string | number,
  messageId: number,
  caption: string,
  options?: Omit<SendMessageOptions, 'disable_web_page_preview'>,
): Promise<TelegramMessage | null> {
  return callApi<TelegramMessage>('editMessageCaption', {
    chat_id: chatId,
    message_id: messageId,
    caption,
    ...options,
  });
}

/**
 * Get updates (long polling).
 */
export async function getUpdates(
  offset?: number,
  timeout = 30,
): Promise<TelegramUpdate[]> {
  const result = await callApi<TelegramUpdate[]>('getUpdates', {
    offset,
    timeout,
    allowed_updates: ['callback_query'],
  });
  return result ?? [];
}

/**
 * Get bot info (for status check).
 */
export async function getMe(): Promise<{ id: number; first_name: string; username?: string } | null> {
  return callApi<{ id: number; first_name: string; username?: string }>('getMe');
}

/**
 * Delete webhook (needed before using getUpdates polling).
 */
export async function deleteWebhook(): Promise<boolean> {
  const result = await callApi<boolean>('deleteWebhook', { drop_pending_updates: false });
  return result === true;
}
