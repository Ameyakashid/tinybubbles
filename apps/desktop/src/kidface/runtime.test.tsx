import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '@tinybubbles/core';
import { useKidFaceRuntime } from './runtime';

const mocks = vi.hoisted(() => ({
    performSync: vi.fn(),
    startNotifications: vi.fn(async () => undefined),
    stopNotifications: vi.fn(),
}));

vi.mock('../lib/sync-service', () => ({
    SyncService: {
        performSync: mocks.performSync,
        hasPendingLocalChangesForAutoSync: vi.fn(() => false),
    },
}));

vi.mock('../lib/desktop-auto-sync-eligibility', () => ({
    canDesktopAutoSync: vi.fn(async () => true),
}));

vi.mock('../lib/notification-service', () => ({
    startDesktopNotifications: mocks.startNotifications,
    stopDesktopNotifications: mocks.stopNotifications,
}));

vi.mock('../lib/app-log', () => ({
    logError: vi.fn(async () => undefined),
    logInfo: vi.fn(async () => undefined),
}));

describe('useKidFaceRuntime', () => {
    const originalFetchData = useTaskStore.getState().fetchData;
    const originalSettings = useTaskStore.getState().settings;
    const originalRetryPersistence = useTaskStore.getState().retryPersistence;

    beforeEach(() => {
        vi.useFakeTimers();
        mocks.performSync.mockReset();
        mocks.startNotifications.mockClear();
        mocks.stopNotifications.mockClear();
        useTaskStore.setState({
            fetchData: vi.fn(async () => undefined),
            settings: { ...originalSettings },
            persistenceFailure: null,
            retryPersistence: originalRetryPersistence,
        });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        useTaskStore.setState({
            fetchData: originalFetchData,
            settings: originalSettings,
            persistenceFailure: null,
            retryPersistence: originalRetryPersistence,
        });
    });

    const finishHydration = async () => {
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
    };

    it('keeps the failure visible and reports pending when the controller receives a deferred result', async () => {
        mocks.performSync.mockResolvedValue({
            success: true,
            error: 'Upload is still backing off',
            remoteWriteDeferred: true,
        });

        const view = renderHook(() => useKidFaceRuntime());
        await finishHydration();
        expect(view.result.current.hydrated).toBe(true);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1_500);
        });

        expect(mocks.performSync).toHaveBeenCalledTimes(1);
        expect(view.result.current.lastSyncError).toBe('Upload is still backing off');
        expect(view.result.current.syncPending).toBe(true);

        view.unmount();
    });

    it('restores persisted sync failure and pending-write visibility after hydration', async () => {
        const pendingAt = '2026-08-24T10:00:00.000Z';
        const retryAt = '2026-08-24T10:05:00.000Z';
        useTaskStore.setState({
            fetchData: vi.fn(async () => {
                useTaskStore.setState({
                    settings: {
                        ...originalSettings,
                        lastSyncError: 'Upload failed before restart',
                        pendingRemoteWriteAt: pendingAt,
                        pendingRemoteWriteRetryAt: retryAt,
                    },
                });
            }),
        });

        const view = renderHook(() => useKidFaceRuntime());

        await finishHydration();
        expect(view.result.current.hydrated).toBe(true);
        expect(view.result.current.lastSyncError).toBe('Upload failed before restart');
        expect(view.result.current.syncPending).toBe(true);
        expect(mocks.startNotifications).toHaveBeenCalledTimes(1);

        view.unmount();
        expect(mocks.stopNotifications).toHaveBeenCalledTimes(1);
    });

    it('exposes terminal local persistence failure with its retry action', async () => {
        const retryPersistence = vi.fn(async () => undefined);
        useTaskStore.setState({
            persistenceFailure: {
                message: 'Disk is full',
                failedAt: '2026-08-24T10:00:00.000Z',
                retrying: false,
            },
            retryPersistence,
        });

        const view = renderHook(() => useKidFaceRuntime());
        await finishHydration();
        expect(view.result.current.hydrated).toBe(true);

        expect(view.result.current.persistError).toBe('Disk is full');
        await act(async () => {
            await view.result.current.retryPersistence();
        });
        expect(retryPersistence).toHaveBeenCalledTimes(1);

        view.unmount();
    });
});
