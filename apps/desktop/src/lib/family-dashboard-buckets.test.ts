import { describe, expect, it } from 'vitest';
import type { Project, Task } from '@tinybubbles/core';
import { buildFamilyDashboardBuckets } from './family-dashboard-buckets';

const NOW = new Date('2026-08-17T12:00:00');

function makeTask(overrides: Partial<Task>): Task {
    return {
        id: overrides.id ?? Math.random().toString(36).slice(2),
        title: 'Task',
        status: 'next',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        ...overrides,
    } as Task;
}

function makeProject(overrides: Partial<Project>): Project {
    return {
        id: overrides.id ?? 'p1',
        title: 'Project',
        status: 'active',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        ...overrides,
    } as Project;
}

describe('buildFamilyDashboardBuckets', () => {
    it('buckets by due date relative to today and sorts due ascending', () => {
        const buckets = buildFamilyDashboardBuckets([
            makeTask({ id: 'late2', dueDate: '2026-08-15' }),
            makeTask({ id: 'late1', dueDate: '2026-08-10' }),
            makeTask({ id: 'today', dueDate: '2026-08-17' }),
            makeTask({ id: 'soon', dueDate: '2026-08-20' }),
            makeTask({ id: 'far', dueDate: '2026-09-20' }),
            makeTask({ id: 'undated' }),
        ], new Map(), NOW);
        expect(buckets.overdue.map((t) => t.id)).toEqual(['late1', 'late2']);
        expect(buckets.dueToday.map((t) => t.id)).toEqual(['today']);
        expect(buckets.upcoming.map((t) => t.id)).toEqual(['soon']);
        // Beyond the window and undated tasks stay off the dashboard.
        expect(buckets.overdue.length + buckets.dueToday.length + buckets.upcoming.length).toBe(4);
    });

    it('collects recent completions newest first and counts today', () => {
        const buckets = buildFamilyDashboardBuckets([
            makeTask({ id: 'doneToday', status: 'done', completedAt: '2026-08-17T09:00:00.000Z' }),
            makeTask({ id: 'doneYesterday', status: 'done', completedAt: '2026-08-16T18:00:00.000Z' }),
            makeTask({ id: 'doneLongAgo', status: 'done', completedAt: '2026-07-01T09:00:00.000Z' }),
        ], new Map(), NOW);
        expect(buckets.doneRecently.map((t) => t.id)).toEqual(['doneToday', 'doneYesterday']);
        expect(buckets.doneTodayCount).toBe(1);
    });

    it('honours the same visibility rules as the rest of the app', () => {
        const projects = new Map([
            ['paused', makeProject({ id: 'paused', status: 'someday' })],
        ]);
        const buckets = buildFamilyDashboardBuckets([
            makeTask({ id: 'deleted', dueDate: '2026-08-10', deletedAt: '2026-08-11T00:00:00.000Z' }),
            makeTask({ id: 'inPausedProject', dueDate: '2026-08-10', projectId: 'paused' }),
            makeTask({ id: 'reference', dueDate: '2026-08-10', status: 'reference' }),
            // Someday with a past due date still surfaces: isTaskActionable
            // (and the daily digest) treat someday/waiting as actionable, and
            // a dated task that slipped is exactly what a parent should see.
            makeTask({ id: 'someday', dueDate: '2026-08-10', status: 'someday' }),
            makeTask({ id: 'visible', dueDate: '2026-08-10' }),
        ], projects, NOW);
        expect(buckets.overdue.map((t) => t.id)).toEqual(['someday', 'visible']);
    });

    it('files a legacy archived task without completedAt under updatedAt', () => {
        const buckets = buildFamilyDashboardBuckets([
            makeTask({ id: 'legacy', status: 'archived', updatedAt: '2026-08-16T10:00:00.000Z' }),
        ], new Map(), NOW);
        expect(buckets.doneRecently.map((t) => t.id)).toEqual(['legacy']);
        expect(buckets.doneTodayCount).toBe(0);
    });
});
