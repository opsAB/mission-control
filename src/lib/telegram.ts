import fs from 'fs';
import path from 'path';
import os from 'os';
import { getSettings } from './settings';

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');

interface TelegramAccount {
  botToken?: string;
  groups?: Record<string, unknown>;
}

interface OpenClawConfig {
  channels?: {
    telegram?: {
      accounts?: Record<string, TelegramAccount>;
    };
  };
}

function getMainBotToken(): string | null {
  try {
    const raw = fs.readFileSync(path.join(OPENCLAW_HOME, 'openclaw.json'), 'utf8');
    const data = JSON.parse(raw) as OpenClawConfig;
    return data?.channels?.telegram?.accounts?.default?.botToken ?? null;
  } catch {
    return null;
  }
}

interface SendResult {
  ok: boolean;
  error?: string;
  fallback_used?: boolean;
}

export async function sendTelegramDetailed(text: string, chatIdOverride?: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN || getMainBotToken();
  if (!token) return { ok: false, error: 'No bot token found (check ~/.openclaw/openclaw.json or TELEGRAM_BOT_TOKEN)' };
  const settings = getSettings();
  if (!settings.telegram_enabled) return { ok: false, error: 'Telegram disabled in Settings' };
  const chatId = chatIdOverride ?? settings.telegram_chat_id;
  if (!chatId) return { ok: false, error: 'No telegram_chat_id set' };

  // Try with Markdown first
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    if (res.ok) return { ok: true };
    const errBody = await res.text();
    // Fallback: Telegram rejects malformed markdown with 400. Retry as plain text.
    if (res.status === 400) {
      const plain = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      });
      if (plain.ok) return { ok: true, fallback_used: true };
      const plainErr = await plain.text();
      return { ok: false, error: `Markdown: ${errBody.slice(0, 200)}; Plain: ${plainErr.slice(0, 200)}` };
    }
    return { ok: false, error: `HTTP ${res.status}: ${errBody.slice(0, 300)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendTelegram(text: string, chatIdOverride?: string): Promise<boolean> {
  const res = await sendTelegramDetailed(text, chatIdOverride);
  if (!res.ok) console.error('[telegram] send failed:', res.error);
  return res.ok;
}

export function hasTelegram(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN || getMainBotToken());
}
