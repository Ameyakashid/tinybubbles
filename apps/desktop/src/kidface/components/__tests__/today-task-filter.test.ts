import { addDays, subDays } from 'date-fns';
import { describe, expect, it } from 'vitest';
import type { Task } from '@tinybubbles/core';
import { selectTodayTasks } from '../today-task-filter';

function buildTask(overrides: Partial<Task> & { id: string; title: string }): Task {
    const now = new Date();
    return {
        status: 'next',
        tags: [],
        contexts: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        ...overrides,
    };
}

describe('selectTodayTasks', () => {
    const now = new Date('2026-08-20T12:00:00');

    it('excludes a parent-scheduled task whose start date is in the future', () => {
        const tasks = [
            buildTask({ id: 'now', title: 'Now', startTime: now.toISOString() }),
            buildTask({ id: 'future', title: 'Future', startTime: addDays(now, 7).toISOString() }),
        ];

        const { openTasks, upcomingCount } = selectTodayTasks(tasks, now);

        expect(openTasks.map((task) => task.id)).toEqual(['now']);
        expect(upcomingCount).toBe(1);
    });

    it('excludes a waiting task even when it has no start date', () => {
        const tasks = [
            buildTask({ id: 'next', title: 'Next' }),
            buildTask({ id: 'waiting', title: 'Waiting', status: 'waiting' }),
            buildTask({ id: 'someday', title: 'Someday', status: 'someday' }),
            buildTask({ id: 'reference', title: 'Reference', status: 'reference' }),
        ];

        const { openTasks } = selectTodayTasks(tasks, now);

        expect(openTasks.map((task) => task.id)).toEqual(['next']);
    });

    it('includes an overdue task regardless of its start date', () => {
        const tasks = [
            buildTask({
                id: 'overdue',
                title: 'Overdue',
                startTime: addDays(now, 14).toISOString(),
                dueDate: subDays(now, 2).toISOString(),
            }),
        ];

        const { openTasks } = selectTodayTasks(tasks, now);

        expect(openTasks.map((task) => task.id)).toEqual(['overdue']);
    });

    it('includes a task due today even if its start date is in the future', () => {
        const tasks = [
            buildTask({
                id: 'due-today',
                title: 'Due today',
                startTime: addDays(now, 5).toISOString(),
                dueDate: now.toISOString(),
            }),
        ];

        const { openTasks, upcomingCount } = selectTodayTasks(tasks, now);

        expect(openTasks.map((task) => task.id)).toEqual(['due-today']);
        expect(upcomingCount).toBe(0);
    });

    it('counts only future-scheduled inbox/next tasks as upcoming', () => {
        const tasks = [
            buildTask({ id: 'a', title: 'A', startTime: addDays(now, 1).toISOString() }),
            buildTask({ id: 'b', title: 'B', startTime: addDays(now, 3).toISOString() }),
            buildTask({ id: 'c', title: 'C', status: 'waiting', startTime: addDays(now, 1).toISOString() }),
        ];

        const { openTasks, upcomingCount } = selectTodayTasks(tasks, now);

        expect(openTasks).toHaveLength(0);
        expect(upcomingCount).toBe(2);
    });

    it('includes tasks with no start date or a past start date', () => {
        const tasks = [
            buildTask({ id: 'no-start', title: 'No start' }),
            buildTask({ id: 'past-start', title: 'Past start', startTime: subDays(now, 1).toISOString() }),
        ];

        const { openTasks, upcomingCount } = selectTodayTasks(tasks, now);

        expect(openTasks.map((task) => task.id)).toEqual(['no-start', 'past-start']);
        expect(upcomingCount).toBe(0);
    });

    it('separates tasks completed today from open tasks', () => {
        const tasks = [
            buildTask({ id: 'open', title: 'Open' }),
            buildTask({
                id: 'done-today',
                title: 'Done today',
                status: 'done',
                completedAt: now.toISOString(),
            }),
            buildTask({
                id: 'done-yesterday',
                title: 'Done yesterday',
                status: 'done',
                completedAt: subDays(now, 1).toISOString(),
            }),
        ];

        const { openTasks, doneToday } = selectTodayTasks(tasks, now);

        expect(openTasks.map((task) => task.id)).toEqual(['open']);
        expect(doneToday.map((task) => task.id)).toEqual(['done-today']);
    });
});
