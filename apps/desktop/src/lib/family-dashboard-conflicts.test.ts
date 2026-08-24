import { describe, expect, it } from 'vitest';
import type { EntityMergeStats, MergeStats, Task } from '@tinybubbles/core';
import { buildFamilyConflictSummary } from './family-dashboard-conflicts';

const entityStats = (overrides: Partial<EntityMergeStats> = {}): EntityMergeStats => ({
    localTotal: 1,
    incomingTotal: 1,
    mergedTotal: 1,
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
    ...overrides,
});

const conflictStats = (): MergeStats => ({
    tasks: entityStats({
        conflicts: 1,
        resolvedUsingLocal: 1,
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
            localRevBy: 'parent',
            incomingRevBy: 'kid',
            localComparableHash: 'local-hash',
            incomingComparableHash: 'incoming-hash',
            diffKeys: ['status', 'completedAt'],
        }],
    }),
    projects: entityStats(),
    sections: entityStats(),
    areas: entityStats(),
    people: entityStats(),
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

describe('family dashboard conflict evidence', () => {
    it('names the task, losing side, time, and the limit of discarded completion evidence', () => {
        const summary = buildFamilyConflictSummary({
            lastSyncAt: '2026-08-24T17:02:00.000Z',
            lastSyncStatus: 'conflict',
            lastSyncStats: conflictStats(),
            lastSyncHistory: [{
                at: '2026-08-24T17:02:00.000Z',
                status: 'conflict',
                conflicts: 1,
                conflictIds: ['task-1'],
                maxClockSkewMs: 0,
                timestampAdjustments: 0,
            }],
        }, [task]);

        expect(summary.undisclosedCount).toBe(0);
        expect(summary.notices).toEqual([expect.objectContaining({
            title: 'Pack school bag',
            at: '2026-08-24T17:01:01.000Z',
            detail: expect.stringContaining('possible completion from the other device was discarded'),
        })]);
        expect(summary.notices[0]?.detail).toContain('not their values');
    });

    it('keeps older conflict IDs visible without borrowing details from the latest sample', () => {
        const summary = buildFamilyConflictSummary({
            lastSyncStatus: 'success',
            lastSyncStats: conflictStats(),
            lastSyncHistory: [
                {
                    at: '2026-08-24T18:00:00.000Z',
                    status: 'success',
                    conflicts: 0,
                    conflictIds: [],
                    maxClockSkewMs: 0,
                    timestampAdjustments: 0,
                },
                {
                    at: '2026-08-24T17:02:00.000Z',
                    status: 'conflict',
                    conflicts: 2,
                    conflictIds: ['task-1'],
                    maxClockSkewMs: 0,
                    timestampAdjustments: 0,
                },
            ],
        }, [task]);

        expect(summary.notices[0]).toMatchObject({
            title: 'Pack school bag',
            at: '2026-08-24T17:02:00.000Z',
        });
        expect(summary.notices[0]?.detail).toContain('history retained its ID and time');
        expect(summary.undisclosedCount).toBe(1);
    });
});
