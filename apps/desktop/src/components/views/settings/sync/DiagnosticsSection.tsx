import { Info } from 'lucide-react';
import { Switch } from '../../../ui/Switch';
import { SettingRow } from '../SettingRow';
import type { SettingsDataPageProps } from './types';

type DiagnosticsSectionProps = Pick<
    SettingsDataPageProps,
    | 't'
    | 'analyticsHeartbeatAvailable'
    | 'analyticsHeartbeatEnabled'
    | 'loggingEnabled'
    | 'logPath'
    | 'onAnalyticsHeartbeatChange'
    | 'onToggleLogging'
    | 'onClearLog'
>;

export function DiagnosticsSection({
    analyticsHeartbeatAvailable,
    analyticsHeartbeatEnabled,
    logPath,
    loggingEnabled,
    onAnalyticsHeartbeatChange,
    onClearLog,
    onToggleLogging,
    t,
}: DiagnosticsSectionProps) {
    const analyticsHeartbeatOptedOut = analyticsHeartbeatAvailable && !analyticsHeartbeatEnabled;
    const toggleAnalyticsHeartbeatOptOut = () => {
        const nextOptedOut = !analyticsHeartbeatOptedOut;
        void onAnalyticsHeartbeatChange(!nextOptedOut);
    };

    return (
        <section className="space-y-3">
            <h2 data-settings-key="diagnostics" className="text-lg font-semibold flex items-center gap-2">
                <Info className="w-5 h-5" />
                {t.diagnostics}
            </h2>
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <p className="text-sm text-muted-foreground">{t.diagnosticsDesc}</p>
                {analyticsHeartbeatAvailable && (
                    <SettingRow
                        settingsKey="analyticsHeartbeat"
                        title={t.analyticsHeartbeat}
                        description={t.analyticsHeartbeatDesc}
                    >
                        <Switch
                            aria-label={t.analyticsHeartbeat}
                            checked={analyticsHeartbeatOptedOut}
                            onCheckedChange={toggleAnalyticsHeartbeatOptOut}
                        />
                    </SettingRow>
                )}
                <SettingRow
                    settingsKey="debugLogging"
                    title={t.debugLogging}
                    description={t.debugLoggingDesc}
                >
                    <Switch
                        aria-label={t.debugLogging}
                        checked={loggingEnabled}
                        onCheckedChange={onToggleLogging}
                    />
                </SettingRow>
                {loggingEnabled && logPath && (
                    <div data-settings-key="logFile" className="text-xs text-muted-foreground">
                        <span className="font-medium">{t.logFile}:</span>{' '}
                        <span className="font-mono break-all">{logPath}</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onClearLog}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors"
                    >
                        {t.clearLog}
                    </button>
                </div>
            </div>
        </section>
    );
}
