import {
    type AppData,
    flushPendingSave,
    getStorageAdapter,
    getInMemoryAppDataSnapshot,
    mergeAppData,
    normalizeAppData,
    runSerializedSyncDocumentWriteOperation,
    useTaskStore,
} from '@mindwtr/core';
import { invokeNative } from './tauri-invoke';
import { getDesktopTimerHost, isTauriRuntime } from './runtime';
import { hashString, toStableJson } from './sync-service-utils';
import { logInfo, logWarn } from './app-log';

const IGNORE_WINDOW_MS = 2000;
const DEBOUNCE_MS = 750;
const IGNORE_DRAIN_PADDING_MS = 25;
const SQLITE_NOOP_REFRESH_IGNORE_MS = 2000;
const SQLITE_SELF_WRITE_RETENTION_MS = 15_000;
const SELF_WRITE_RETENTION_MS = 10_000;
const MAX_PENDING_SELF_WRITES = 8;
const MAX_MERGED_PERSIST_ATTEMPTS = 2;
const MAX_DELAYED_MERGED_PERSIST_RETRIES = 2;
const MERGED_PERSIST_RETRY_COOLDOWN_MS = 1_000;
const timerHost = getDesktopTimerHost();

type FsEvent = {
    path?: string;
    paths?: string[];
};

type LocalDataWatcherDependencies = {
    readDataJson: () => Promise<AppData>;
    refreshStorageData: () => Promise<void>;
    watchFile: (path: string, callback: (event: FsEvent) => void) => Promise<unknown>;
    now: () => number;
    schedule: typeof setTimeout;
    cancelSchedule: typeof clearTimeout;
    hashPayload: (payload: string) => Promise<string>;
    normalize: (data: AppData) => AppData;
    merge: (local: AppData, incoming: AppData) => AppData;
    getSnapshot: () => AppData;
    persistMergedData: (merged: AppData) => Promise<AppData | void>;
    logInfo: (message: string, extra?: Record<string, unknown>) => void;
    logWarn: (message: string, extra?: Record<string, unknown>) => void;
};

const persistMergedDataThroughStore = async (merged: AppData): Promise<AppData> => {
    const persisted = await getStorageAdapter().saveData(merged);
    const canonical = persisted ?? merged;
    const allTasks = Array.isArray(canonical.tasks) ? canonical.tasks : [];
    const allProjects = Array.isArray(canonical.projects) ? canonical.projects : [];
    const allSections = Array.isArray(canonical.sections) ? canonical.sections : [];
    const allAreas = Array.isArray(canonical.areas) ? canonical.areas : [];
    const allPeople = Array.isArray(canonical.people) ? canonical.people : [];

    useTaskStore.setState((state) => ({
        _allTasks: allTasks,
        _allProjects: allProjects,
        _allSections: allSections,
        _allAreas: allAreas,
        people: allPeople.filter((person) => !person.deletedAt),
        _allPeople: allPeople,
        _peopleById: new Map(allPeople.map((person) => [person.id, person] as const)),
        settings: canonical.settings ?? state.settings,
        lastDataChangeAt: Date.now(),
    }));
    return canonical;
};

const defaultDependencies: LocalDataWatcherDependencies = {
    readDataJson: () => invokeNative<AppData>('read_data_json'),
    refreshStorageData: async () => {
        await useTaskStore.getState().fetchData({ silent: true });
    },
    watchFile: async (path, callback) => {
        const { watch } = await import('@tauri-apps/plugin-fs');
        return watch(path, callback);
    },
    now: () => Date.now(),
    schedule: timerHost.setTimeout,
    cancelSchedule: timerHost.clearTimeout,
    hashPayload: hashString,
    normalize: normalizeAppData,
    merge: mergeAppData,
    getSnapshot: getInMemoryAppDataSnapshot,
    persistMergedData: persistMergedDataThroughStore,
    logInfo: (message, extra) => {
        void logInfo(message, extra ? { extra } : undefined);
    },
    logWarn: (message, extra) => {
        void logWarn(message, extra ? { extra } : undefined);
    },
};

let localDataWatcherDependencies: LocalDataWatcherDependencies = { ...defaultDependencies };
let unwatchFns: Array<() => void> = [];
let ignoreUntil = 0;
let sqliteIgnoreUntil = 0;
let sqliteSelfWriteUntil = 0;
let lastSqliteSelfWriteAt = 0;
let sqliteSuppressedSelfWriteEvents = 0;
let lastKnownHash = '';
let pendingSelfWrites: Array<{ payload: string; expiresAt: number }> = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let sqliteDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let ignoreDrainTimer: ReturnType<typeof setTimeout> | null = null;
let sqliteIgnoreDrainTimer: ReturnType<typeof setTimeout> | null = null;
let hasPendingChangeDuringIgnore = false;
let hasPendingSqliteChangeDuringSelfWrite = false;
let pendingSqliteChangePaths: string[] = [];
let pendingExternalChange = false;
let mergeInFlight: Promise<void> | null = null;
let sqliteRefreshInFlight: Promise<void> | null = null;
let mergedPersistRetryTimer: ReturnType<typeof setTimeout> | null = null;
let delayedMergedPersistRetryCount = 0;
let watcherGeneration = 0;

const normalizePathsFromEvent = (event: FsEvent): string[] => {
    if (Array.isArray(event?.paths)) return event.paths;
    if (typeof event?.path === 'string' && event.path.length > 0) return [event.path];
    return [];
};

const getPathBasename = (path: string): string => {
    const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return separatorIndex >= 0 ? path.slice(separatorIndex + 1) : path;
};

const getParentPath = (path: string): string | null => {
    const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    if (separatorIndex <= 0) return null;
    return path.slice(0, separatorIndex);
};

const formatPathsForTrace = (paths: string[]): string =>
    paths.map(getPathBasename).slice(0, 8).join(',');

const remainingMs = (until: number, now: number): string =>
    String(Math.max(0, Math.ceil(until - now)));

const buildSqliteWatcherTraceExtra = (
    paths: string[] = [],
    extra: Record<string, unknown> = {},
): Record<string, unknown> => {
    const now = localDataWatcherDependencies.now();
    return {
        ...extra,
        basenames: formatPathsForTrace(paths),
        pathCount: String(paths.length),
        nowMs: String(now),
        ignoreRemainingMs: remainingMs(sqliteIgnoreUntil, now),
        selfWriteRemainingMs: remainingMs(sqliteSelfWriteUntil, now),
        sinceSelfWriteMs: lastSqliteSelfWriteAt > 0 ? String(now - lastSqliteSelfWriteAt) : '',
        refreshInFlight: String(Boolean(sqliteRefreshInFlight)),
        debounceActive: String(Boolean(sqliteDebounceTimer)),
        suppressedSelfWriteEvents: String(sqliteSuppressedSelfWriteEvents),
    };
};

type SnapshotTraceSummary = {
    dataSig: string;
    /**
     * Per-collection signatures are diagnostics only and are absent unless
     * logging is enabled — see the gate in `buildSnapshotTraceSummary`.
     */
    tasksSig?: string;
    projectsSig?: string;
    sectionsSig?: string;
    areasSig?: string;
    peopleSig?: string;
    settingsSig?: string;
    taskCount: string;
    projectCount: string;
    sectionCount: string;
    areaCount: string;
    peopleCount: string;
};

const buildSnapshotTraceSummary = async (data: AppData): Promise<SnapshotTraceSummary> => {
    const normalized = stripSqliteRefreshBookkeeping(localDataWatcherDependencies.normalize(data));
    const tasks = Array.isArray(normalized.tasks) ? normalized.tasks : [];
    const projects = Array.isArray(normalized.projects) ? normalized.projects : [];
    const sections = Array.isArray(normalized.sections) ? normalized.sections : [];
    const areas = Array.isArray(normalized.areas) ? normalized.areas : [];
    const people = Array.isArray(normalized.people) ? normalized.people ?? [] : [];
    const settings = normalized.settings ?? {};
    // `dataSig` drives the no-op refresh detection in `runSqliteRefresh`, so it
    // is always computed. The six per-collection signatures are for logging
    // only, and each one costs another full stable-stringify of that
    // collection — on a large store that is megabytes of transient string per
    // refresh, twice per refresh. Gate them behind the same logging switch
    // `sync-service.ts` uses for its payload traces.
    const detailed = normalized.settings?.diagnostics?.loggingEnabled === true;
    const dataSig = await localDataWatcherDependencies.hashPayload(toStableJson(normalized));
    const [tasksSig, projectsSig, sectionsSig, areasSig, peopleSig, settingsSig] = detailed
        ? await Promise.all([
            localDataWatcherDependencies.hashPayload(toStableJson(tasks)),
            localDataWatcherDependencies.hashPayload(toStableJson(projects)),
            localDataWatcherDependencies.hashPayload(toStableJson(sections)),
            localDataWatcherDependencies.hashPayload(toStableJson(areas)),
            localDataWatcherDependencies.hashPayload(toStableJson(people)),
            localDataWatcherDependencies.hashPayload(toStableJson(settings)),
        ])
        : [undefined, undefined, undefined, undefined, undefined, undefined];

    return {
        dataSig,
        tasksSig,
        projectsSig,
        sectionsSig,
        areasSig,
        peopleSig,
        settingsSig,
        taskCount: String(tasks.length),
        projectCount: String(projects.length),
        sectionCount: String(sections.length),
        areaCount: String(areas.length),
        peopleCount: String(people.length),
    };
};

const prefixSnapshotTraceSummary = (
    prefix: string,
    summary: SnapshotTraceSummary,
): Record<string, string> => Object.fromEntries(
    Object.entries(summary)
        // An absent per-collection signature means logging was off when the
        // summary was built; omit it rather than reporting an empty digest.
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => [
            `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}`,
            value as string,
        ]),
);

/** Reports a change only when both signatures were actually computed. */
const changed = (
    name: string,
    before: string | undefined,
    after: string | undefined,
): Record<string, string> => (
    before === undefined || after === undefined ? {} : { [name]: String(before !== after) }
);

const buildSnapshotChangeTraceExtra = (
    before: SnapshotTraceSummary,
    after: SnapshotTraceSummary,
): Record<string, string> => {
    return {
        dataChanged: String(before.dataSig !== after.dataSig),
        ...changed('tasksChanged', before.tasksSig, after.tasksSig),
        ...changed('projectsChanged', before.projectsSig, after.projectsSig),
        ...changed('sectionsChanged', before.sectionsSig, after.sectionsSig),
        ...changed('areasChanged', before.areasSig, after.areasSig),
        ...changed('peopleChanged', before.peopleSig, after.peopleSig),
        ...changed('settingsChanged', before.settingsSig, after.settingsSig),
        ...prefixSnapshotTraceSummary('before', before),
        ...prefixSnapshotTraceSummary('after', after),
    };
};

/** Filter out iCloud placeholder events (.icloud files, lock files). */
const isRelevantSyncEvent = (paths: string[]): boolean => {
    return paths.some((p) => {
        const name = p.split('/').pop() ?? '';
        // Ignore iCloud placeholder stubs (.filename.icloud)
        if (name.endsWith('.icloud')) return false;
        // Ignore our own advisory lock file
        if (name === '.mindwtr.lock') return false;
        // Ignore temp files from atomic writes
        if (name.endsWith('.tmp')) return false;
        return true;
    });
};

const isRelevantSqliteEvent = (paths: string[], dbPath: string): boolean => {
    const dbName = getPathBasename(dbPath);
    // WAL carries committed writes. The shared-memory file can move during
    // read/lock activity, so watching it makes fetchData feed itself.
    const sqliteNames = new Set([dbName, `${dbName}-wal`]);
    return paths.some((path) => sqliteNames.has(getPathBasename(path)));
};

const resolveUnwatch = (unwatch: unknown): (() => void) | null => {
    if (typeof unwatch === 'function') return unwatch as () => void;
    if (unwatch && typeof (unwatch as any).stop === 'function') {
        return () => (unwatch as any).stop();
    }
    if (unwatch && typeof (unwatch as any).unwatch === 'function') {
        return () => (unwatch as any).unwatch();
    }
    return null;
};

const pruneExpiredSelfWrites = (now: number) => {
    pendingSelfWrites = pendingSelfWrites.filter((entry) => entry.expiresAt > now);
};

const scheduleIgnoreDrain = () => {
    if (!hasPendingChangeDuringIgnore) return;
    if (ignoreDrainTimer) {
        localDataWatcherDependencies.cancelSchedule(ignoreDrainTimer);
        ignoreDrainTimer = null;
    }
    const remainingMs = Math.max(0, ignoreUntil - localDataWatcherDependencies.now());
    ignoreDrainTimer = localDataWatcherDependencies.schedule(() => {
        ignoreDrainTimer = null;
        if (!hasPendingChangeDuringIgnore) return;
        hasPendingChangeDuringIgnore = false;
        void handleExternalChange();
    }, remainingMs + IGNORE_DRAIN_PADDING_MS);
};

const scheduleSqliteIgnoreDrain = () => {
    if (!hasPendingSqliteChangeDuringSelfWrite) return;
    if (sqliteIgnoreDrainTimer) {
        localDataWatcherDependencies.cancelSchedule(sqliteIgnoreDrainTimer);
        sqliteIgnoreDrainTimer = null;
    }
    const drainAfter = Math.max(sqliteIgnoreUntil, sqliteSelfWriteUntil);
    const remainingMs = Math.max(0, drainAfter - localDataWatcherDependencies.now());
    sqliteIgnoreDrainTimer = localDataWatcherDependencies.schedule(() => {
        sqliteIgnoreDrainTimer = null;
        if (!hasPendingSqliteChangeDuringSelfWrite) return;
        hasPendingSqliteChangeDuringSelfWrite = false;
        const paths = pendingSqliteChangePaths;
        pendingSqliteChangePaths = [];
        void handleSqliteChange({ immediate: true, paths });
    }, remainingMs + IGNORE_DRAIN_PADDING_MS);
};

const runPendingMerge = (): Promise<void> => {
    if (mergeInFlight) return mergeInFlight;

    mergeInFlight = (async () => {
        while (pendingExternalChange) {
            pendingExternalChange = false;
            await mergeExternalData();
        }
    })().finally(() => {
        mergeInFlight = null;
        if (pendingExternalChange) {
            void runPendingMerge();
        }
    });

    return mergeInFlight;
};

const stripSqliteRefreshBookkeeping = (data: AppData): AppData => {
    const {
        network,
        lastSyncAt,
        lastSyncStatus,
        lastSyncError,
        pendingRemoteWriteAt,
        pendingRemoteWriteRetryAt,
        pendingRemoteWriteAttempts,
        lastSyncStats,
        lastSyncHistory,
        ...settings
    } = data.settings ?? {};

    void network;
    void lastSyncAt;
    void lastSyncStatus;
    void lastSyncError;
    void pendingRemoteWriteAt;
    void pendingRemoteWriteRetryAt;
    void pendingRemoteWriteAttempts;
    void lastSyncStats;
    void lastSyncHistory;

    return {
        ...data,
        settings,
    };
};

const extendSqliteIgnoreWindow = (windowMs: number = IGNORE_WINDOW_MS): void => {
    sqliteIgnoreUntil = Math.max(sqliteIgnoreUntil, localDataWatcherDependencies.now() + windowMs);
};

const markSqliteSelfWriteWindow = (): void => {
    const now = localDataWatcherDependencies.now();
    extendSqliteIgnoreWindow();
    sqliteSelfWriteUntil = Math.max(sqliteSelfWriteUntil, now + SQLITE_SELF_WRITE_RETENTION_MS);
    lastSqliteSelfWriteAt = now;
    scheduleSqliteIgnoreDrain();
    localDataWatcherDependencies.logInfo(
        '[local-data-watcher] Marked SQLite self-write',
        buildSqliteWatcherTraceExtra([], {
            retentionMs: String(SQLITE_SELF_WRITE_RETENTION_MS),
        }),
    );
};

const isTerminalMergedPersistError = (error: unknown): boolean => {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return [
        'refusing to overwrite',
        'invalid app data',
        'invalid data snapshot',
        'unsupported data version',
        'validation failed',
    ].some((fragment) => message.includes(fragment));
};

const clearMergedPersistRetry = (): void => {
    if (mergedPersistRetryTimer) {
        localDataWatcherDependencies.cancelSchedule(mergedPersistRetryTimer);
        mergedPersistRetryTimer = null;
    }
    delayedMergedPersistRetryCount = 0;
};

const scheduleMergedPersistRetry = (error: unknown): void => {
    if (isTerminalMergedPersistError(error)) {
        localDataWatcherDependencies.logWarn(
            '[local-data-watcher] Merged data persistence failed terminally; automatic retry disabled',
            { error: String(error) },
        );
        return;
    }
    if (mergedPersistRetryTimer || delayedMergedPersistRetryCount >= MAX_DELAYED_MERGED_PERSIST_RETRIES) {
        if (delayedMergedPersistRetryCount >= MAX_DELAYED_MERGED_PERSIST_RETRIES) {
            localDataWatcherDependencies.logWarn(
                '[local-data-watcher] Merged data persistence exhausted delayed retries',
                { error: String(error), maxRetries: String(MAX_DELAYED_MERGED_PERSIST_RETRIES) },
            );
        }
        return;
    }

    delayedMergedPersistRetryCount += 1;
    const retryNumber = delayedMergedPersistRetryCount;
    const generation = watcherGeneration;
    const delayMs = MERGED_PERSIST_RETRY_COOLDOWN_MS * retryNumber;
    mergedPersistRetryTimer = localDataWatcherDependencies.schedule(() => {
        mergedPersistRetryTimer = null;
        if (generation !== watcherGeneration) return;
        pendingExternalChange = true;
        void runPendingMerge();
    }, delayMs);
    localDataWatcherDependencies.logWarn(
        '[local-data-watcher] Scheduled merged data persistence retry',
        { retryNumber: String(retryNumber), delayMs: String(delayMs), error: String(error) },
    );
};

const persistMergedDataWithRetry = async (merged: AppData): Promise<AppData> => {
    for (let attempt = 1; attempt <= MAX_MERGED_PERSIST_ATTEMPTS; attempt += 1) {
        const pendingSelfWritesBeforeAttempt = pendingSelfWrites.slice();
        try {
            return await localDataWatcherDependencies.persistMergedData(merged) ?? merged;
        } catch (error) {
            // Storage adapters mark a payload before starting their durable
            // write. Restore the previous tokens when that write rejects so a
            // failed attempt cannot suppress the external snapshot that still
            // needs to be persisted.
            pendingSelfWrites = pendingSelfWritesBeforeAttempt;
            if (isTerminalMergedPersistError(error)) throw error;
            if (attempt === MAX_MERGED_PERSIST_ATTEMPTS) throw error;
            localDataWatcherDependencies.logWarn(
                '[local-data-watcher] Failed to persist merged data; retrying',
                { attempt: String(attempt), maxAttempts: String(MAX_MERGED_PERSIST_ATTEMPTS) },
            );
        }
    }
    throw new Error('Merged data persistence exhausted without a result');
};

async function mergeExternalData(): Promise<void> {
    // Full-document sync, imports/restores, and this watcher all enter this
    // lane before reading their current inputs. A data transfer acquires its
    // store-write barrier only after it reaches the front of the same lane, so
    // the watcher never waits on that barrier while holding an earlier lock.
    await runSerializedSyncDocumentWriteOperation(async () => {
        try {
            await flushPendingSave();

            const rawData = await localDataWatcherDependencies.readDataJson();
            const normalizedExternal = localDataWatcherDependencies.normalize(rawData);
            const externalPayload = toStableJson(normalizedExternal);

            const matchedSelfWriteIndex = pendingSelfWrites.findIndex((entry) => entry.payload === externalPayload);
            if (matchedSelfWriteIndex >= 0) {
                lastKnownHash = await localDataWatcherDependencies.hashPayload(externalPayload);
                pendingSelfWrites.splice(matchedSelfWriteIndex, 1);
                clearMergedPersistRetry();
                return;
            }

            const externalHash = await localDataWatcherDependencies.hashPayload(externalPayload);
            if (externalHash === lastKnownHash) {
                clearMergedPersistRetry();
                return;
            }

            const localSnapshot = localDataWatcherDependencies.getSnapshot();
            const normalizedLocal = localDataWatcherDependencies.normalize(localSnapshot);
            const localPayload = toStableJson(normalizedLocal);
            const localHash = await localDataWatcherDependencies.hashPayload(localPayload);

            if (localHash === externalHash) {
                lastKnownHash = externalHash;
                clearMergedPersistRetry();
                return;
            }

            const merged = localDataWatcherDependencies.merge(normalizedLocal, normalizedExternal);
            const normalizedMerged = localDataWatcherDependencies.normalize(merged);
            const mergedPayload = toStableJson(normalizedMerged);
            const mergedHash = await localDataWatcherDependencies.hashPayload(mergedPayload);

            if (mergedHash === localHash) {
                lastKnownHash = mergedHash;
                clearMergedPersistRetry();
                return;
            }

            const canonical = await persistMergedDataWithRetry(normalizedMerged);
            lastKnownHash = await localDataWatcherDependencies.hashPayload(
                toStableJson(localDataWatcherDependencies.normalize(canonical)),
            );
            clearMergedPersistRetry();
            localDataWatcherDependencies.logInfo('[local-data-watcher] Merged external data.json changes');
        } catch (error) {
            scheduleMergedPersistRetry(error);
            localDataWatcherDependencies.logWarn('[local-data-watcher] Failed to merge external data: ' + String(error));
        }
    });
}

const runSqliteRefresh = (): Promise<void> => {
    if (sqliteRefreshInFlight) return sqliteRefreshInFlight;

    sqliteRefreshInFlight = runSerializedSyncDocumentWriteOperation(async () => {
        try {
            await flushPendingSave();
            const beforeSummary = await buildSnapshotTraceSummary(localDataWatcherDependencies.getSnapshot());
            localDataWatcherDependencies.logInfo(
                '[local-data-watcher] SQLite refresh start',
                prefixSnapshotTraceSummary('before', beforeSummary),
            );
            await localDataWatcherDependencies.refreshStorageData();
            const afterSummary = await buildSnapshotTraceSummary(localDataWatcherDependencies.getSnapshot());
            const changeExtra = buildSnapshotChangeTraceExtra(beforeSummary, afterSummary);
            if (beforeSummary.dataSig === afterSummary.dataSig) {
                extendSqliteIgnoreWindow(SQLITE_NOOP_REFRESH_IGNORE_MS);
                localDataWatcherDependencies.logInfo(
                    '[local-data-watcher] SQLite refresh no data changes',
                    changeExtra,
                );
                return;
            }
            localDataWatcherDependencies.logInfo(
                '[local-data-watcher] SQLite refresh changed snapshot',
                changeExtra,
            );
            localDataWatcherDependencies.logInfo('[local-data-watcher] Refreshed after SQLite change');
        } catch (error) {
            localDataWatcherDependencies.logWarn(
                '[local-data-watcher] Failed to refresh SQLite change: ' + String(error),
                { error: String(error) },
            );
        }
    }).finally(() => {
        sqliteRefreshInFlight = null;
    });

    return sqliteRefreshInFlight;
};

async function handleSqliteChange(options: { immediate?: boolean; paths?: string[] } = {}): Promise<void> {
    const paths = options.paths ?? [];
    const now = localDataWatcherDependencies.now();

    if (!options.immediate) {
        localDataWatcherDependencies.logInfo(
            '[local-data-watcher] SQLite event received',
            buildSqliteWatcherTraceExtra(paths),
        );

        if (now < sqliteIgnoreUntil) {
            if (now < sqliteSelfWriteUntil) {
                sqliteSuppressedSelfWriteEvents += 1;
            }
            // The no-op window suppresses watcher feedback, but a WAL event can
            // also be a real concurrent writer. Coalesce every ignored event
            // and drain it once the active suppression window closes.
            hasPendingSqliteChangeDuringSelfWrite = true;
            pendingSqliteChangePaths = paths.slice(0, 8);
            scheduleSqliteIgnoreDrain();
            localDataWatcherDependencies.logInfo(
                '[local-data-watcher] SQLite event ignored inside write window',
                buildSqliteWatcherTraceExtra(paths),
            );
            return;
        }

        if (now < sqliteSelfWriteUntil) {
            sqliteSuppressedSelfWriteEvents += 1;
            hasPendingSqliteChangeDuringSelfWrite = true;
            pendingSqliteChangePaths = paths.slice(0, 8);
            scheduleSqliteIgnoreDrain();
            localDataWatcherDependencies.logInfo(
                '[local-data-watcher] SQLite event suppressed as delayed self-write',
                buildSqliteWatcherTraceExtra(paths),
            );
            return;
        }
    }

    if (sqliteDebounceTimer) {
        localDataWatcherDependencies.cancelSchedule(sqliteDebounceTimer);
        sqliteDebounceTimer = null;
    }

    if (options.immediate) {
        localDataWatcherDependencies.logInfo(
            '[local-data-watcher] SQLite refresh requested immediately',
            buildSqliteWatcherTraceExtra(paths),
        );
        await runSqliteRefresh();
        return;
    }

    const scheduledDuringRefresh = sqliteRefreshInFlight !== null;
    sqliteDebounceTimer = localDataWatcherDependencies.schedule(() => {
        sqliteDebounceTimer = null;
        if (scheduledDuringRefresh && localDataWatcherDependencies.now() < sqliteIgnoreUntil) {
            localDataWatcherDependencies.logInfo(
                '[local-data-watcher] SQLite scheduled refresh skipped after no-op window',
                buildSqliteWatcherTraceExtra(paths, { scheduledDuringRefresh: String(scheduledDuringRefresh) }),
            );
            return;
        }
        void runSqliteRefresh();
    }, DEBOUNCE_MS);
    localDataWatcherDependencies.logInfo(
        '[local-data-watcher] SQLite event scheduled refresh',
        buildSqliteWatcherTraceExtra(paths, { scheduledDuringRefresh: String(scheduledDuringRefresh) }),
    );
}

async function handleExternalChange(options: { immediate?: boolean; ignoreSelfWindow?: boolean } = {}): Promise<void> {
    const now = localDataWatcherDependencies.now();
    pruneExpiredSelfWrites(now);

    if (!options.ignoreSelfWindow && now < ignoreUntil) {
        hasPendingChangeDuringIgnore = true;
        scheduleIgnoreDrain();
        return;
    }

    pendingExternalChange = true;

    if (debounceTimer) {
        localDataWatcherDependencies.cancelSchedule(debounceTimer);
        debounceTimer = null;
    }

    if (options.immediate) {
        await runPendingMerge();
        return;
    }

    debounceTimer = localDataWatcherDependencies.schedule(() => {
        debounceTimer = null;
        void runPendingMerge();
    }, DEBOUNCE_MS);
}

export async function refreshFromDiskNow(): Promise<void> {
    await handleExternalChange({ immediate: true, ignoreSelfWindow: true });
}

export function markLocalWrite(data?: AppData): void {
    const now = localDataWatcherDependencies.now();
    pruneExpiredSelfWrites(now);

    if (data) {
        try {
            const normalized = localDataWatcherDependencies.normalize(data);
            const payload = toStableJson(normalized);
            pendingSelfWrites = pendingSelfWrites.filter((entry) => entry.payload !== payload);
            pendingSelfWrites.push({
                payload,
                expiresAt: now + SELF_WRITE_RETENTION_MS,
            });
            if (pendingSelfWrites.length > MAX_PENDING_SELF_WRITES) {
                pendingSelfWrites = pendingSelfWrites.slice(-MAX_PENDING_SELF_WRITES);
            }
        } catch {
            pendingSelfWrites = [];
        }
    } else {
        pendingSelfWrites = [];
    }
    ignoreUntil = now + IGNORE_WINDOW_MS;
    scheduleIgnoreDrain();
}

export function markLocalSqliteWrite(): void {
    markSqliteSelfWriteWindow();
}

export async function start(dataPath: string, dbPath?: string): Promise<void> {
    if (!isTauriRuntime()) return;
    if (unwatchFns.length > 0) return;

    try {
        const unwatch = await localDataWatcherDependencies.watchFile(dataPath, (event) => {
            const paths = normalizePathsFromEvent(event);
            if (paths.length === 0) return;
            // Skip iCloud placeholder events, lock files, and temp files to
            // avoid spurious merges from iCloud Drive housekeeping operations.
            if (!isRelevantSyncEvent(paths)) return;
            void handleExternalChange();
        });

        const resolvedUnwatch = resolveUnwatch(unwatch);
        if (resolvedUnwatch) unwatchFns.push(resolvedUnwatch);
        localDataWatcherDependencies.logInfo('[local-data-watcher] Started watching ' + dataPath);
    } catch (error) {
        localDataWatcherDependencies.logWarn('[local-data-watcher] Failed to start watcher: ' + String(error));
    }

    if (dbPath) {
        const dbWatchPath = getParentPath(dbPath) ?? dbPath;
        try {
            const unwatch = await localDataWatcherDependencies.watchFile(dbWatchPath, (event) => {
                const paths = normalizePathsFromEvent(event);
                if (paths.length === 0) return;
                if (!isRelevantSqliteEvent(paths, dbPath)) return;
                void handleSqliteChange({ paths });
            });

            const resolvedUnwatch = resolveUnwatch(unwatch);
            if (resolvedUnwatch) unwatchFns.push(resolvedUnwatch);
            localDataWatcherDependencies.logInfo('[local-data-watcher] Started watching SQLite directory ' + dbWatchPath);
        } catch (error) {
            localDataWatcherDependencies.logWarn('[local-data-watcher] Failed to start SQLite watcher: ' + String(error));
        }
    }
}

export function stop(): void {
    watcherGeneration += 1;
    if (debounceTimer) {
        localDataWatcherDependencies.cancelSchedule(debounceTimer);
        debounceTimer = null;
    }
    if (sqliteDebounceTimer) {
        localDataWatcherDependencies.cancelSchedule(sqliteDebounceTimer);
        sqliteDebounceTimer = null;
    }
    if (ignoreDrainTimer) {
        localDataWatcherDependencies.cancelSchedule(ignoreDrainTimer);
        ignoreDrainTimer = null;
    }
    if (sqliteIgnoreDrainTimer) {
        localDataWatcherDependencies.cancelSchedule(sqliteIgnoreDrainTimer);
        sqliteIgnoreDrainTimer = null;
    }
    clearMergedPersistRetry();
    hasPendingChangeDuringIgnore = false;
    hasPendingSqliteChangeDuringSelfWrite = false;
    pendingSqliteChangePaths = [];
    pendingExternalChange = false;
    pendingSelfWrites = [];
    sqliteIgnoreUntil = 0;
    sqliteSelfWriteUntil = 0;
    lastSqliteSelfWriteAt = 0;
    sqliteSuppressedSelfWriteEvents = 0;

    if (unwatchFns.length > 0) {
        unwatchFns.forEach((unwatch) => unwatch());
        unwatchFns = [];
        localDataWatcherDependencies.logInfo('[local-data-watcher] Stopped');
    }
}

export const __localDataWatcherTestUtils = {
    setDependenciesForTests(overrides: Partial<LocalDataWatcherDependencies>) {
        localDataWatcherDependencies = {
            ...localDataWatcherDependencies,
            ...overrides,
        };
    },
    async triggerChangeForTests() {
        await handleExternalChange({ immediate: true });
    },
    async refreshFromDiskNowForTests() {
        await refreshFromDiskNow();
    },
    async waitForPendingMergeForTests() {
        while (mergeInFlight) {
            await mergeInFlight;
        }
    },
    async waitForPendingSqliteRefreshForTests() {
        while (sqliteRefreshInFlight) {
            await sqliteRefreshInFlight;
        }
    },
    resetForTests() {
        stop();
        localDataWatcherDependencies = { ...defaultDependencies };
        ignoreUntil = 0;
        sqliteIgnoreUntil = 0;
        sqliteSelfWriteUntil = 0;
        lastSqliteSelfWriteAt = 0;
        sqliteSuppressedSelfWriteEvents = 0;
        hasPendingSqliteChangeDuringSelfWrite = false;
        pendingSqliteChangePaths = [];
        lastKnownHash = '';
        pendingSelfWrites = [];
        mergeInFlight = null;
        sqliteRefreshInFlight = null;
    },
    getPendingSelfWritePayloadLengthForTests() {
        return pendingSelfWrites.reduce((total, entry) => total + entry.payload.length, 0);
    },
};
