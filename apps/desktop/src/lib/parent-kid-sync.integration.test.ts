import { describe, expect, it } from 'vitest';
import { performSyncCycle } from '@tinybubbles/core';
import type { AppData, Task } from '@tinybubbles/core';
import { buildFamilyDashboardBuckets } from './family-dashboard-buckets';

const emptyDocument = (): AppData => ({
    tasks: [],
    projects: [],
    sections: [],
    areas: [],
    people: [],
    settings: {},
});

const task = (overrides: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-08-17T08:00:00.000Z',
    updatedAt: '2026-08-17T08:00:00.000Z',
    rev: 1,
    ...overrides,
});

describe('parent and kid shared-document sync', () => {
    it('moves a parent task to the kid and a kid completion to the parent dashboard', async () => {
        let remote = emptyDocument();
        let parent = {
            ...emptyDocument(),
            tasks: [task({
                id: 'from-parent',
                title: 'Pack school bag',
                dueDate: '2026-08-17',
            })],
        } satisfies AppData;
        let kid = emptyDocument();

        const sync = async (
            readDevice: () => AppData,
            writeDevice: (data: AppData) => void,
        ) => performSyncCycle({
            readLocal: async () => readDevice(),
            readRemote: async () => remote,
            writeLocal: async (data) => { writeDevice(data); },
            writeRemote: async (data) => { remote = data; },
        });

        await sync(() => parent, (data) => { parent = data; });
        await sync(() => kid, (data) => { kid = data; });

        expect(kid.tasks.map(({ id }) => id)).toContain('from-parent');

        kid = {
            ...kid,
            tasks: kid.tasks.map((candidate) => candidate.id === 'from-parent'
                ? {
                    ...candidate,
                    status: 'done',
                    completedAt: '2026-08-17T08:02:00.000Z',
                    updatedAt: '2026-08-17T08:02:00.000Z',
                    rev: 2,
                }
                : candidate),
        };
        await sync(() => kid, (data) => { kid = data; });
        await sync(() => parent, (data) => { parent = data; });

        const buckets = buildFamilyDashboardBuckets(
            parent.tasks,
            new Map(parent.projects.map((project) => [project.id, project])),
            new Date('2026-08-17T12:00:00'),
        );
        expect(parent.tasks.find(({ id }) => id === 'from-parent')).toMatchObject({
            status: 'done',
            completedAt: '2026-08-17T08:02:00.000Z',
        });
        expect(buckets.doneRecently.map(({ id }) => id)).toContain('from-parent');
        expect(buckets.doneTodayCount).toBe(1);
    });
});
