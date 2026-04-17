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

export async function sendTelegram(text: string, chatIdOverride?: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN || getMainBotToken();
  if (!token) return false;
  const settings = getSettings();
  if (!settings.telegram_enabled) return false;
  const chatId = chatIdOverride ?? settings.telegram_chat_id;
  if (!chatId) return false;

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
    if (!res.ok) {
      console.error('Telegram send failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Telegram send error:', e);
    return false;
  }
}

export function hasTelegram(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN || getMainBotToken());
}
