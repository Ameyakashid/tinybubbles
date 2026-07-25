import { describe, expect, it } from 'vitest';

import { applyImport, type ImportSource } from './import-apply';
import { mockAppData } from './sync-test-utils';
import type { Area, Project, Task } from './types';

// Deterministic id scheme for the tests below — mirrors what TickTick/DGT's real idFor hooks do
// (hash a namespaced sourceKey), without pulling in the real hash so a test failure points at
// applyImport's own dedup/order/rev logic rather than the hash function.
const idFor = (kind: 'area' | 'project' | 'section' | 'task', sourceKey: string): string => `${kind}::${sourceKey}`;

const OPTS = {
    fallbacks: { area: 'Imported Area', project: 'Imported Project' },
    idFor,
    suffix: ' (Test)',
};

describe('applyImport', () => {
    it('renames on name collision, allocates order after existing siblings, and stamps a fresh rev', () => {
        // This area was "already imported" in a prior run (its id already matches what idFor
        // would produce), so this import must dedupe it rather than create a duplicate — and a
        // project/task landing in that same area must continue after its existing siblings.
        const existingArea: Area = {
            id: idFor('area', 'src-area'),
            name: 'Work',
            color: '#123456',
            order: 0,
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
        };
        const siblingProject: Project = {
            id: 'project-sibling',
            title: 'Something Else',
            status: 'active',
            color: '#111827',
            order: 0,
            tagIds: [],
            areaId: existingArea.id,
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
        };
        const nameCollisionProject: Project = {
            id: 'project-name-collision',
            title: 'Launch',
            status: 'active',
            color: '#111827',
            order: 0,
            tagIds: [],
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
        };
        const siblingTask: Task = {
            id: 'task-sibling',
            title: 'Existing area task',
            status: 'inbox',
            taskMode: 'task',
            contexts: [],
            tags: [],
            pushCount: 0,
            areaId: existingArea.id,
            order: 0,
            orderNum: 0,
            createdAt: '2026-06-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
        };

        const currentData = mockAppData([siblingTask], [siblingProject, nameCollisionProject], []);
        currentData.areas = [existingArea];

        const parsed: ImportSource = {
            areas: [{ name: 'Work', order: 0, sourceKey: 'src-area' }],
            projects: [{ name: 'Launch', order: 1, sourceKey: 'src-proj', areaSourceKey: 'src-area' }],
            tasks: [{
                title: 'Standalone follow-up',
                order: 1,
                status: 'inbox',
                sourceKey: 'src-task',
                areaSourceKey: 'src-area',
            }],
            warnings: [],
        };

        const result = applyImport(currentData, parsed, { ...OPTS, now: '2026-06-17T12:00:00.000Z' });

        // The area was deduped (id already existed), not recreated.
        expect(result.importedAreaCount).toBe(0);
        expect(result.data.areas).toHaveLength(1);

        expect(result.importedProjectCount).toBe(1);
        const importedProject = result.data.projects.find((project) => project.id === idFor('project', 'src-proj'));
        expect(importedProject).toMatchObject({
            title: 'Launch (Test)',
            areaId: existingArea.id,
            order: 1, // continues after siblingProject's order 0
            rev: 1,
            revBy: result.data.settings.deviceId,
        });
        expect(result.warnings).toContain('Imported project "Launch" was renamed to "Launch (Test)" to avoid a title conflict.');

        expect(result.importedTaskCount).toBe(1);
        expect(result.importedStandaloneTaskCount).toBe(1);
        const importedTask = result.data.tasks.find((task) => task.id === idFor('task', 'src-task'));
        expect(importedTask).toMatchObject({
            areaId: existingArea.id,
            order: 1, // continues after siblingTask's order 0
            rev: 1,
            revBy: result.data.settings.deviceId,
        });
    });

    it('does not duplicate entities when the same source is imported again', () => {
        const parsed: ImportSource = {
            areas: [{ name: 'Work', order: 0, sourceKey: 'src-area' }],
            projects: [{ name: 'Launch', order: 0, sourceKey: 'src-proj', areaSourceKey: 'src-area' }],
            tasks: [{ title: 'Plan release', order: 0, status: 'inbox', sourceKey: 'src-task', projectSourceKey: 'src-proj' }],
            warnings: [],
        };

        const first = applyImport(mockAppData([], [], []), parsed, { ...OPTS, now: '2026-06-17T12:00:00.000Z' });
        expect(first.importedAreaCount).toBe(1);
        expect(first.importedProjectCount).toBe(1);
        expect(first.importedTaskCount).toBe(1);

        const second = applyImport(first.data, parsed, { ...OPTS, now: '2026-06-18T12:00:00.000Z' });

        expect(second.importedAreaCount).toBe(0);
        expect(second.importedProjectCount).toBe(0);
        expect(second.importedTaskCount).toBe(0);
        expect(second.data.areas).toHaveLength(first.data.areas.length);
        expect(second.data.projects).toHaveLength(first.data.projects.length);
        expect(second.data.tasks).toHaveLength(first.data.tasks.length);
        expect(second.data.tasks.map((task) => task.id)).toEqual(first.data.tasks.map((task) => task.id));
    });

    it('does not resurrect a tombstoned entity on re-import', () => {
        const parsed: ImportSource = {
            areas: [],
            projects: [{ name: 'Launch', order: 0, sourceKey: 'src-proj' }],
            tasks: [],
            warnings: [],
        };

        const first = applyImport(mockAppData([], [], []), parsed, { ...OPTS, now: '2026-06-17T12:00:00.000Z' });
        expect(first.importedProjectCount).toBe(1);
        const importedProjectId = idFor('project', 'src-proj');
        const importedProject = first.data.projects.find((project) => project.id === importedProjectId);
        expect(importedProject).toBeDefined();

        // Simulate the user deleting the imported project (soft delete / tombstone) before
        // re-importing the exact same source file.
        const deletedAt = '2026-06-19T00:00:00.000Z';
        const dataWithTombstone: typeof first.data = {
            ...first.data,
            projects: first.data.projects.map((project) => (
                project.id === importedProjectId
                    ? { ...project, deletedAt, rev: (project.rev ?? 1) + 1 }
                    : project
            )),
        };

        const second = applyImport(dataWithTombstone, parsed, { ...OPTS, now: '2026-06-20T12:00:00.000Z' });

        expect(second.importedProjectCount).toBe(0);
        const stillTombstoned = second.data.projects.find((project) => project.id === importedProjectId);
        expect(stillTombstoned?.deletedAt).toBe(deletedAt);
        // No second, live "Launch" project was created alongside the tombstone.
        expect(second.data.projects.filter((project) => project.title === 'Launch' && !project.deletedAt)).toHaveLength(0);
    });
});
