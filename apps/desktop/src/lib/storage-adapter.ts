import { AppData, SQLITE_SCHEMA_VERSION, StorageAdapter, TaskQueryOptions, useTaskStore, type Task } from '@mindwtr/core';
import { invoke } from '@tauri-apps/api/core';
import { logInfo, logWarn } from './app-log';
import { reportError } from './report-error';
import { markLocalSqliteWrite, markLocalWrite } from './local-data-watcher';

const STORAGE_SCHEMA_VERSION_KEY = 'mindwtr-storage-schema-version';
let storageInitLogged = false;
let saveQueue: Promise<void> = Promise.resolve();

// #913: save_data (and save_task, the same shape) can hang indefinitely
// without ever rejecting, so the normal catch block never fires and the UI
// looks fine while edits sit unsaved. This only observes and surfaces that
// through the store's error channel — it must never alter save/retry
// semantics (see the handoff's Do NOT list).
const SAVE_STUCK_WARNING_MS = 15_000;

const buildStuckSaveMessage = (label: string): string => (
    `${label} has not completed after ${SAVE_STUCK_WARNING_MS / 1000}s. `
    + 'Recent changes may not be saved yet.'
);

const setStorageWarning = (message: string | null) => {
    try {
        useTaskStore.getState().setError(message);
    } catch {
        // Store not initialized yet (e.g. very early startup); nothing to surface.
    }
};

// Shared by saveData and saveTask: runs `run`, surfacing a store warning if it
// hasn't settled after SAVE_STUCK_WARNING_MS, and clearing that warning (and
// only that warning) once it does. Observation only — never rejects, cancels,
// or retries `run` itself.
const withStuckSaveWarning = async <T>(command: string, label: string, run: () => Promise<T>): Promise<T> => {
    let stuckMessage: string | null = null;
    const stuckTimer = setTimeout(() => {
        stuckMessage = buildStuckSaveMessage(label);
        void logWarn(`${command} invoke has not completed`, {
            scope: 'storage',
            extra: { thresholdMs: SAVE_STUCK_WARNING_MS },
        });
        setStorageWarning(stuckMessage);
    }, SAVE_STUCK_WARNING_MS);
    try {
        return await run();
    } finally {
        clearTimeout(stuckTimer);
        // Only clear our own warning — never clobber an unrelated error that
        // may have been set (by the catch below, or elsewhere) in the meantime.
        if (stuckMessage) {
            try {
                if (useTaskStore.getState().error === stuckMessage) {
                    setStorageWarning(null);
                }
            } catch {
                // Store not initialized; nothing to clear.
            }
        }
    }
};

const enqueueSave = (operation: () => Promise<void>): Promise<void> => {
    const run = saveQueue.catch(() => undefined).then(operation);
    saveQueue = run;
    return run;
};

const invokeWithError = async <T>(
    action: string,
    command: string,
    args?: Record<string, unknown>
): Promise<T> => {
    try {
        return await invoke<T>(command as any, args as any);
    } catch (error) {
        reportError(`Failed to ${action}`, error, { category: 'storage', scope: 'storage' });
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to ${action}: ${detail}`);
    }
};

const logStorageInitIfNeeded = () => {
    if (storageInitLogged) return;
    storageInitLogged = true;
    const schemaVersion = String(SQLITE_SCHEMA_VERSION);
    try {
        const previousSchemaVersion = localStorage.getItem(STORAGE_SCHEMA_VERSION_KEY);
        if (previousSchemaVersion && previousSchemaVersion !== schemaVersion) {
            void logInfo('Schema migration', {
                scope: 'storage',
                extra: { from: previousSchemaVersion, to: schemaVersion },
            });
        }
        localStorage.setItem(STORAGE_SCHEMA_VERSION_KEY, schemaVersion);
    } catch (error) {
        // Local schema-version bookkeeping is best-effort only.
        void error;
    }
    void logInfo('Storage init complete', {
        scope: 'storage',
        extra: {
            storageType: 'sqlite',
            schemaVersion,
        },
    });
};

export const tauriStorage: StorageAdapter = {
    getData: async (): Promise<AppData> => {
        try {
            const data = await invoke<AppData>('get_data' as any);
            logStorageInitIfNeeded();
            return data;
        } catch (error) {
            try {
                const data = await invoke<AppData>('read_data_json' as any);
                void logWarn('getData fallback triggered', {
                    scope: 'storage',
                    extra: {
                        fallback: 'data_json',
                        error: error instanceof Error ? error.message : String(error),
                    },
                });
                logStorageInitIfNeeded();
                return data;
            } catch {
                reportError('getData failure', error, { category: 'storage', scope: 'storage' });
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to load data: ${detail}`);
            }
        }
    },
    saveData: async (data: AppData): Promise<void> => enqueueSave(() => withStuckSaveWarning('save_data', 'Save', async () => {
        markLocalWrite(data);
        markLocalSqliteWrite();
        try {
            await invoke<void>('save_data' as any, { data } as any);
            markLocalSqliteWrite();
            logStorageInitIfNeeded();
        } catch (error) {
            reportError('saveData failure', error, { category: 'storage', scope: 'storage' });
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save data: ${detail}`);
        }
    })),
    saveTask: async (task: Task): Promise<void> => enqueueSave(() => withStuckSaveWarning('save_task', 'Task save', async () => {
        markLocalSqliteWrite();
        try {
            await invoke<void>('save_task' as any, { task } as any);
            markLocalSqliteWrite();
            logStorageInitIfNeeded();
        } catch (error) {
            reportError('saveTask failure', error, { category: 'storage', scope: 'storage' });
            const detail = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save task: ${detail}`);
        }
    })),
    queryTasks: async (options: TaskQueryOptions) => {
        return invokeWithError('query tasks', 'query_tasks', { options });
    },
    searchAll: async (query: string) => {
        return invokeWithError('search', 'search_fts', { query });
    },
};
