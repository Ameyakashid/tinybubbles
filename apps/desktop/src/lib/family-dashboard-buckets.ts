import { endOfDay, startOfDay } from 'date-fns';
import {
    getTaskCompletionInstant,
    isCompletedCalendarTask,
    isTaskActionable,
    isTaskInActiveProject,
    safeParseDueDate,
} from '@tinybubbles/core';
import type { Project, Task } from '@tinybubbles/core';

/**
 * The Family dashboard's grouping: the synced task list arranged the way a
 * parent asks about it — what slipped, what's on for today, what's coming,
 * and what got finished. Pure so it can be tested without the view.
 */

export const DONE_LOOKBACK_DAYS = 14;
export const UPCOMING_WINDOW_DAYS = 7;

export interface FamilyDashboardBuckets {
    overdue: Task[];
    dueToday: Task[];
    upcoming: Task[];
    doneRecently: Task[];
    doneTodayCount: number;
}

export function buildFamilyDashboardBuckets(
    tasks: Task[],
    projectMap: Map<string, Project>,
    now: Date,
): FamilyDashboardBuckets {
    const dayStart = startOfDay(now).getTime();
    const dayEnd = endOfDay(now).getTime();
    const upcomingEnd = dayEnd + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const doneCutoff = dayStart - DONE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

    const buckets: FamilyDashboardBuckets = {
        overdue: [],
        dueToday: [],
        upcoming: [],
        doneRecently: [],
        doneTodayCount: 0,
    };

    for (const task of tasks) {
        if (task.deletedAt) continue;

        if (isCompletedCalendarTask(task)) {
            const instant = getTaskCompletionInstant(task);
            if (!instant) continue;
            const at = instant.getTime();
            if (at >= doneCutoff) buckets.doneRecently.push(task);
            if (at >= dayStart && at <= dayEnd) buckets.doneTodayCount += 1;
            continue;
        }

        if (!isTaskActionable(task)) continue;
        // Same visibility rule as the daily digest: tasks in paused/archived
        // projects are not on anyone's plate today.
        if (!isTaskInActiveProject(task, projectMap)) continue;

        const due = safeParseDueDate(task.dueDate);
        if (!due) continue;
        const dueTs = due.getTime();
        if (dueTs < dayStart) buckets.overdue.push(task);
        else if (dueTs <= dayEnd) buckets.dueToday.push(task);
        else if (dueTs <= upcomingEnd) buckets.upcoming.push(task);
    }

    const byDue = (a: Task, b: Task) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
    buckets.overdue.sort(byDue);
    buckets.dueToday.sort(byDue);
    buckets.upcoming.sort(byDue);
    buckets.doneRecently.sort((a, b) => (
        (getTaskCompletionInstant(b)?.getTime() ?? 0) - (getTaskCompletionInstant(a)?.getTime() ?? 0)
    ));
    return buckets;
}
