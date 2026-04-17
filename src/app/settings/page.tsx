import { getSettings } from '@/lib/settings';
import SettingsForm from './SettingsForm';
import { hasTelegram } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const settings = getSettings();
  const tgConfigured = hasTelegram();

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Operational preferences. Changes take effect immediately.</p>
      </div>
      <SettingsForm initial={settings} telegramConfigured={tgConfigured} />
    </div>
  );
}
