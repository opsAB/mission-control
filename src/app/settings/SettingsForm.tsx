'use client';

import { useState } from 'react';
import type { Settings } from '@/lib/settings';

interface Props {
  initial: Settings;
  telegramConfigured: boolean;
}

export default function SettingsForm({ initial, telegramConfigured }: Props) {
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS(prev => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function testTelegram() {
    const res = await fetch('/api/settings/test-telegram', { method: 'POST' });
    const data = await res.json();
    alert(data.ok ? 'Test message sent. Check Telegram.' : `Failed: ${data.error ?? 'unknown'}`);
  }

  return (
    <div className="space-y-6">
      <Section title="Mission">
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">Mission Statement</span>
          <textarea
            rows={3}
            value={s.mission_statement}
            onChange={e => update('mission_statement', e.target.value)}
            placeholder="One sentence. What are we building toward? Alfred can draft this for you."
            className="mt-1 w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
          />
        </label>
      </Section>

      <Section title="Attention Pings">
        <label className="block">
          <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">Threshold</span>
          <select
            value={s.attention_threshold}
            onChange={e => update('attention_threshold', e.target.value as Settings['attention_threshold'])}
            className="mt-1 w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm"
          >
            <option value="blocked_review_only">Blocked / review-needed only (recommended)</option>
            <option value="plus_thinking">+ periodic thinking updates</option>
            <option value="plus_curiosity">+ curiosity pings (loud)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            checked={s.only_main_pings}
            onChange={e => update('only_main_pings', e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          <span className="text-sm">Only Alfred can ping me directly (specialists route through Alfred)</span>
        </label>
      </Section>

      <Section title="Telegram Bridge">
        <div className="text-xs text-[var(--color-text-muted)] mb-3">
          Status: {telegramConfigured ? <span className="text-emerald-400">bot token detected from OpenClaw config</span> : <span className="text-red-400">no bot token found</span>}
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={s.telegram_enabled}
            onChange={e => update('telegram_enabled', e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          <span className="text-sm">Send alerts and digests to Telegram</span>
        </label>
        <label className="block mt-3">
          <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">Chat ID</span>
          <input
            type="text"
            value={s.telegram_chat_id}
            onChange={e => update('telegram_chat_id', e.target.value)}
            className="mt-1 w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm font-mono"
          />
        </label>
        <button
          onClick={testTelegram}
          className="mt-3 px-3 py-1.5 text-xs font-medium bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:border-[var(--color-border-light)]"
        >
          Send test message
        </button>
      </Section>

      <Section title="Daily Digest">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={s.digest_enabled}
            onChange={e => update('digest_enabled', e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          <span className="text-sm">Auto-compile daily digest</span>
        </label>
        <label className="block mt-3">
          <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">Delivery time (local)</span>
          <input
            type="time"
            value={s.digest_time}
            onChange={e => update('digest_time', e.target.value)}
            className="mt-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm font-mono"
          />
        </label>
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved.</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-5">
      <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </section>
  );
}
