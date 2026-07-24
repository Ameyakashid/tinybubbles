import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '@mindwtr/core';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('./local-data-watcher', () => ({
    markLocalWrite: vi.fn(),
    markLocalSqliteWrite: vi.fn(),
}));

const reportErrorMock = vi.fn();
vi.mock('./report-error', () => ({
    reportError: (...args: unknown[]) => reportErrorMock(...args),
}));

import { tauriStorage } from './storage-adapter';

// #913: save_data can hang without ever rejecting, so the normal catch block
// never runs. tauriStorage.saveData must surface that through the store's
// error channel (observation only) without changing save/retry semantics.
describe('tauriStorage.saveData stuck-save warning (#913)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useTaskStore.setState({ error: null });
    });

    afterEach(() => {
        vi.useRealTimers();
        useTaskStore.setState({ error: null });
        vi.clearAllMocks();
    });

    it('does not warn when save_data resolves before the threshold', async () => {
        invokeMock.mockResolvedValue(undefined);

        await tauriStorage.saveData({} as any);

        expect(useTaskStore.getState().error).toBeNull();
    });

    it('surfaces a store error once save_data has not resolved after the threshold, and clears it once it resolves', async () => {
        let resolveInvoke!: () => void;
        invokeMock.mockImplementation(() => new Promise<void>((resolve) => {
            resolveInvoke = resolve;
        }));

        const savePromise = tauriStorage.saveData({} as any);

        await vi.advanceTimersByTimeAsync(14_999);
        expect(useTaskStore.getState().error).toBeNull();

        await vi.advanceTimersByTimeAsync(1);
        expect(useTaskStore.getState().error).toMatch(/has not completed/);

        resolveInvoke();
        await savePromise;

        expect(useTaskStore.getState().error).toBeNull();
    });

    it('leaves an unrelated error in place if one was set while the save was stuck', async () => {
        let resolveInvoke!: () => void;
        invokeMock.mockImplementation(() => new Promise<void>((resolve) => {
            resolveInvoke = resolve;
        }));

        const savePromise = tauriStorage.saveData({} as any);
        await vi.advanceTimersByTimeAsync(15_000);
        expect(useTaskStore.getState().error).toMatch(/has not completed/);

        useTaskStore.getState().setError('Some unrelated error');
        resolveInvoke();
        await savePromise;

        expect(useTaskStore.getState().error).toBe('Some unrelated error');
    });

    it('does not reject the invoke early or add a retry when save_data eventually fails', async () => {
        invokeMock.mockRejectedValue(new Error('disk full'));

        await expect(tauriStorage.saveData({} as any)).rejects.toThrow('Failed to save data: disk full');

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(reportErrorMock).toHaveBeenCalledWith(
            'saveData failure',
            expect.any(Error),
            expect.objectContaining({ category: 'storage' }),
        );
    });
});

// saveTask is the incremental persistence path for updateTask/completeTask —
// same hang-without-rejecting shape as saveData, sharing the same warning helper.
describe('tauriStorage.saveTask stuck-save warning (#913)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useTaskStore.setState({ error: null });
    });

    afterEach(() => {
        vi.useRealTimers();
        useTaskStore.setState({ error: null });
        vi.clearAllMocks();
    });

    it('does not warn when save_task resolves before the threshold', async () => {
        invokeMock.mockResolvedValue(undefined);

        await tauriStorage.saveTask!({} as any);

        expect(useTaskStore.getState().error).toBeNull();
    });

    it('surfaces a store error once save_task has not resolved after the threshold, and clears it once it resolves', async () => {
        let resolveInvoke!: () => void;
        invokeMock.mockImplementation(() => new Promise<void>((resolve) => {
            resolveInvoke = resolve;
        }));

        const savePromise = tauriStorage.saveTask!({} as any);

        await vi.advanceTimersByTimeAsync(14_999);
        expect(useTaskStore.getState().error).toBeNull();

        await vi.advanceTimersByTimeAsync(1);
        expect(useTaskStore.getState().error).toMatch(/has not completed/);

        resolveInvoke();
        await savePromise;

        expect(useTaskStore.getState().error).toBeNull();
    });

    it('leaves an unrelated error in place if one was set while the save was stuck', async () => {
        let resolveInvoke!: () => void;
        invokeMock.mockImplementation(() => new Promise<void>((resolve) => {
            resolveInvoke = resolve;
        }));

        const savePromise = tauriStorage.saveTask!({} as any);
        await vi.advanceTimersByTimeAsync(15_000);
        expect(useTaskStore.getState().error).toMatch(/has not completed/);

        useTaskStore.getState().setError('Some unrelated error');
        resolveInvoke();
        await savePromise;

        expect(useTaskStore.getState().error).toBe('Some unrelated error');
    });

    it('does not reject the invoke early or add a retry when save_task eventually fails', async () => {
        invokeMock.mockRejectedValue(new Error('disk full'));

        await expect(tauriStorage.saveTask!({} as any)).rejects.toThrow('Failed to save task: disk full');

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(reportErrorMock).toHaveBeenCalledWith(
            'saveTask failure',
            expect.any(Error),
            expect.objectContaining({ category: 'storage' }),
        );
    });
});
