import { describe, expect, it } from 'vitest';
import type { Task } from '@mindwtr/core';

import { getNextScheduledAt } from '@mindwtr/core';

import {
    buildDesktopTaskNotificationBody,
    resolveDueRepeatToFire,
    resolvePollCatchUpMs,
} from './notification-service';

const baseTask: Task = {
    id: 'task-1',
    title: 'Prepare report',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-05-23T00:00:00.000Z',
    updatedAt: '2026-05-23T00:00:00.000Z',
};

const translations = {
    'settings.startDateNotifications': 'Start date reminders',
    'settings.dueDateNotifications': 'Due date reminders',
    'settings.reviewAtNotifications': 'Review date reminders',
    'settings.notifications': 'Notifications',
};

describe('desktop notification service', () => {
    it('includes the reminder type before the task description', () => {
        const task: Task = {
            ...baseTask,
            dueDate: '2026-05-23T17:00:00.000Z',
            description: '**Bring** notes',
        };

        expect(buildDesktopTaskNotificationBody(
            task,
            'due',
            translations,
        )).toBe('Due date reminders\nBring notes');
    });

    it('still shows the reminder type when the task has no description', () => {
        const task: Task = {
            ...baseTask,
            startTime: '2026-05-23T09:00:00.000Z',
        };

        expect(buildDesktopTaskNotificationBody(
            task,
            'start',
            translations,
        )).toBe('Start date reminders');
    });
});

describe('resolveDueRepeatToFire', () => {
    const repeatTask: Task = {
        ...baseTask,
        status: 'next',
        dueDate: '2026-06-17T09:00:00.000Z',
        repeatReminderMinutes: 10,
    };
    const opts = { includeDueDate: true };

    it('fires the occurrence just reached, within one poll window', () => {
        // due+20min occurrence (index 2), now is 5s past it -> within the 15s catch-up
        const now = new Date('2026-06-17T09:20:05.000Z');
        expect(resolveDueRepeatToFire(repeatTask, now, undefined, opts)).toEqual({
            key: '2026-06-17T09:00:00.000Z#2',
            index: 2,
        });
    });

    it('does not re-fire the same occurrence (dedup by key)', () => {
        const now = new Date('2026-06-17T09:20:05.000Z');
        expect(resolveDueRepeatToFire(repeatTask, now, '2026-06-17T09:00:00.000Z#2', opts)).toBeNull();
    });

    it('invalidates dedup when the due time changes', () => {
        const moved = { ...repeatTask, dueDate: '2026-06-17T10:00:00.000Z' };
        const now = new Date('2026-06-17T10:20:05.000Z');
        // old key was for the 09:00 dueISO; the new dueISO must still fire
        expect(resolveDueRepeatToFire(moved, now, '2026-06-17T09:00:00.000Z#2', opts)).toEqual({
            key: '2026-06-17T10:00:00.000Z#2',
            index: 2,
        });
    });

    it('returns null before the first repeat occurrence', () => {
        const now = new Date('2026-06-17T09:05:00.000Z'); // < due + 10min
        expect(resolveDueRepeatToFire(repeatTask, now, undefined, opts)).toBeNull();
    });

    it('skips an occurrence missed beyond the poll window (desktop was not polling)', () => {
        // due+10min occurrence is 30s stale (> 15s catch-up), due+20min not yet reached
        const now = new Date('2026-06-17T09:10:30.000Z');
        expect(resolveDueRepeatToFire(repeatTask, now, undefined, opts)).toBeNull();
    });

    it('fires an occurrence missed inside a widened poll window (throttled tab)', () => {
        // Same 30s-stale occurrence as above, but this poll is answerable for the
        // last minute because the previous one was throttled that far back.
        const now = new Date('2026-06-17T09:10:30.000Z');
        expect(resolveDueRepeatToFire(repeatTask, now, undefined, { ...opts, catchUpMs: 60_000 })).toEqual({
            key: '2026-06-17T09:00:00.000Z#1',
            index: 1,
        });
    });

    it('returns null when due-date notifications are disabled', () => {
        const now = new Date('2026-06-17T09:20:05.000Z');
        expect(resolveDueRepeatToFire(repeatTask, now, undefined, { includeDueDate: false })).toBeNull();
    });

    it('never fires repeat reminders for a task that suppresses Mindwtr reminders (#885)', () => {
        const suppressed = { ...repeatTask, suppressMindwtrReminders: true };
        const now = new Date('2026-06-17T09:20:05.000Z');
        expect(resolveDueRepeatToFire(suppressed, now, undefined, opts)).toBeNull();
    });
});

// The poll loop is a 15s setInterval, but a browser tab that is not in the foreground
// gets its timers throttled to roughly one a minute, so consecutive polls are not 15s
// apart and a reminder can land between two of them (#962). The window each poll is
// answerable for has to follow the real gap.
describe('resolvePollCatchUpMs', () => {
    const nowMs = new Date('2026-06-17T09:20:00.000Z').getTime();

    it('uses one poll window on the first check, so reminders reached before the app opened stay skipped', () => {
        expect(resolvePollCatchUpMs(nowMs, null)).toBe(15_000);
    });

    it('covers the whole gap when a throttled tab polled a minute ago', () => {
        expect(resolvePollCatchUpMs(nowMs, nowMs - 60_000)).toBe(60_000);
    });

    it('caps the gap so a window reopened after a suspend does not empty a queue of stale reminders', () => {
        expect(resolvePollCatchUpMs(nowMs, nowMs - 3 * 60 * 60_000)).toBe(5 * 60_000);
    });

    it('never narrows the normal window when a data change triggers an early check', () => {
        expect(resolvePollCatchUpMs(nowMs, nowMs - 2_000)).toBe(15_000);
    });
});

// The desktop poll loop schedules task reminders via core's getNextScheduledAt with all
// three sources enabled. These guard that the loop's inputs honor the per-task opt-out
// (#885): start/due reminders drop, but review reminders still fire (mobile parity).
describe('desktop next-reminder scheduling honors suppressMindwtrReminders', () => {
    const allOn = { includeStartTime: true, includeDueDate: true, includeReviewAt: true };
    const now = new Date('2026-06-17T08:00:00.000Z');

    it('schedules the next start/due reminder for a task that does not suppress reminders', () => {
        const task: Task = {
            ...baseTask,
            startTime: '2026-06-17T09:00:00.000Z',
            dueDate: '2026-06-17T17:00:00.000Z',
        };
        expect(getNextScheduledAt(task, now, allOn)).toEqual(new Date('2026-06-17T09:00:00.000Z'));
    });

    it('drops start and due reminders when the task suppresses Mindwtr reminders', () => {
        const task: Task = {
            ...baseTask,
            startTime: '2026-06-17T09:00:00.000Z',
            dueDate: '2026-06-17T17:00:00.000Z',
            suppressMindwtrReminders: true,
        };
        expect(getNextScheduledAt(task, now, allOn)).toBeNull();
    });

    it('still fires review reminders even when start/due reminders are suppressed', () => {
        const task: Task = {
            ...baseTask,
            startTime: '2026-06-17T09:00:00.000Z',
            dueDate: '2026-06-17T17:00:00.000Z',
            reviewAt: '2026-06-17T10:00:00.000Z',
            suppressMindwtrReminders: true,
        };
        expect(getNextScheduledAt(task, now, allOn)).toEqual(new Date('2026-06-17T10:00:00.000Z'));
    });
});
