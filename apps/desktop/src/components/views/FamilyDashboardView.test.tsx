import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTaskStore } from '@tinybubbles/core';
import type { EntityMergeStats, MergeStats, Task } from '@tinybubbles/core';
import { LanguageProvider } from '../../contexts/language-context';
import { FamilyDashboardView } from './FamilyDashboardView';

const initialState = useTaskStore.getState();
const emptyStats = (): EntityMergeStats => ({
    localTotal: 0,
    incomingTotal: 0,
    mergedTotal: 0,
    localOnly: 0,
    incomingOnly: 0,
    conflicts: 0,
    resolvedUsingLocal: 0,
    resolvedUsingIncoming: 0,
    deletionsWon: 0,
    conflictIds: [],
    maxClockSkewMs: 0,
    invalidTimestamps: 0,
    timestampAdjustments: 0,
    timestampAdjustmentIds: [],
    futureTimestampClamps: 0,
    futureTimestampClampIds: [],
});

const stats = (): MergeStats => ({
    tasks: {
        ...emptyStats(),
        conflicts: 1,
        conflictIds: ['task-1'],
        conflictSamples: [{
            id: 'task-1',
            winner: 'local',
            reasons: ['content'],
            hasRevision: true,
            timeDiffMs: 1_000,
            localUpdatedAt: '2026-08-24T17:01:00.000Z',
            incomingUpdatedAt: '2026-08-24T17:01:01.000Z',
            localRev: 2,
            incomingRev: 2,
            localComparableHash: 'local',
            incomingComparableHash: 'incoming',
            diffKeys: ['title'],
        }],
    },
    projects: emptyStats(),
    sections: emptyStats(),
    areas: emptyStats(),
});

const task: Task = {
    id: 'task-1',
    title: 'Pack school bag',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-08-24T17:00:00.000Z',
    updatedAt: '2026-08-24T17:01:00.000Z',
    rev: 2,
};

describe('FamilyDashboardView conflict recovery surface', () => {
    beforeEach(() => {
        act(() => {
            useTaskStore.setState({
                ...initialState,
                tasks: [task],
                projects: [],
                _allTasks: [task],
                settings: {
                    ...initialState.settings,
                    lastSyncAt: '2026-08-24T17:02:00.000Z',
                    lastSyncStatus: 'conflict',
                    lastSyncStats: stats(),
                    lastSyncHistory: [{
                        at: '2026-08-24T17:02:00.000Z',
                        status: 'conflict',
                        conflicts: 1,
                        conflictIds: ['task-1'],
                        maxClockSkewMs: 0,
                        timestampAdjustments: 0,
                    }],
                },
            }, true);
        });
    });

    afterEach(() => {
        cleanup();
        act(() => useTaskStore.setState(initialState, true));
    });

    it('uses amber and explains the discarded edit instead of showing sync as healthy', () => {
        const { container, getByRole, getByText } = render(
            <LanguageProvider>
                <FamilyDashboardView />
            </LanguageProvider>,
        );

        expect(getByText('Sync needs a look — some changes were resolved automatically.')).toBeInTheDocument();
        expect(getByRole('heading', { name: 'Changes that need a look' })).toHaveClass('text-warning');
        expect(getByText('Pack school bag')).toBeInTheDocument();
        expect(getByText(/An edit from the other device was discarded/)).toBeInTheDocument();
        expect(container.querySelector('.bg-success')).not.toBeInTheDocument();
        expect(container.querySelector('.bg-warning')).toBeInTheDocument();
    });
});
