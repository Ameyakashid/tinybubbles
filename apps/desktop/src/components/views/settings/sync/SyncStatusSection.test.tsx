import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SyncStatusSection } from './SyncStatusSection';

const labels = new Proxy<Record<string, string>>({}, {
    get: (_target, key) => String(key),
});

function renderStatus(syncLastResultAt: string, overrides: Record<string, unknown> = {}) {
    return render(
        <SyncStatusSection
            {...({
                conflictCount: 0,
                isLoadingSnapshots: false,
                isRestoringSnapshot: false,
                isSyncTargetValid: true,
                isSyncing: false,
                lastSyncDisplay: 'Never',
                lastSyncError: null,
                lastSyncHistory: [],
                lastSyncStats: null,
                lastSyncStatus: null,
                onRestoreSnapshot: vi.fn(),
                onSyncNow: vi.fn(),
                onUpdateSyncPreferences: vi.fn(),
                snapshots: [],
                syncError: null,
                syncLastResult: 'success',
                syncLastResultAt,
                syncPreferences: {},
                syncQueued: false,
                t: labels,
                ...overrides,
            } as any)}
        />
    );
}

describe('SyncStatusSection', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('expires a recent sync result without waiting for another render', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'));
        const { getByText, queryByText } = renderStatus(new Date().toISOString());

        expect(getByText('lastSyncSuccess')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(8001);
        });

        expect(queryByText('lastSyncSuccess')).not.toBeInTheDocument();
    });

    it('disables snapshot restore while sync is active', () => {
        const snapshot = 'data.2026-07-31T12-00-00.123456789.1.snapshot.json';
        const { getByRole, queryByText } = renderStatus(new Date().toISOString(), {
            isSyncing: true,
            snapshots: [snapshot],
        });

        fireEvent.click(getByRole('button', { name: 'recoverySnapshots' }));

        expect(getByRole('button', { name: 'recoverySnapshotsRestore' })).toBeDisabled();
        expect(queryByText(snapshot)).not.toBeInTheDocument();
    });
});
