import { describe, expect, it } from 'vitest';
import type { Task } from '@mindwtr/core';
import { DONE_AXES, groupTasksByCompletionDate } from './next-grouping';

const task = (id: string, completedAt?: string): Task => ({
    id,
    title: id,
    status: 'done',
    tags: [],
    contexts: [],
    completedAt,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
});

const label = (group: string) => group;

describe('groupTasksByCompletionDate (#945)', () => {
    const now = new Date('2026-03-10T23:30:00');

    it('orders buckets newest first and omits the empty ones', () => {
        const groups = groupTasksByCompletionDate({
            tasks: [
                task('earlier', '2026-01-05T10:00:00'),
                task('today', '2026-03-10T08:00:00'),
                task('never'),
            ],
            getGroupLabel: label,
            now,
        });

        // No Yesterday or Previous 7 days heading, because nothing landed there.
        expect(groups.map((group) => group.id)).toEqual([
            'completedDate:today',
            'completedDate:earlier',
            'completedDate:notCompleted',
        ]);
    });

    it('mutes the not-completed bucket the way other axes mute their catch-all', () => {
        const groups = groupTasksByCompletionDate({ tasks: [task('never')], getGroupLabel: label, now });
        expect(groups[0].muted).toBe(true);
    });

    it('keeps every task exactly once', () => {
        const tasks = [
            task('a', '2026-03-10T08:00:00'),
            task('b', '2026-03-09T08:00:00'),
            task('c', '2026-03-05T08:00:00'),
            task('d', '2026-01-01T08:00:00'),
            task('e'),
        ];
        const grouped = groupTasksByCompletionDate({ tasks, getGroupLabel: label, now })
            .flatMap((group) => group.tasks.map((item) => item.id));

        expect(grouped.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('offers the axis only through the Done roster', () => {
        expect(DONE_AXES).toContain('completedDate');
    });
});
