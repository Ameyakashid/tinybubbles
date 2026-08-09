import { ExternalLink, RefreshCw } from 'lucide-react';
import type { SettingsDataPageProps } from './types';

type DataTransferSectionProps = Pick<
    SettingsDataPageProps,
    | 't'
    | 'transferAction'
    | 'onExportBackup'
    | 'onRestoreBackup'
    | 'onMergeBackup'
    | 'onImportTodoist'
    | 'onImportTickTick'
    | 'onImportDgt'
    | 'onImportOmniFocus'
    | 'onImportMindwtrCsv'
    | 'onAddGettingStartedContent'
>;

function TransferActionButton({
    description,
    label,
    onClick,
    settingsKey,
    statusText,
    disabled,
}: {
    description: string;
    label: string;
    onClick: () => void;
    settingsKey?: string;
    statusText?: string | null;
    disabled: boolean;
}) {
    return (
        <button
            type="button"
            data-settings-key={settingsKey}
            onClick={onClick}
            disabled={disabled}
            className="flex w-full items-center justify-between gap-4 px-1 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
            <div>
                <div className="text-sm font-medium text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            <div className="text-xs text-muted-foreground">{statusText}</div>
        </button>
    );
}

export function DataTransferSection({
    onExportBackup,
    onImportDgt,
    onImportMindwtrCsv,
    onImportOmniFocus,
    onImportTickTick,
    onImportTodoist,
    onMergeBackup,
    onRestoreBackup,
    onAddGettingStartedContent,
    t,
    transferAction,
}: DataTransferSectionProps) {
    const disabled = transferAction !== null;

    return (
        <section className="space-y-3">
            <h2 data-settings-key="dataTransfer" className="text-lg font-semibold flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                {t.dataTransfer}
            </h2>
            <div className="space-y-3">
                <a
                    href="https://docs.mindwtr.app/import/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                    Import guide
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <p className="text-sm text-muted-foreground">{t.dataTransferDesc}</p>
                <div className="divide-y divide-border border-y border-border">
                    <TransferActionButton
                        disabled={disabled}
                        settingsKey="exportBackup"
                        label={t.exportBackup}
                        description={t.exportBackupDesc}
                        statusText={transferAction === 'export' ? t.syncing : null}
                        onClick={() => void onExportBackup()}
                    />
                    <TransferActionButton
                        disabled={disabled}
                        settingsKey="restoreBackup"
                        label={t.restoreBackup}
                        description={t.restoreBackupDesc}
                        statusText={transferAction === 'restore' ? t.syncing : null}
                        onClick={() => void onRestoreBackup()}
                    />
                    <TransferActionButton
                        disabled={disabled}
                        settingsKey="mergeBackup"
                        label={t.mergeBackup}
                        description={t.mergeBackupDesc}
                        statusText={transferAction === 'merge' ? t.syncing : null}
                        onClick={() => void onMergeBackup()}
                    />
                    <TransferActionButton
                        disabled={disabled}
                        label="Add Getting Started content"
                        description="Create or restore the guided setup project and sample inbox items."
                        statusText={null}
                        onClick={() => void onAddGettingStartedContent()}
                    />
                    <TransferActionButton
                        disabled={disabled}
                        settingsKey="importTodoist"
                        label={t.importTodoist}
                        description={t.importTodoistDesc}
                        statusText={transferAction === 'import' ? t.syncing : null}
                        onClick={() => void onImportTodoist()}
                    />
                    <TransferActionButton
                        disabled={disabled}
                        settingsKey="importTickTick"
                        label={t.importTickTick}
                        description={t.importTickTickDesc}
                        statusText={transferAction === 'import' ? t.syncing : null}
                        onClick={() => void onImportTickTick()}
                    />
                    <TransferActionButton
                        disabled={disabled}
                        settingsKey="importDgt"
                        label={t.importDgt}
                        description={t.importDgtDesc}
                        statusText={transferAction === 'import' ? t.syncing : null}
                        onClick={() => void onImportDgt()}
                    />
                    <TransferActionButton
                        disabled={disabled}
                        settingsKey="importOmniFocus"
                        label={t.importOmniFocus}
                        description={t.importOmniFocusDesc}
                        statusText={transferAction === 'import' ? t.syncing : null}
                        onClick={() => void onImportOmniFocus()}
                    />
                    <TransferActionButton
                        disabled={disabled}
                        settingsKey="importMindwtrCsv"
                        label={t.importMindwtrCsv}
                        description={t.importMindwtrCsvDesc}
                        statusText={transferAction === 'import' ? t.syncing : null}
                        onClick={() => void onImportMindwtrCsv()}
                    />
                </div>
            </div>
        </section>
    );
}
