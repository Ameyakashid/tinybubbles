import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const appLogMocks = vi.hoisted(() => ({
    clearLog: vi.fn(),
    ensureLogFilePath: vi.fn(),
    logInfo: vi.fn(),
}));

const sharingMocks = vi.hoisted(() => ({
    isAvailableAsync: vi.fn(),
    shareAsync: vi.fn(),
}));

const coreMocks = vi.hoisted(() => ({
    getInMemoryAppDataSnapshot: vi.fn(),
}));

vi.mock('@mindwtr/core', async (importOriginal) => ({
    ...await importOriginal<typeof import('@mindwtr/core')>(),
    getInMemoryAppDataSnapshot: coreMocks.getInMemoryAppDataSnapshot,
}));

vi.mock('react-native', () => ({
    Alert: { alert: vi.fn() },
}));

vi.mock('expo-constants', () => ({
    default: { expoConfig: { extra: {} } },
}));

vi.mock('expo-sharing', () => sharingMocks);

vi.mock('@/lib/app-log', () => appLogMocks);

vi.mock('@/lib/settings-utils', () => ({
    logSettingsError: vi.fn(),
}));

vi.mock('@/lib/data-transfer', () => ({
    exportCurrentDataBackup: vi.fn(),
    importDgtData: vi.fn(),
    importMindwtrCsvData: vi.fn(),
    importOmniFocusData: vi.fn(),
    importTickTickData: vi.fn(),
    importTodoistData: vi.fn(),
    inspectBackupDocument: vi.fn(),
    inspectDgtDocument: vi.fn(),
    inspectMindwtrCsvDocument: vi.fn(),
    inspectOmniFocusDocument: vi.fn(),
    inspectTickTickDocument: vi.fn(),
    inspectTodoistDocument: vi.fn(),
    mergeDataFromBackup: vi.fn(),
    pickBackupDocument: vi.fn(),
    pickDgtDocument: vi.fn(),
    pickMindwtrCsvDocument: vi.fn(),
    pickOmniFocusDocument: vi.fn(),
    pickTickTickDocument: vi.fn(),
    pickTodoistDocument: vi.fn(),
    restoreDataFromBackup: vi.fn(),
    restoreLocalDataSnapshot: vi.fn(),
}));

import { Alert } from 'react-native';

import * as dataTransfer from '@/lib/data-transfer';
import { useSyncSettingsBackupActions } from './use-sync-settings-backup-actions';

type HookResult = ReturnType<typeof useSyncSettingsBackupActions>;

describe('useSyncSettingsBackupActions', () => {
    let latest: HookResult | null = null;
    const showToast = vi.fn();
    const showSettingsErrorToast = vi.fn();

    function Harness() {
        latest = useSyncSettingsBackupActions({
            refreshRecoverySnapshots: vi.fn(),
            settings: {},
            setBackupAction: vi.fn(),
            showSettingsErrorToast,
            showSettingsWarning: vi.fn(),
            showToast,
            t: (key: string) => key,
            tr: (key: string) => key,
            updateSettings: vi.fn().mockResolvedValue(undefined),
        });
        return null;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        latest = null;
        appLogMocks.ensureLogFilePath.mockResolvedValue('file://logs/mindwtr.log');
        sharingMocks.isAvailableAsync.mockResolvedValue(true);
        sharingMocks.shareAsync.mockResolvedValue(undefined);
        coreMocks.getInMemoryAppDataSnapshot.mockReturnValue({
            tasks: [], projects: [], sections: [], areas: [], people: [], settings: {},
        });
    });

    it('exports the authoritative in-memory snapshot at press time', async () => {
        const snapshot = {
            tasks: [{ id: 'deleted-task', deleted: true, attachments: [{ id: 'deleted-file', deleted: true }] }],
            projects: [],
            sections: [],
            areas: [],
            people: [{ id: 'person-1', name: 'Ada' }],
            settings: { theme: 'dark' },
        };
        coreMocks.getInMemoryAppDataSnapshot.mockReturnValue(snapshot);

        await act(async () => {
            create(<Harness />);
        });
        await latest?.handleBackup();

        expect(coreMocks.getInMemoryAppDataSnapshot).toHaveBeenCalledTimes(1);
        expect(dataTransfer.exportCurrentDataBackup).toHaveBeenCalledWith(snapshot);
    });

    it('shows a warning instead of rejecting when Expo Go sharing fails', async () => {
        sharingMocks.isAvailableAsync.mockRejectedValue(new TypeError("Cannot read property 'replace' of undefined"));

        await act(async () => {
            create(<Harness />);
        });

        await expect(latest?.handleShareLog()).resolves.toBeUndefined();
        expect(showToast).toHaveBeenCalledWith({
            title: 'settings.debugLogging',
            message: 'settings.shareUnavailable',
            tone: 'warning',
        });
        expect(showSettingsErrorToast).not.toHaveBeenCalled();
    });

    it('shares the diagnostics log when sharing is available', async () => {
        await act(async () => {
            create(<Harness />);
        });

        await latest?.handleShareLog();

        expect(sharingMocks.shareAsync).toHaveBeenCalledWith('file://logs/mindwtr.log', { mimeType: 'text/plain' });
        expect(showToast).not.toHaveBeenCalled();
    });

    it('merges a backup only after the confirmation is accepted, and reports what changed', async () => {
        const backupData = { tasks: [], projects: [], sections: [], areas: [], settings: {} };
        vi.mocked(dataTransfer.pickBackupDocument).mockResolvedValue({ uri: 'file://backup.json', fileName: 'backup.json' });
        vi.mocked(dataTransfer.inspectBackupDocument).mockResolvedValue({
            valid: true,
            data: backupData,
            errors: [],
            warnings: [],
            metadata: { taskCount: 3, projectCount: 1 },
        } as unknown as Awaited<ReturnType<typeof dataTransfer.inspectBackupDocument>>);
        vi.mocked(dataTransfer.mergeDataFromBackup).mockResolvedValue({
            snapshotName: 'data.snapshot.json',
            result: { stats: { tasks: { incomingOnly: 2, resolvedUsingIncoming: 3 } } },
        } as unknown as Awaited<ReturnType<typeof dataTransfer.mergeDataFromBackup>>);

        await act(async () => {
            create(<Harness />);
        });
        await latest?.handleMergeBackup();

        // Nothing is written until the user accepts the confirmation.
        expect(dataTransfer.mergeDataFromBackup).not.toHaveBeenCalled();
        const [title, , buttons] = vi.mocked(Alert.alert).mock.calls[0] as [string, string, Array<{ onPress?: () => void }>];
        expect(title).toBe('settings.mergeBackup');

        await act(async () => {
            buttons[1].onPress?.();
        });

        expect(dataTransfer.mergeDataFromBackup).toHaveBeenCalledWith(backupData);
        expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
            title: 'settings.mergeBackup',
            tone: 'success',
        }));
        expect(dataTransfer.restoreDataFromBackup).not.toHaveBeenCalled();
    });
});
