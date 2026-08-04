import { describe, expect, it } from 'vitest';
import type { AppData, Task } from './types';
import { compactPurgedTaskForLocalStorage, hasUncompactedPurgedTaskTombstone } from './tombstone-compaction';
import { normalizeTaskForLoad } from './task-status';
import { normalizeTaskForSyncMerge } from './sync-normalization';
import { mergeAppDataWithStats } from './sync';

const nowIso = '2026-08-04T00:00:00.000Z';

const purgedTask: Task = {
    id: 'task-purged',
    title: 'Sensitive title',
    status: 'done',
    tags: ['a'],
    contexts: [],
    rev: 5,
    revBy: 'device-a',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    deletedAt: '2026-01-03T00:00:00.000Z',
    purgedAt: '2026-01-03T00:00:00.000Z',
};

describe('purged tombstone compaction is stable across load cycles', () => {
    // normalizeTaskForLoad backfills pushCount: 0 on every load; the compaction
    // check must treat that as neutral, or every purged tombstone takes a rev
    // bump on every merge and each cycle re-triggers the next one (#766).
    it('does not flag a loaded compacted tombstone as uncompacted', () => {
        const compacted = compactPurgedTaskForLocalStorage(purgedTask);
        expect(hasUncompactedPurgedTaskTombstone(compacted, true)).toBe(false);
        const loaded = normalizeTaskForLoad(compacted, nowIso);
        expect(loaded.pushCount).toBe(0);
        expect(hasUncompactedPurgedTaskTombstone(loaded, true)).toBe(false);
    });

    it('keeps rev stable across repeated load -> merge cycles', () => {
        let task = compactPurgedTaskForLocalStorage(purgedTask);
        for (let cycle = 0; cycle < 3; cycle += 1) {
            task = normalizeTaskForSyncMerge(normalizeTaskForLoad(task, nowIso), nowIso, true);
        }
        expect(task.rev).toBe(purgedTask.rev);
        expect(task.revBy).toBe(purgedTask.revBy);
    });

    it('reports tombstoneRepairs in merge stats once, then converges to zero', () => {
        const emptyData: AppData = { tasks: [], projects: [], sections: [], areas: [], people: [], settings: {} };
        const localData: AppData = { ...emptyData, tasks: [purgedTask] };
        const first = mergeAppDataWithStats(localData, emptyData, { nowIso });
        expect(first.stats.tombstoneRepairs).toBe(1);
        const loadedBack: AppData = {
            ...first.data,
            tasks: first.data.tasks.map((task) => normalizeTaskForLoad(task, nowIso)),
        };
        const second = mergeAppDataWithStats(loadedBack, first.data, { nowIso });
        expect(second.stats.tombstoneRepairs).toBe(0);
    });

    it('still bumps rev once for a genuinely uncompacted tombstone, then converges', () => {
        const first = normalizeTaskForSyncMerge(purgedTask, nowIso, true);
        expect(first.rev).toBe(6);
        expect(first.revBy).toBe('sync-repair');
        expect(first.title).toBe('(deleted)');
        const second = normalizeTaskForSyncMerge(normalizeTaskForLoad(first, nowIso), nowIso, true);
        expect(second.rev).toBe(6);
    });
});
