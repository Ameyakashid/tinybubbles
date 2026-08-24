/**
 * The headless runtime for the rebuilt kid face: hydrates the store and runs
 * the same auto-sync machinery the stock shell uses, with none of its UI.
 * Everything here is reused from lib/ and @tinybubbles/core - no engine
 * changes, no imports from components/.
 *
 * Design agents: call this once at the root and trust it. Data arrives in
 * useTaskStore; edits made through store actions persist and sync on their
 * own schedule.
 */
import { useEffect, useState } from 'react';
import { flushPendingSave, useTaskStore } from '@tinybubbles/core';
import { SyncService } from '../lib/sync-service';
import { createDesktopAutoSyncController } from '../lib/auto-sync-controller';
import { canDesktopAutoSync } from '../lib/desktop-auto-sync-eligibility';
import { resolveVisibilitySyncAction } from '../lib/desktop-sync-runtime';
import { logError, logInfo } from '../lib/app-log';
import { startDesktopNotifications, stopDesktopNotifications } from '../lib/notification-service';

export type KidFaceRuntimeStatus = {
    hydrated: boolean;
    /**
     * Set when loading stored data failed. A failed load must never render as
     * a successfully loaded empty day - to a child, "Nothing left to do"
     * after a storage error looks like their tasks vanished (audit #1).
     */
    loadError: string | null;
    lastSyncError: string | null;
    syncPending: boolean;
    persistError: string | null;
    persistRetrying: boolean;
    requestSync: () => Promise<void>;
    retryPersistence: () => Promise<void>;
    retryLoad: () => void;
};

const readPersistedSyncState = () => {
    const { settings } = useTaskStore.getState();
    const persistedError = settings?.lastSyncError?.trim();
    return {
        lastSyncError: persistedError || null,
        syncPending: Boolean(settings?.pendingRemoteWriteAt || settings?.pendingRemoteWriteRetryAt),
    };
};

export function useKidFaceRuntime(): KidFaceRuntimeStatus {
    const fetchData = useTaskStore((state) => state.fetchData);
    const persistenceFailure = useTaskStore((state) => state.persistenceFailure);
    const retryPersistenceAction = useTaskStore((state) => state.retryPersistence);
    const [hydrated, setHydrated] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [lastSyncError, setLastSyncError] = useState<string | null>(null);
    const [syncPending, setSyncPending] = useState(false);
    const [requestSyncFn, setRequestSyncFn] = useState<() => Promise<void>>(
        () => async () => undefined,
    );
    const [retryLoadFn, setRetryLoadFn] = useState<() => void>(() => () => undefined);

    useEffect(() => {
        let disposed = false;
        let initialLoadCompleted = false;

        const reportError = (label: string, error: unknown) => {
            void logError(error, { scope: 'kidface', step: label });
        };

        startDesktopNotifications().catch((error) => reportError('Notifications failed', error));

        const controller = createDesktopAutoSyncController({
            canSync: () => canDesktopAutoSync(SyncService),
            performSync: async () => {
                const result = await SyncService.performSync();
                if (!disposed) {
                    if (result.remoteWriteDeferred) {
                        setSyncPending(true);
                        if (result.error) setLastSyncError(result.error);
                    } else if (result.success) {
                        setSyncPending(false);
                        setLastSyncError(null);
                    }
                }
                return result;
            },
            flushPendingSave,
            reportError,
            onSyncFailure: (message: string) => {
                if (!disposed) {
                    setLastSyncError(message);
                    setSyncPending(readPersistedSyncState().syncPending);
                }
            },
            isRuntimeActive: () => !disposed,
            shouldPauseWindowSync: () => useTaskStore.getState().editLockCount > 0,
            hasPendingLocalChanges: () => SyncService.hasPendingLocalChangesForAutoSync(),
            logInfo: (message, extra) => {
                void logInfo(message, { scope: 'kidface-sync', extra });
            },
        });

        setRequestSyncFn(() => async () => {
            await controller.requestSync(0).catch((error) => {
                reportError('Sync failed', error);
            });
        });

        const loadData = () => {
            void fetchData({ isResultStillRelevant: () => !disposed })
                .then(() => {
                    if (!disposed) {
                        const persistedSyncState = readPersistedSyncState();
                        setLoadError(null);
                        setLastSyncError(persistedSyncState.lastSyncError);
                        setSyncPending(persistedSyncState.syncPending);
                    }
                })
                .catch((error) => {
                    reportError('Load failed', error);
                    if (!disposed) {
                        setLoadError(error instanceof Error ? error.message : String(error));
                    }
                })
                .finally(() => {
                    if (disposed) return;
                    setHydrated(true);
                    if (!initialLoadCompleted) {
                        initialLoadCompleted = true;
                        controller.scheduleInitialSync();
                    }
                });
        };

        setRetryLoadFn(() => loadData);
        loadData();

        const focusListener = () => controller.handleFocus();
        const blurListener = () => controller.handleBlur();
        const visibilityListener = () => {
            const action = resolveVisibilitySyncAction(document.visibilityState);
            if (action === 'focus') controller.handleFocus();
            else if (action === 'blur') controller.handleBlur();
        };
        // Gate on lastDataChangeAt exactly like the stock shell: the store
        // bumps it only for real local data changes, so hydration and applied
        // remote results do not queue pointless extra syncs (audit #4).
        const storeUnsubscribe = useTaskStore.subscribe((state, prevState) => {
            if (state.lastDataChangeAt === prevState.lastDataChangeAt) return;
            controller.handleDataChange();
        });

        window.addEventListener('focus', focusListener);
        window.addEventListener('blur', blurListener);
        document.addEventListener('visibilitychange', visibilityListener);

        return () => {
            disposed = true;
            controller.dispose();
            stopDesktopNotifications();
            storeUnsubscribe();
            window.removeEventListener('focus', focusListener);
            window.removeEventListener('blur', blurListener);
            document.removeEventListener('visibilitychange', visibilityListener);
        };
    }, [fetchData]);

    return {
        hydrated,
        loadError,
        lastSyncError,
        syncPending,
        persistError: persistenceFailure?.message ?? null,
        persistRetrying: persistenceFailure?.retrying ?? false,
        requestSync: requestSyncFn,
        retryPersistence: retryPersistenceAction,
        retryLoad: retryLoadFn,
    };
}
