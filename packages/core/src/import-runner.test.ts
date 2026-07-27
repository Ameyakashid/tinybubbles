import { describe, expect, it } from 'vitest';

import { runImport, type DataTransferBoundaries, type ImportRunnerLog } from './import-runner';
import { mockAppData } from './sync-test-utils';
import type { ParsedTodoistProject } from './todoist-import';
import type { AppData } from './types';

// import-runner.ts had zero test coverage before this task despite dispatching five
// different importers through one shared table. These tests exercise the dispatch/log/error
// plumbing itself (each importer's own business logic is covered by its own *-import.test.ts)
// and, just as importantly, prove the type-level refactor (keying IMPORT_DESCRIPTORS off
// ImportTypeMap instead of `unknown`) didn't change runtime behaviour.

const buildBoundaries = (currentData: AppData) => {
    const persisted: AppData[] = [];
    let refreshed = 0;
    const boundaries: DataTransferBoundaries = {
        flushPendingSave: async () => undefined,
        getCurrentChangeAt: () => 1,
        readCurrentData: async () => currentData,
        createRecoverySnapshot: async () => 'snapshot-1',
        persistData: async (data) => {
            persisted.push(data);
        },
        refreshData: async () => {
            refreshed += 1;
        },
    };
    return { boundaries, persisted, refreshedCount: () => refreshed };
};

const buildLog = () => {
    const infoCalls: { message: string; context?: { extra?: Record<string, unknown>; scope?: string } }[] = [];
    const errorCalls: { error: unknown; context: { extra?: Record<string, unknown>; scope: string } }[] = [];
    const log: ImportRunnerLog = {
        logInfo: (message, context) => {
            infoCalls.push({ message, context });
        },
        logError: (error, context) => {
            errorCalls.push({ error, context });
        },
    };
    return { log, infoCalls, errorCalls };
};

describe('runImport', () => {
    it('dispatches to the backup descriptor, persists, and logs start/complete', async () => {
        const restoredData = mockAppData();
        const { boundaries, persisted, refreshedCount } = buildBoundaries(mockAppData());
        const { log, infoCalls } = buildLog();

        const { result, snapshotName } = await runImport('backup', restoredData, boundaries, log);

        expect(result.tasks).toEqual(restoredData.tasks);
        expect(snapshotName).toBe('snapshot-1');
        expect(persisted).toHaveLength(1);
        expect(refreshedCount()).toBe(1);
        expect(infoCalls.map((call) => call.message)).toEqual(['Backup restore started', 'Backup restore complete']);
        expect(infoCalls[1]?.context?.extra).toMatchObject({ operation: 'restoreBackup', source: 'backup' });
    });

    it('dispatches to the todoist descriptor and logs countExtra from the real importer result', async () => {
        const { boundaries } = buildBoundaries(mockAppData());
        const { log, infoCalls } = buildLog();
        const parsed: ParsedTodoistProject[] = [];

        const { result } = await runImport('todoist', parsed, boundaries, log);

        expect(result.importedTaskCount).toBe(0);
        // Proves countExtra reads the todoist result's own fields, not another source's
        // (e.g. ticktick's `areas` or omnifocus's `standaloneTasks`) — the class of mistake
        // that was invisible to the compiler when every descriptor entry took `unknown`.
        expect(infoCalls[1]?.context?.extra).toMatchObject({
            operation: 'importTodoist',
            tasks: '0',
            projects: '0',
            sections: '0',
            checklistItems: '0',
        });
    });

    it('logs and rethrows when the importer throws, without logging completion', async () => {
        const { boundaries } = buildBoundaries(mockAppData());
        const { log, infoCalls, errorCalls } = buildLog();
        const failingBoundaries: DataTransferBoundaries = {
            ...boundaries,
            readCurrentData: async () => {
                throw new Error('read failed');
            },
        };

        await expect(runImport('backup', mockAppData(), failingBoundaries, log)).rejects.toThrow(
            'read failed'
        );

        expect(infoCalls.map((call) => call.message)).toEqual(['Backup restore started']);
        expect(errorCalls).toHaveLength(1);
        expect(errorCalls[0]?.context).toMatchObject({ scope: 'transfer', extra: { operation: 'restoreBackup' } });
    });
});
