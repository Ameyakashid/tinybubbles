import { isAfter, startOfDay, isSameDay } from 'date-fns';
import { safeParseDate, type Task } from '@tinybubbles/core';

const TODAY_OPEN_STATUSES: Task['status'][] = ['inbox', 'next'];

export interface TodayTaskSelection {
    /** Tasks that belong in Today's "To do" list. */
    openTasks: Task[];
    /** Tasks completed today. */
    doneToday: Task[];
    /** Open inbox/next tasks that are scheduled for a future day. */
    upcomingCount: number;
}

function isDateAfterDay(date: Date, day: Date): boolean {
    return isAfter(startOfDay(date), startOfDay(day));
}

function isDateOnOrBeforeDay(date: Date, day: Date): boolean {
    return !isAfter(startOfDay(date), startOfDay(day));
}

function isTaskDoneToday(task: Task, now: Date): boolean {
    if (task.deletedAt) return false;
    if (task.status !== 'done' && task.status !== 'archived') return false;
    if (!task.completedAt) return false;
    const completedAt = safeParseDate(task.completedAt);
    return completedAt !== null && isSameDay(completedAt, now);
}

function isTaskInTodayToDo(task: Task, now: Date): boolean {
    if (task.deletedAt) return false;
    if (!TODAY_OPEN_STATUSES.includes(task.status)) return false;

    // A task due today or overdue always shows, whatever its start date says.
    if (task.dueDate) {
        const due = safeParseDate(task.dueDate);
        if (due && isDateOnOrBeforeDay(due, now)) return true;
    }

    // No start date means it is actionable immediately.
    if (!task.startTime) return true;

    const start = safeParseDate(task.startTime);
    // If the start date cannot be parsed, treat the task as actionable
    // rather than letting it vanish from Today.
    if (!start) return true;

    return isDateOnOrBeforeDay(start, now);
}

function isTaskScheduledForFuture(task: Task, now: Date): boolean {
    if (task.deletedAt) return false;
    if (!TODAY_OPEN_STATUSES.includes(task.status)) return false;

    // A due-today or overdue task is today's business, not "upcoming".
    if (task.dueDate) {
        const due = safeParseDate(task.dueDate);
        if (due && isDateOnOrBeforeDay(due, now)) return false;
    }

    if (!task.startTime) return false;

    const start = safeParseDate(task.startTime);
    if (!start) return false;

    return isDateAfterDay(start, now);
}

/**
 * Selects the tasks that belong on the kid face Today screen.
 *
 * Data rule (audit finding):
 * - A task appears in "To do" when it is not deleted, its status is
 *   `inbox` or `next`, and it either has no start date or its start date is
 *   today or earlier.
 * - A task due today or overdue always shows in "To do", regardless of its
 *   start date.
 * - `waiting`, `someday`, and `reference` tasks never appear in Today.
 */
export function selectTodayTasks(tasks: readonly Task[], now: Date): TodayTaskSelection {
    const open: Task[] = [];
    const done: Task[] = [];
    let upcomingCount = 0;

    for (const task of tasks) {
        if (isTaskDoneToday(task, now)) {
            done.push(task);
        } else if (isTaskInTodayToDo(task, now)) {
            open.push(task);
        } else if (isTaskScheduledForFuture(task, now)) {
            upcomingCount += 1;
        }
    }

    return { openTasks: open, doneToday: done, upcomingCount };
}
