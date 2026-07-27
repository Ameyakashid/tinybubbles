import { addDays, format } from 'date-fns';

import type { ReviewSnapshotItem } from './ai/types';
import type { ExternalCalendarEvent } from './ics';
import type { Project, Task, TaskSortBy } from './types';
import { hasTimeComponent, isDueForReview, safeParseDate, safeParseDueDate } from './date';
import { filterProjectsNeedingNextAction, isTaskInActiveProject } from './project-utils';
import { getSequentialFirstTaskIds, shouldShowTaskForStart, sortTasksBy } from './task-utils';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_REVIEW_ADVANCE_DAYS = 7;

/**
 * Next review date after marking an item reviewed: `days` from now, preserving
 * the original value's date-only vs datetime shape (time-of-day carries over).
 */
export function getAdvancedReviewDate(
    reviewAt: string | undefined | null,
    now: Date = new Date(),
    days: number = DEFAULT_REVIEW_ADVANCE_DAYS,
): string {
    const target = addDays(now, days);
    if (reviewAt && hasTimeComponent(reviewAt)) {
        const parsed = safeParseDate(reviewAt);
        if (parsed) {
            const withTime = new Date(target);
            withTime.setHours(parsed.getHours(), parsed.getMinutes(), 0, 0);
            return format(withTime, "yyyy-MM-dd'T'HH:mm");
        }
    }
    return format(target, 'yyyy-MM-dd');
}

function isFutureDate(value: string | undefined | null, now: Date): boolean {
    if (!value) return false;
    const date = safeParseDate(value);
    return date ? date.getTime() > now.getTime() : false;
}

export type ReviewSchedulePartition<T> = {
    due: T[];
    scheduled: T[];
    unscheduled: T[];
};

/**
 * Splits reviewable items by review date: `due` (review date reached),
 * `scheduled` (explicitly deferred to a future review date), `unscheduled`
 * (no review date set).
 */
export function partitionByReviewDate<T extends { reviewAt?: string | null }>(
    items: T[],
    now: Date = new Date(),
): ReviewSchedulePartition<T> {
    const due: T[] = [];
    const scheduled: T[] = [];
    const unscheduled: T[] = [];
    items.forEach((item) => {
        if (isDueForReview(item.reviewAt, now)) {
            due.push(item);
        } else if (isFutureDate(item.reviewAt, now)) {
            scheduled.push(item);
        } else {
            unscheduled.push(item);
        }
    });
    return { due, scheduled, unscheduled };
}

export type WeeklyReviewSummary = {
    inboxCount: number;
    activeProjectCount: number;
    projectsWithoutNextAction: number;
    staleWaitingCount: number;
};

/**
 * Factual snapshot for the weekly review's completed step. Every count mirrors
 * the filter a review step itself uses, so the summary can never disagree with
 * what the user just saw:
 * - `inboxCount` matches the inbox step's `inboxTasks` filter.
 * - `projectsWithoutNextAction` matches the projects step's next-action predicate.
 * - `staleWaitingCount` is derived from `getStaleItems`, inheriting its
 *   future-reviewAt/startTime exemption rather than re-deriving staleness.
 */
export function getWeeklyReviewSummary(
    tasks: Task[],
    projects: Project[],
    now: Date = new Date(),
): WeeklyReviewSummary {
    const projectMap = new Map(projects.map((project) => [project.id, project]));

    const inboxCount = tasks.filter((task) => (
        task.status === 'inbox'
        && !task.deletedAt
        && isTaskInActiveProject(task, projectMap)
    )).length;

    const activeProjects = projects.filter((project) => project.status === 'active' && !project.deletedAt);
    const projectsWithoutNextAction = filterProjectsNeedingNextAction(projects, tasks).length;

    const staleWaitingCount = getStaleItems(tasks, projects, 14, now)
        .filter((item) => item.status === 'waiting').length;

    return {
        inboxCount,
        activeProjectCount: activeProjects.length,
        projectsWithoutNextAction,
        staleWaitingCount,
    };
}

export function getStaleItems(
    tasks: Task[],
    projects: Project[],
    staleThresholdDays = 14,
    now: Date = new Date(),
): ReviewSnapshotItem[] {
    const items: ReviewSnapshotItem[] = [];
    const projectMap = new Map(projects.map((project) => [project.id, project]));

    tasks.forEach((task) => {
        if (task.deletedAt) return;
        if (task.status !== 'next' && task.status !== 'waiting') return;
        if (!isTaskInActiveProject(task, projectMap)) return;
        // An explicit future review or start date outranks the staleness heuristic.
        if (isFutureDate(task.reviewAt, now) || isFutureDate(task.startTime, now)) return;
        const updated = new Date(task.updatedAt || task.createdAt);
        if (Number.isNaN(updated.getTime())) return;
        const daysStale = Math.ceil((now.getTime() - updated.getTime()) / DAY_MS);
        if (daysStale <= staleThresholdDays) return;
        items.push({
            id: task.id,
            title: task.title,
            daysStale,
            status: task.status === 'waiting' ? 'waiting' : 'next',
            startTime: task.startTime,
            dueDate: task.dueDate,
            reviewAt: task.reviewAt,
        });
    });

    projects.forEach((project) => {
        if (project.deletedAt) return;
        if (project.status !== 'active') return;
        if (isFutureDate(project.reviewAt, now)) return;
        const updated = new Date(project.updatedAt || project.createdAt);
        if (Number.isNaN(updated.getTime())) return;
        const daysStale = Math.ceil((now.getTime() - updated.getTime()) / DAY_MS);
        if (daysStale <= staleThresholdDays) return;
        items.push({
            id: `project:${project.id}`,
            title: project.title,
            daysStale,
            status: 'project',
            dueDate: project.dueDate,
            reviewAt: project.reviewAt,
        });
    });

    return items.sort((a, b) => b.daysStale - a.daysStale);
}

// ---------------------------------------------------------------------------
// Daily Review / Weekly Review candidate + step derivation.
//
// Both platforms independently filtered the same task/project lists for the
// same review steps. Desktop's Daily Review additionally kept a pre-#867 raw
// `startTime > now` check instead of `shouldShowTaskForStart`, hiding a task
// starting later today all morning and ignoring recurrence deferral (#843).
// This is the single home for both rules (ADR 0021: "candidate logic stays a
// core predicate... no per-platform copies").
// ---------------------------------------------------------------------------

export type ReviewBucketOptions = {
    now?: Date;
    showFutureStarts?: boolean;
    sortBy?: TaskSortBy;
};

function isSameLocalDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export type DailyReviewBuckets = {
    inbox: Task[];
    focused: Task[];
    waiting: Task[];
    dueToday: Task[];
    overdue: Task[];
    focusCandidates: Task[];
};

/**
 * Daily Review's per-step task lists. `done` is excluded once, at the base —
 * every bucket below is a further filter of that same active set.
 */
export function getDailyReviewBuckets(
    tasks: Task[],
    projects: Project[],
    opts: ReviewBucketOptions = {},
): DailyReviewBuckets {
    const now = opts.now ?? new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const projectMap = new Map(projects.map((project) => [project.id, project]));

    const activeTasks = tasks.filter((task) => (
        !task.deletedAt
        && task.status !== 'reference'
        && task.status !== 'done'
        && isTaskInActiveProject(task, projectMap)
    ));

    const sequentialProjectIds = new Set(
        projects.filter((project) => project.isSequential && !project.deletedAt).map((project) => project.id),
    );
    const sequentialFirstTaskIds = getSequentialFirstTaskIds(
        activeTasks.filter((task) => task.status === 'next'),
        sequentialProjectIds,
    );

    const inbox = activeTasks.filter((task) => task.status === 'inbox');
    const focused = activeTasks.filter((task) => task.isFocusedToday && shouldShowTaskForStart(task, opts));
    const waiting = sortTasksBy(activeTasks.filter((task) => task.status === 'waiting'), opts.sortBy);

    const dueToday = sortTasksBy(activeTasks.filter((task) => {
        const due = safeParseDueDate(task.dueDate);
        return due ? isSameLocalDay(due, now) : false;
    }), opts.sortBy);

    const overdue = sortTasksBy(activeTasks.filter((task) => {
        const due = safeParseDueDate(task.dueDate);
        return due ? due < startOfToday : false;
    }), opts.sortBy);

    const todayStr = now.toDateString();
    const candidatesById = new Map<string, Task>();
    const addCandidate = (task: Task) => {
        if (!candidatesById.has(task.id)) candidatesById.set(task.id, task);
    };
    activeTasks.forEach((task) => {
        if (task.isFocusedToday && shouldShowTaskForStart(task, opts)) addCandidate(task);
        const due = safeParseDueDate(task.dueDate);
        if (due && (due < now || due.toDateString() === todayStr)) {
            addCandidate(task);
            return;
        }
        if (task.status === 'next') {
            // Same deferral rule as Focus: a recurring chore carrying only a
            // due date is not reviewable until it starts (#843, #867).
            if (!shouldShowTaskForStart(task, opts)) return;
            // Sequential projects surface only their first remaining task;
            // later steps aren't actionable yet.
            if (task.projectId && sequentialProjectIds.has(task.projectId) && !sequentialFirstTaskIds.has(task.id)) {
                return;
            }
            addCandidate(task);
            return;
        }
        if ((task.status === 'waiting' || task.status === 'someday') && isDueForReview(task.reviewAt, now)) {
            addCandidate(task);
        }
    });
    const focusCandidates = sortTasksBy(Array.from(candidatesById.values()), opts.sortBy);

    return { inbox, focused, waiting, dueToday, overdue, focusCandidates };
}

export type CalendarReviewEntry = {
    task: Task;
    date: Date;
    kind: 'due' | 'start';
};

export type ContextReviewGroup = {
    context: string;
    tasks: Task[];
};

export type ExternalCalendarDaySummary = {
    dayStart: Date;
    events: ExternalCalendarEvent[];
    totalCount: number;
};

export type WeeklyReviewBuckets = {
    inbox: Task[];
    waitingGroups: ReviewSchedulePartition<Task>;
    somedayGroups: ReviewSchedulePartition<Task>;
    orderedProjects: Project[];
    contextGroups: ContextReviewGroup[];
    calendarItems: CalendarReviewEntry[];
};

/**
 * Weekly Review's per-step task/project lists (ADR 0021's stale-item and
 * candidate surfaces). `getStaleItems` and `getWeeklyReviewSummary` already
 * cover the stale-items step and the completion summary; this covers the
 * other six steps that desktop and mobile filtered identically.
 */
export function getWeeklyReviewBuckets(
    tasks: Task[],
    projects: Project[],
    opts: ReviewBucketOptions = {},
): WeeklyReviewBuckets {
    const now = opts.now ?? new Date();
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcomingEnd = new Date(startOfToday);
    upcomingEnd.setDate(upcomingEnd.getDate() + 7);

    // Contexts and the upcoming-calendar list both want "still live, not yet
    // resolved" tasks: not deleted/done/archived/reference, in an active project.
    const isReviewable = (task: Task) => (
        !task.deletedAt
        && task.status !== 'done'
        && task.status !== 'archived'
        && task.status !== 'reference'
        && isTaskInActiveProject(task, projectMap)
    );

    const inboxTasks = tasks.filter((task) => task.status === 'inbox' && !task.deletedAt && isTaskInActiveProject(task, projectMap));
    const waitingTasks = tasks.filter((task) => task.status === 'waiting' && !task.deletedAt && isTaskInActiveProject(task, projectMap));
    const somedayTasks = tasks.filter((task) => task.status === 'someday' && !task.deletedAt && isTaskInActiveProject(task, projectMap));
    const waitingGroups = partitionByReviewDate(waitingTasks, now);
    const somedayGroups = partitionByReviewDate(somedayTasks, now);

    const activeProjects = projects.filter((project) => project.status === 'active' && !project.deletedAt);
    const dueProjects = activeProjects.filter((project) => isDueForReview(project.reviewAt, now));
    const futureProjects = activeProjects.filter((project) => !isDueForReview(project.reviewAt, now));
    const orderedProjects = [...dueProjects, ...futureProjects];

    const contextGroupsByName = new Map<string, Task[]>();
    tasks.forEach((task) => {
        if (!isReviewable(task)) return;
        (task.contexts ?? []).forEach((contextValue) => {
            const normalized = contextValue.trim();
            if (!normalized) return;
            const existing = contextGroupsByName.get(normalized) ?? [];
            existing.push(task);
            contextGroupsByName.set(normalized, existing);
        });
    });
    const contextGroups: ContextReviewGroup[] = Array.from(contextGroupsByName.entries())
        .map(([context, contextTasks]) => ({
            context,
            tasks: contextTasks.slice().sort((a, b) => a.title.localeCompare(b.title)),
        }))
        .sort((a, b) => (b.tasks.length - a.tasks.length) || a.context.localeCompare(b.context));

    const calendarEntries: CalendarReviewEntry[] = [];
    tasks.forEach((task) => {
        if (!isReviewable(task)) return;
        const dueDate = safeParseDueDate(task.dueDate);
        if (dueDate) calendarEntries.push({ task, date: dueDate, kind: 'due' });
        const startTime = safeParseDate(task.startTime);
        if (startTime) calendarEntries.push({ task, date: startTime, kind: 'start' });
    });
    const calendarItems = calendarEntries
        .filter((entry) => entry.date >= startOfToday && entry.date < upcomingEnd)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    return { inbox: inboxTasks, waitingGroups, somedayGroups, orderedProjects, contextGroups, calendarItems };
}

/**
 * The Weekly Review calendar step's external-calendar day summaries: a
 * 7-day window over the already-fetched events, non-empty days only.
 * Fetching stays a platform concern; this grouping does not.
 */
export function getExternalCalendarDaySummaries(
    events: ExternalCalendarEvent[],
    days: number = 7,
    now: Date = new Date(),
): ExternalCalendarDaySummary[] {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const summaries: ExternalCalendarDaySummary[] = [];
    for (let offset = 0; offset < days; offset += 1) {
        const dayStart = new Date(startOfToday);
        dayStart.setDate(dayStart.getDate() + offset);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const dayEvents = events
            .filter((event) => {
                const start = safeParseDate(event.start);
                const end = safeParseDate(event.end);
                if (!start || !end) return false;
                return start.getTime() < dayEnd.getTime() && end.getTime() > dayStart.getTime();
            })
            .sort((a, b) => {
                const aStart = safeParseDate(a.start)?.getTime() ?? Number.POSITIVE_INFINITY;
                const bStart = safeParseDate(b.start)?.getTime() ?? Number.POSITIVE_INFINITY;
                return aStart - bStart;
            });
        if (dayEvents.length > 0) {
            summaries.push({ dayStart, events: dayEvents, totalCount: dayEvents.length });
        }
    }
    return summaries;
}

export type ReviewStepId =
    | 'today' | 'focus' | 'inbox' | 'waiting' | 'completed'
    | 'stale' | 'calendar' | 'contexts' | 'projects' | 'someday';

export type ReviewStepFlags = {
    id: ReviewStepId;
    hasWork: boolean;
};

export type DailyReviewStepsOptions = {
    kind: 'daily';
    includeFocusStep?: boolean;
    todayCalendarEventCount?: number;
    tomorrowCalendarEventCount?: number;
    externalCalendarHasError?: boolean;
};

export type WeeklyReviewStepsOptions = {
    kind: 'weekly';
    includeContextStep?: boolean;
    staleItemCount?: number;
    externalCalendarDayCount?: number;
    externalCalendarHasError?: boolean;
};

/**
 * Canonical step order + "does this step have anything to show" for Daily or
 * Weekly Review. Titles, descriptions, icons and `t()` stay in the modals —
 * those are platform/i18n concerns, not part of the review rule.
 */
export function buildReviewSteps(
    buckets: DailyReviewBuckets,
    opts: DailyReviewStepsOptions,
): ReviewStepFlags[];
export function buildReviewSteps(
    buckets: WeeklyReviewBuckets,
    opts: WeeklyReviewStepsOptions,
): ReviewStepFlags[];
export function buildReviewSteps(
    buckets: DailyReviewBuckets | WeeklyReviewBuckets,
    opts: DailyReviewStepsOptions | WeeklyReviewStepsOptions,
): ReviewStepFlags[] {
    if (opts.kind === 'daily') {
        const b = buckets as DailyReviewBuckets;
        const todayHasWork = b.overdue.length > 0
            || b.dueToday.length > 0
            || (opts.todayCalendarEventCount ?? 0) > 0
            || (opts.tomorrowCalendarEventCount ?? 0) > 0
            || Boolean(opts.externalCalendarHasError);
        const steps: ReviewStepFlags[] = [
            { id: 'today', hasWork: todayHasWork },
            { id: 'inbox', hasWork: b.inbox.length > 0 },
            // Waiting For comes before focus selection: items unblocked today
            // can be switched to Next here and picked up in the focus step.
            { id: 'waiting', hasWork: b.waiting.length > 0 },
        ];
        if (opts.includeFocusStep !== false) {
            steps.push({ id: 'focus', hasWork: b.focusCandidates.length > 0 });
        }
        steps.push({ id: 'completed', hasWork: true });
        return steps;
    }

    const b = buckets as WeeklyReviewBuckets;
    const calendarHasWork = b.calendarItems.length > 0
        || (opts.externalCalendarDayCount ?? 0) > 0
        || Boolean(opts.externalCalendarHasError);
    // "Not due yet" (scheduled) items don't count as work: nothing to act on today.
    const waitingHasWork = b.waitingGroups.due.length + b.waitingGroups.unscheduled.length > 0;
    const somedayHasWork = b.somedayGroups.due.length + b.somedayGroups.unscheduled.length > 0;
    const steps: ReviewStepFlags[] = [
        { id: 'inbox', hasWork: b.inbox.length > 0 },
        { id: 'stale', hasWork: (opts.staleItemCount ?? 0) > 0 },
        { id: 'calendar', hasWork: calendarHasWork },
        { id: 'waiting', hasWork: waitingHasWork },
    ];
    if (opts.includeContextStep !== false) {
        steps.push({ id: 'contexts', hasWork: b.contextGroups.length > 0 });
    }
    steps.push(
        { id: 'projects', hasWork: b.orderedProjects.length > 0 },
        { id: 'someday', hasWork: somedayHasWork },
        { id: 'completed', hasWork: true },
    );
    return steps;
}
