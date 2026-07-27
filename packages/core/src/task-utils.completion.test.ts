import { describe, expect, it } from 'vitest';
import { getCompletionDateGroup, sortTasksBy } from './task-utils';
import type { Task } from './types';

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
    id,
    title: id,
    status: 'done',
    tags: [],
    contexts: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

describe('completed sort (#945)', () => {
    it('orders by completion newest first and puts never-completed tasks last', () => {
        const sorted = sortTasksBy([
            task('never'),
            task('older', { completedAt: '2026-03-01T09:00:00.000Z' }),
            task('newest', { completedAt: '2026-03-05T09:00:00.000Z' }),
            task('middle', { completedAt: '2026-03-03T09:00:00.000Z' }),
        ], 'completed');

        expect(sorted.map((item) => item.id)).toEqual(['newest', 'middle', 'older', 'never']);
    });

    it('does not fall back to updatedAt the way the Done default order does', () => {
        // sortDoneTasksForListView ranks these by updatedAt; the named sort must
        // not, or an archived task never completed sorts in among real completions.
        const sorted = sortTasksBy([
            task('archived-never', { updatedAt: '2026-09-09T00:00:00.000Z' }),
            task('completed', { completedAt: '2026-03-01T09:00:00.000Z' }),
        ], 'completed');

        expect(sorted.map((item) => item.id)).toEqual(['completed', 'archived-never']);
    });

    it('breaks ties on title so the order is stable', () => {
        const sorted = sortTasksBy([
            task('b', { completedAt: '2026-03-01T09:00:00.000Z' }),
            task('a', { completedAt: '2026-03-01T09:00:00.000Z' }),
        ], 'completed');

        expect(sorted.map((item) => item.id)).toEqual(['a', 'b']);
    });
});

describe('getCompletionDateGroup (#945)', () => {
    // Late enough in the day that a rolling 24h window would disagree with
    // calendar days for every case below.
    const now = new Date('2026-03-10T23:30:00');

    it('buckets on local calendar days, not rolling 24-hour windows', () => {
        expect(getCompletionDateGroup({ completedAt: '2026-03-10T00:05:00' }, now)).toBe('today');
        // 23h55m earlier, but the previous calendar day.
        expect(getCompletionDateGroup({ completedAt: '2026-03-09T23:35:00' }, now)).toBe('yesterday');
        expect(getCompletionDateGroup({ completedAt: '2026-03-08T12:00:00' }, now)).toBe('previous7Days');
        expect(getCompletionDateGroup({ completedAt: '2026-03-03T12:00:00' }, now)).toBe('previous7Days');
        expect(getCompletionDateGroup({ completedAt: '2026-03-02T12:00:00' }, now)).toBe('earlier');
    });

    it('treats a missing or unparseable completion as not completed', () => {
        expect(getCompletionDateGroup({}, now)).toBe('notCompleted');
        expect(getCompletionDateGroup({ completedAt: 'not a date' }, now)).toBe('notCompleted');
    });

    it('keeps a completion stamped slightly ahead of now in today', () => {
        expect(getCompletionDateGroup({ completedAt: '2026-03-11T00:10:00' }, now)).toBe('today');
    });
});

describe('sortTasksBy case coverage', () => {
    // Adding the 'completed' case initially deleted 'created-desc' outright, and
    // no core test noticed — a dropped case falls through to `default`, which
    // still returns a plausible order. Pinning the direction of each date sort
    // explicitly is the only thing that catches that; iterating the roster
    // cannot, because a missing case still produces sorted output.
    const tasks = [
        task('mid', { createdAt: '2026-02-02T00:00:00.000Z' }),
        task('newest', { createdAt: '2026-02-03T00:00:00.000Z' }),
        task('oldest', { createdAt: '2026-02-01T00:00:00.000Z' }),
    ];

    it('sorts created oldest first', () => {
        expect(sortTasksBy(tasks, 'created').map((item) => item.id)).toEqual(['oldest', 'mid', 'newest']);
    });

    it('sorts created-desc newest first', () => {
        expect(sortTasksBy(tasks, 'created-desc').map((item) => item.id)).toEqual(['newest', 'mid', 'oldest']);
    });
});
