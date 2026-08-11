import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_IMPORT_SOURCE_LIMITS, MAX_BACKUP_SOURCE_BYTES, type AppData } from '@tinybubbles/core';
import type { ParsedTodoistProject } from '@tinybubbles/core/todoist-import';

const emptyData: AppData = {
    tasks: [],
    projects: [],
    sections: [],
    areas: [],
    people: [],
    settings: {},
};

const storageMocks = vi.hoisted(() => ({
    getData: vi.fn(),
    saveData: vi.fn(),
}));

const storeStateRef = vi.hoisted(() => ({
    current: {
        lastDataChangeAt: 1,
        fetchData: vi.fn(),
    },
}));

const coreMocks = vi.hoisted(() => ({
    flushPendingSave: vi.fn(),
    useTaskStoreGetState: vi.fn(),
}));

const logMocks = vi.hoisted(() => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
}));

const runtimeRef = vi.hoisted(() => ({ isTauri: false }));
const syncServiceMocks = vi.hoisted(() => ({
    createDataSnapshot: vi.fn(),
}));

const nativePickerMocks = vi.hoisted(() => ({
    open: vi.fn(),
    readFile: vi.fn(),
    readTextFile: vi.fn(),
    stat: vi.fn(),
}));

vi.mock('@tinybubbles/core', async () => {
    const actual = await vi.importActual<typeof import('@tinybubbles/core')>('@tinybubbles/core');
    return {
        ...actual,
        flushPendingSave: coreMocks.flushPendingSave,
        useTaskStore: {
            getState: coreMocks.useTaskStoreGetState,
        },
    };
});

vi.mock('./runtime', () => ({
    isTauriRuntime: () => runtimeRef.isTauri,
}));

vi.mock('./storage-adapter-web', () => ({
    webStorage: {
        getData: storageMocks.getData,
        saveData: storageMocks.saveData,
    },
}));

vi.mock('./storage-adapter', () => ({
    tauriStorage: {
        getData: storageMocks.getData,
        saveData: storageMocks.saveData,
    },
}));

vi.mock('./sync-service', () => ({
    SyncService: {
        createDataSnapshot: syncServiceMocks.createDataSnapshot,
    },
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: nativePickerMocks.open,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
    readFile: nativePickerMocks.readFile,
    readTextFile: nativePickerMocks.readTextFile,
    stat: nativePickerMocks.stat,
}));

vi.mock('./app-log', () => ({
    logError: logMocks.logError,
    logInfo: logMocks.logInfo,
}));

import {
    createDesktopRecoverySnapshot,
    importDesktopTodoistData,
    inspectDesktopTinyBubblesCsvImport,
    inspectDesktopBackup,
    mergeDesktopBackup,
} from './data-transfer';

const parsedProjects: ParsedTodoistProject[] = [{
    name: 'Todoist',
    sections: [],
    checklistItemCount: 0,
    recurringCount: 0,
    tasks: [{
        title: 'Imported task',
        tags: [],
        checklist: [],
    }],
}];

describe('desktop data transfer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        storeStateRef.current = {
            lastDataChangeAt: 1,
            fetchData: vi.fn().mockResolvedValue(undefined),
        };
        coreMocks.flushPendingSave.mockResolvedValue(undefined);
        coreMocks.useTaskStoreGetState.mockImplementation(() => storeStateRef.current);
        storageMocks.getData.mockResolvedValue(emptyData);
        storageMocks.saveData.mockResolvedValue(undefined);
        runtimeRef.isTauri = false;
        syncServiceMocks.createDataSnapshot.mockResolvedValue('data.snapshot.json');
        nativePickerMocks.open.mockResolvedValue('/tmp/import.csv');
        nativePickerMocks.stat.mockResolvedValue({ size: 0 });
        nativePickerMocks.readFile.mockResolvedValue(new Uint8Array());
    });

    it('aborts Todoist import when local data changes before the full snapshot write', async () => {
        storageMocks.getData.mockImplementation(async () => {
            storeStateRef.current = {
                ...storeStateRef.current,
                lastDataChangeAt: 2,
            };
            return emptyData;
        });

        await expect(importDesktopTodoistData(parsedProjects)).rejects.toMatchObject({
            name: 'LocalSyncAbort',
        });

        expect(storageMocks.saveData).not.toHaveBeenCalled();
        expect(storeStateRef.current.fetchData).not.toHaveBeenCalled();
        expect(coreMocks.flushPendingSave).toHaveBeenCalledOnce();
        expect(storageMocks.getData).toHaveBeenCalledOnce();
        expect(logMocks.logInfo).toHaveBeenCalledWith(
            'Data transfer aborted after local data changed',
            expect.objectContaining({
                scope: 'transfer',
                extra: expect.objectContaining({
                    operation: 'importTodoist',
                    snapshotChangeAt: '1',
                    currentChangeAt: '2',
                }),
            })
        );
    });

    it('persists and refreshes after a guarded Todoist import', async () => {
        const transfer = await importDesktopTodoistData(parsedProjects);

        expect(transfer.snapshotName).toBeNull();
        expect(transfer.result.importedTaskCount).toBe(1);
        expect(coreMocks.flushPendingSave).toHaveBeenCalledOnce();
        expect(storageMocks.getData).toHaveBeenCalledOnce();
        expect(storageMocks.saveData).toHaveBeenCalledWith(expect.objectContaining({
            tasks: [expect.objectContaining({ title: 'Imported task' })],
        }));
        expect(storeStateRef.current.fetchData).toHaveBeenCalledWith({ silent: true });
    });

    it('keeps local tasks when merging a backup and reports what the backup added', async () => {
        const localTask = {
            id: 'local-1',
            title: 'Local task',
            status: 'inbox' as const,
            tags: [],
            contexts: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        };
        storageMocks.getData.mockResolvedValue({ ...emptyData, tasks: [localTask] });

        const transfer = await mergeDesktopBackup({
            ...emptyData,
            tasks: [{ ...localTask, id: 'backup-1', title: 'Backup task' }],
        });

        expect(transfer.result.stats.tasks.incomingOnly).toBe(1);
        expect(storageMocks.saveData).toHaveBeenCalledWith(expect.objectContaining({
            tasks: expect.arrayContaining([
                expect.objectContaining({ id: 'local-1' }),
                expect.objectContaining({ id: 'backup-1' }),
            ]),
        }));
    });

    it('creates a native recovery snapshot after pending saves finish', async () => {
        runtimeRef.isTauri = true;

        await expect(createDesktopRecoverySnapshot()).resolves.toBe('data.snapshot.json');

        expect(coreMocks.flushPendingSave).toHaveBeenCalledOnce();
        expect(syncServiceMocks.createDataSnapshot).toHaveBeenCalledOnce();
        expect(coreMocks.flushPendingSave.mock.invocationCallOrder[0])
            .toBeLessThan(syncServiceMocks.createDataSnapshot.mock.invocationCallOrder[0]);
    });

    it('blocks a native import when the recovery snapshot cannot be created', async () => {
        runtimeRef.isTauri = true;
        syncServiceMocks.createDataSnapshot.mockResolvedValue(null);

        await expect(createDesktopRecoverySnapshot()).rejects.toThrow('Could not create a recovery snapshot');
    });

    it('rejects an oversized native import before reading it into memory', async () => {
        runtimeRef.isTauri = true;
        nativePickerMocks.stat.mockResolvedValue({
            size: DEFAULT_IMPORT_SOURCE_LIMITS.maxInputBytes + 1,
        });

        await expect(inspectDesktopTinyBubblesCsvImport()).rejects.toThrow(
            'Choose a file no larger than 16 MB',
        );

        expect(nativePickerMocks.readFile).not.toHaveBeenCalled();
    });

    it('rejects an oversized native backup before reading it into memory', async () => {
        runtimeRef.isTauri = true;
        nativePickerMocks.stat.mockResolvedValue({ size: MAX_BACKUP_SOURCE_BYTES + 1 });

        await expect(inspectDesktopBackup()).rejects.toThrow('backup file is too large');
        expect(nativePickerMocks.readTextFile).not.toHaveBeenCalled();
    });

    it('rejects a native backup whose size cannot be verified before reading', async () => {
        runtimeRef.isTauri = true;
        nativePickerMocks.stat.mockResolvedValue({});

        await expect(inspectDesktopBackup()).rejects.toThrow('could not verify the selected backup file size');
        expect(nativePickerMocks.readTextFile).not.toHaveBeenCalled();
    });
});
