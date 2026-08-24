import { describe, expect, it } from 'vitest';
import {
    cloudGetJson,
    cloudPutJson,
    normalizeCloudUrl,
    performSyncCycle,
} from '@tinybubbles/core';
import type { AppData, SyncCycleResult, Task } from '@tinybubbles/core';
import { buildFamilyConflictSummary } from './family-dashboard-conflicts';
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
    createdAt: '2026-08-24T17:00:00.000Z',
    updatedAt: '2026-08-24T17:00:00.000Z',
    rev: 1,
    ...overrides,
});

type Client = { data: AppData };

const syncClient = async (
    client: Client,
    readRemote: () => Promise<AppData | null>,
    writeRemote: (data: AppData) => Promise<void>,
): Promise<SyncCycleResult> => performSyncCycle({
    readLocal: async () => client.data,
    readRemote,
    writeLocal: async (data) => { client.data = data; },
    writeRemote,
    now: () => '2026-08-24T17:05:00.000Z',
});

describe('parent and kid merge composition', () => {
    it('composes two client states through the real merge and exposes role-specific conflict recovery evidence', async () => {
        const parent: Client = { data: {
            ...emptyDocument(),
            tasks: [task({ id: 'shared-task', title: 'Pack school bag' })],
        } };
        const kid: Client = { data: emptyDocument() };
        const server: Client = { data: emptyDocument() };
        const readServer = async () => structuredClone(server.data);
        const writeServer = async (data: AppData) => { server.data = structuredClone(data); };

        await syncClient(parent, readServer, writeServer);
        await syncClient(kid, readServer, writeServer);

        // Kid role: receives the parent's assignment, then completes it.
        expect(kid.data.tasks.map(({ id }) => id)).toContain('shared-task');
        kid.data = {
            ...kid.data,
            tasks: kid.data.tasks.map((candidate) => candidate.id === 'shared-task'
                ? {
                    ...candidate,
                    status: 'done',
                    completedAt: '2026-08-24T17:02:00.000Z',
                    updatedAt: '2026-08-24T17:02:00.000Z',
                    rev: 2,
                    revBy: 'kid',
                }
                : candidate),
        };

        // Parent role: edits the same revision before seeing the completion.
        parent.data = {
            ...parent.data,
            tasks: parent.data.tasks.map((candidate) => candidate.id === 'shared-task'
                ? {
                    ...candidate,
                    title: 'Pack school bag and lunch',
                    updatedAt: '2026-08-24T17:02:01.000Z',
                    rev: 2,
                    revBy: 'parent',
                }
                : candidate),
        };

        await syncClient(kid, readServer, writeServer);
        const parentResult = await syncClient(parent, readServer, writeServer);

        expect(parentResult.status).toBe('conflict');
        if (parentResult.status === 'skipped') throw new Error('unexpected skipped sync');
        expect(parentResult.stats.tasks.conflictIds).toContain('shared-task');
        expect(parent.data.settings.lastSyncStatus).toBe('conflict');

        const parentTask = parent.data.tasks.find(({ id }) => id === 'shared-task');
        expect(parentTask).toBeDefined();
        const buckets = buildFamilyDashboardBuckets(
            parent.data.tasks,
            new Map(parent.data.projects.map((project) => [project.id, project])),
            new Date('2026-08-24T18:00:00.000Z'),
        );
        const recovery = buildFamilyConflictSummary(parent.data.settings, parent.data.tasks);

        // The parent sees either the kid's completion or the parent's edit,
        // plus an honest recovery notice for the side deterministic LWW lost.
        expect(
            buckets.doneRecently.some(({ id }) => id === 'shared-task')
            || parentTask?.title === 'Pack school bag and lunch',
        ).toBe(true);
        expect(recovery.notices).toEqual([
            expect.objectContaining({ id: 'shared-task', title: parentTask?.title }),
        ]);
        expect(recovery.notices[0]?.detail).toMatch(/discarded/);
    });
});

const cloudBaseUrl = process.env.TINYBUBBLES_PARENT_COMPOSITION_URL;
const cloudToken = process.env.TINYBUBBLES_PARENT_COMPOSITION_TOKEN;

describe.skipIf(!cloudBaseUrl || !cloudToken)('parent and kid real-cloud composition', () => {
    it('round-trips both roles through a running Tiny Bubbles cloud server', async () => {
        const endpoint = normalizeCloudUrl(cloudBaseUrl!);
        const options = { token: cloudToken!, allowInsecureHttp: true };
        const readCloud = () => cloudGetJson<AppData>(endpoint, options);
        const writeCloud = async (data: AppData) => { await cloudPutJson(endpoint, data, options); };
        const parent: Client = { data: {
            ...emptyDocument(),
            tasks: [task({ id: 'composition-parent-task', title: 'Bring library book' })],
        } };
        const kid: Client = { data: emptyDocument() };

        // This opt-in token must identify a disposable test namespace.
        await writeCloud(emptyDocument());
        await syncClient(parent, readCloud, writeCloud);
        await syncClient(kid, readCloud, writeCloud);
        expect(kid.data.tasks.find(({ id }) => id === 'composition-parent-task')?.title)
            .toBe('Bring library book');

        kid.data = {
            ...kid.data,
            tasks: kid.data.tasks.map((candidate) => candidate.id === 'composition-parent-task'
                ? {
                    ...candidate,
                    status: 'done',
                    completedAt: '2026-08-24T17:04:00.000Z',
                    updatedAt: '2026-08-24T17:04:00.000Z',
                    rev: 2,
                    revBy: 'kid-cloud-client',
                }
                : candidate),
        };
        await syncClient(kid, readCloud, writeCloud);
        await syncClient(parent, readCloud, writeCloud);

        expect(parent.data.tasks.find(({ id }) => id === 'composition-parent-task')).toMatchObject({
            status: 'done',
            completedAt: '2026-08-24T17:04:00.000Z',
        });
        expect(buildFamilyDashboardBuckets(
            parent.data.tasks,
            new Map(),
            new Date('2026-08-24T18:00:00.000Z'),
        ).doneTodayCount).toBe(1);
    });
});
