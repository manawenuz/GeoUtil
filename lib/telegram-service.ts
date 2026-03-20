/**
 * Telegram Bot API Service
 *
 * Handles sending messages and managing webhooks via the Telegram Bot API.
 * No external dependencies — uses axios (already in project).
 */

import axios from 'axios';

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string; username?: string };
    message?: { chat: { id: number; type: string } };
    data?: string;
  };
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export class TelegramService {
  private apiBase: string;

  constructor(botToken: string) {
    this.apiBase = `https://api.telegram.org/bot${botToken}`;
  }

  async sendMessage(chatId: string, text: string, parseMode: 'HTML' | 'MarkdownV2' = 'HTML'): Promise<boolean> {
    try {
      await axios.post(`${this.apiBase}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }, { timeout: 10000 });
      return true;
    } catch (error) {
      console.error('Telegram sendMessage failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  async sendMessageWithKeyboard(
    chatId: string,
    text: string,
    keyboard: InlineKeyboardButton[][],
    parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
  ): Promise<boolean> {
    try {
      await axios.post(`${this.apiBase}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        reply_markup: { inline_keyboard: keyboard },
      }, { timeout: 10000 });
      return true;
    } catch (error) {
      console.error('Telegram sendMessageWithKeyboard failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  async answerCallbackQuery(callbackQueryId: string): Promise<boolean> {
    try {
      await axios.post(`${this.apiBase}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
      }, { timeout: 10000 });
      return true;
    } catch (error) {
      console.error('Telegram answerCallbackQuery failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  async setWebhook(url: string, secret?: string): Promise<boolean> {
    try {
      const params: Record<string, string> = { url };
      if (secret) params.secret_token = secret;
      const res = await axios.post(`${this.apiBase}/setWebhook`, params, { timeout: 10000 });
      return res.data?.ok === true;
    } catch (error) {
      console.error('Telegram setWebhook failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  async deleteWebhook(): Promise<boolean> {
    try {
      const res = await axios.post(`${this.apiBase}/deleteWebhook`, {}, { timeout: 10000 });
      return res.data?.ok === true;
    } catch (error) {
      console.error('Telegram deleteWebhook failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  parseCommand(text: string): { command: string; args: string } {
    const trimmed = text.trim();
    if (!trimmed.startsWith('/')) {
      return { command: '', args: trimmed };
    }
    const spaceIndex = trimmed.indexOf(' ');
    const rawCommand = spaceIndex === -1 ? trimmed : trimmed.substring(0, spaceIndex);
    const command = rawCommand.split('@')[0].substring(1).toLowerCase();
    const args = spaceIndex === -1 ? '' : trimmed.substring(spaceIndex + 1).trim();
    return { command, args };
  }

  formatBalanceNotification(
    providerName: string,
    providerType: string,
    balance: number,
    currency: string = 'GEL',
  ): string {
    const icon = providerType === 'gas' ? '🔥' : providerType === 'electricity' ? '⚡' : '📊';
    const emoji = balance > 0 ? '⚠️' : '✅';
    return [
      `${emoji} <b>${providerName}</b> ${icon}`,
      ``,
      `Balance: <b>${balance.toFixed(2)} ${currency}</b>`,
      balance > 0 ? `\nPlease pay your bill to avoid service interruption.` : `\nNo outstanding balance.`,
    ].join('\n');
  }
}
