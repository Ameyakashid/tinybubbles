/**
 * Gentle streaks and milestones for the kid face.
 *
 * This hook derives celebration-worthy, shame-free strings from the existing task
 * list. It persists nothing, creates no counters, and never shows a broken chain,
 * a zero, or a percentage.
 *
 * Rules:
 * - Only non-deleted tasks count.
 * - A completion is status === 'done' || 'archived' with a completedAt timestamp.
 * - Day granularity is the local calendar date of completedAt.
 * - First completion ever is celebrated once (per session, since nothing persists).
 * - A "day with many completions" is a positive peak (threshold 3), never an avg.
 * - Variety of days is breadth, not a chain.
 * - A gentle streak counts consecutive days with at least one completion. If today
 *   is empty but yesterday had completions, the run is still current. If the run
 *   ended before today, we fall back to longest run or variety — never broken.
 */
import { useMemo } from 'react';
import { useTaskStore, type Task, type Language } from '@tinybubbles/core';
import { displayLabel } from '@/lib/display-labels';
import { useLanguage } from '@/contexts/language-context';

const MANY_COMPLETIONS_THRESHOLD = 3;

type TranslateFn = (key: string) => string;

export interface KidFaceCelebrations {
    /** Ordered: most specific/celebratory first. Callers render the first item. */
    items: string[];
}

function isCompleted(task: Task): boolean {
    return task.deletedAt == null
        && (task.status === 'done' || task.status === 'archived')
        && task.completedAt != null;
}

function localDateString(isoTimestamp: string): string {
    const date = new Date(isoTimestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function todayLocalDateString(now: Date): string {
    return localDateString(now.toISOString());
}

function yesterdayLocalDateString(now: Date): string {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return localDateString(yesterday.toISOString());
}

function computeConsecutiveRuns(dates: string[]): { length: number; end: string }[] {
    if (dates.length === 0) return [];
    const sorted = [...dates].sort();
    const runs: { length: number; end: string }[] = [];
    let currentLength = 1;
    let currentEnd = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const next = new Date(sorted[i]);
        prev.setDate(prev.getDate() + 1);
        if (prev.getTime() === next.getTime()) {
            currentLength++;
            currentEnd = sorted[i];
        } else {
            runs.push({ length: currentLength, end: currentEnd });
            currentLength = 1;
            currentEnd = sorted[i];
        }
    }
    runs.push({ length: currentLength, end: currentEnd });
    return runs;
}

function computeCelebrationStrings(
    tasks: readonly Task[],
    now: Date,
    t: TranslateFn,
    language: Language,
): string[] {
    const completed = tasks.filter(isCompleted);
    if (completed.length === 0) return [];

    const completedDates = completed.map((task) => localDateString(task.completedAt!));
    const uniqueDates = Array.from(new Set(completedDates));
    const today = todayLocalDateString(now);
    const yesterday = yesterdayLocalDateString(now);

    const todayCount = completedDates.filter((date) => date === today).length;
    const distinctDays = uniqueDates.length;

    const runs = computeConsecutiveRuns(uniqueDates);
    const currentRun = runs.find((run) => run.end === today || run.end === yesterday);
    const longestRun = runs.reduce(
        (max, run) => (run.length > max.length ? run : max),
        runs[0] ?? { length: 0, end: '' },
    );

    const first = displayLabel(
        t,
        language,
        'kidface.celebration.firstCompletion',
        'You finished your first thing!',
    );
    const many = displayLabel(
        t,
        language,
        'kidface.celebration.manyCompletions',
        'You finished {count} things today!',
    ).replace('{count}', String(todayCount));
    const variety = displayLabel(
        t,
        language,
        'kidface.celebration.varietyOfDays',
        'You have finished things on {count} different days.',
    ).replace('{count}', String(distinctDays));
    const streak = displayLabel(
        t,
        language,
        'kidface.celebration.gentleStreak',
        'You have finished things {count} days in a row.',
    ).replace('{count}', String(currentRun?.length ?? 0));
    const longest = displayLabel(
        t,
        language,
        'kidface.celebration.longestRun',
        'Your longest run is {count} days.',
    ).replace('{count}', String(longestRun.length));

    const items: string[] = [];

    if (completed.length === 1) {
        items.push(first);
    }

    if (todayCount >= MANY_COMPLETIONS_THRESHOLD) {
        items.push(many);
    }

    if (currentRun && currentRun.length > 1) {
        items.push(streak);
    } else if (longestRun.length > 1) {
        items.push(longest);
    }

    if (distinctDays > 0) {
        items.push(variety);
    }

    return items;
}

export function useKidFaceCelebrations(): KidFaceCelebrations {
    const { t, language } = useLanguage();
    const tasks = useTaskStore((state) => state.tasks);

    const items = useMemo(
        () => computeCelebrationStrings(tasks, new Date(), t, language),
        [tasks, t, language],
    );

    return { items };
}
