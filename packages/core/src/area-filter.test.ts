import { describe, expect, it } from 'vitest';

import type { Area, Project, Task } from './types';
import {
    AREA_FILTER_ALL,
    AREA_FILTER_NONE,
    areaFilterSelectionToFilters,
    areaFilterSelectionToValue,
    cycleAreaFilterSelection,
    isAreaFilterSelectionActive,
    projectMatchesAreaFilter,
    projectMatchesAreaFilterSelection,
    resolveAreaFilter,
    resolveAreaFilterSelection,
    taskMatchesAreaFilter,
    taskMatchesAreaFilterSelection,
} from './area-filter';

const workArea: Area = {
    id: 'area-work',
    name: 'Work',
    order: 0,
    createdAt: '2026-03-16T00:00:00.000Z',
    updatedAt: '2026-03-16T00:00:00.000Z',
};

const project: Project = {
    id: 'project-1',
    title: 'Website',
    status: 'active',
    color: '#3b82f6',
    order: 0,
    tagIds: [],
    areaId: workArea.id,
    createdAt: '2026-03-16T00:00:00.000Z',
    updatedAt: '2026-03-16T00:00:00.000Z',
};

const baseTask: Task = {
    id: 'task-1',
    title: 'Ship changes',
    status: 'next',
    tags: [],
    contexts: [],
    createdAt: '2026-03-16T00:00:00.000Z',
    updatedAt: '2026-03-16T00:00:00.000Z',
};

describe('area filter utils', () => {
    it('resolves missing, deleted, and stale area filters to all areas', () => {
        expect(resolveAreaFilter(undefined, [workArea])).toBe(AREA_FILTER_ALL);
        expect(resolveAreaFilter('missing-area', [workArea])).toBe(AREA_FILTER_ALL);
        expect(resolveAreaFilter(workArea.id, [workArea])).toBe(workArea.id);
        expect(resolveAreaFilter(workArea.id, [{ ...workArea, deletedAt: '2026-03-17T00:00:00.000Z' }])).toBe(AREA_FILTER_ALL);
    });

    it('matches projects against all, none, and explicit areas', () => {
        const areaById = new Map([[workArea.id, workArea]]);

        expect(projectMatchesAreaFilter(project, AREA_FILTER_ALL, areaById)).toBe(true);
        expect(projectMatchesAreaFilter(project, workArea.id, areaById)).toBe(true);
        expect(projectMatchesAreaFilter(project, AREA_FILTER_NONE, areaById)).toBe(false);
        expect(projectMatchesAreaFilter({ ...project, areaId: undefined }, AREA_FILTER_NONE, areaById)).toBe(true);
    });

    it('matches tasks using the project area when present', () => {
        const projectById = new Map([[project.id, project]]);
        const areaById = new Map([[workArea.id, workArea]]);

        expect(taskMatchesAreaFilter({ ...baseTask, projectId: project.id }, AREA_FILTER_ALL, projectById, areaById)).toBe(true);
        expect(taskMatchesAreaFilter({ ...baseTask, projectId: project.id }, workArea.id, projectById, areaById)).toBe(true);
        expect(taskMatchesAreaFilter({ ...baseTask, projectId: project.id }, AREA_FILTER_NONE, projectById, areaById)).toBe(false);
        expect(taskMatchesAreaFilter({ ...baseTask }, AREA_FILTER_NONE, projectById, areaById)).toBe(true);
    });
});

const homeArea: Area = { ...workArea, id: 'area-home', name: 'Home' };
const deletedArea: Area = { ...workArea, id: 'area-old', name: 'Old', deletedAt: '2026-03-17T00:00:00.000Z' };
const allAreas = [workArea, homeArea, deletedArea];

describe('area filter selection', () => {
    it('reads the legacy single-value filter', () => {
        expect(resolveAreaFilterSelection(undefined, allAreas)).toEqual({ included: [], excluded: [] });
        expect(resolveAreaFilterSelection(AREA_FILTER_ALL, allAreas)).toEqual({ included: [], excluded: [] });
        expect(resolveAreaFilterSelection(AREA_FILTER_NONE, allAreas)).toEqual({ included: [AREA_FILTER_NONE], excluded: [] });
        expect(resolveAreaFilterSelection(workArea.id, allAreas)).toEqual({ included: [workArea.id], excluded: [] });
        expect(resolveAreaFilterSelection('missing-area', allAreas)).toEqual({ included: [], excluded: [] });
        expect(resolveAreaFilterSelection({ areaId: workArea.id }, allAreas)).toEqual({ included: [workArea.id], excluded: [] });
    });

    it('reads the stored selection and drops deleted or unknown areas', () => {
        expect(resolveAreaFilterSelection(
            { areaId: AREA_FILTER_ALL, areaIds: [workArea.id, deletedArea.id, 'gone', workArea.id], excludedAreaIds: [homeArea.id] },
            allAreas,
        )).toEqual({ included: [workArea.id], excluded: [homeArea.id] });
        // Stored lists win over the legacy mirror, even when they are empty.
        expect(resolveAreaFilterSelection({ areaId: workArea.id, areaIds: [] }, allAreas)).toEqual({ included: [], excluded: [] });
        expect(resolveAreaFilterSelection({ areaIds: 'nope' }, allAreas)).toEqual({ included: [], excluded: [] });
    });

    it('matches the union of inclusions minus the exclusions', () => {
        const projectById = new Map([[project.id, project]]);
        const areaById = new Map([[workArea.id, workArea], [homeArea.id, homeArea]]);
        const homeProject: Project = { ...project, id: 'project-2', areaId: homeArea.id };
        const orphanProject: Project = { ...project, id: 'project-3', areaId: undefined };
        const match = (selection: { included: string[]; excluded: string[] }) => [
            projectMatchesAreaFilterSelection(project, selection, areaById),
            projectMatchesAreaFilterSelection(homeProject, selection, areaById),
            projectMatchesAreaFilterSelection(orphanProject, selection, areaById),
        ];

        expect(match({ included: [], excluded: [] })).toEqual([true, true, true]);
        expect(match({ included: [homeArea.id], excluded: [] })).toEqual([false, true, false]);
        expect(match({ included: [], excluded: [workArea.id] })).toEqual([false, true, true]);
        expect(match({ included: [workArea.id, homeArea.id], excluded: [homeArea.id] })).toEqual([true, false, false]);
        expect(match({ included: [AREA_FILTER_NONE], excluded: [] })).toEqual([false, false, true]);
        expect(match({ included: [], excluded: [AREA_FILTER_NONE] })).toEqual([true, true, false]);

        const workTask = { ...baseTask, projectId: project.id };
        expect(taskMatchesAreaFilterSelection(workTask, { included: [], excluded: [] }, projectById, areaById)).toBe(true);
        expect(taskMatchesAreaFilterSelection(workTask, { included: [homeArea.id], excluded: [] }, projectById, areaById)).toBe(false);
        expect(taskMatchesAreaFilterSelection(workTask, { included: [], excluded: [workArea.id] }, projectById, areaById)).toBe(false);
        expect(taskMatchesAreaFilterSelection(baseTask, { included: [AREA_FILTER_NONE], excluded: [] }, projectById, areaById)).toBe(true);
        expect(taskMatchesAreaFilterSelection(baseTask, { included: [], excluded: [AREA_FILTER_NONE] }, projectById, areaById)).toBe(false);
    });

    it('cycles a row through included, excluded and unselected', () => {
        const start = { included: [], excluded: [] };
        const included = cycleAreaFilterSelection(start, workArea.id);
        expect(included).toEqual({ included: [workArea.id], excluded: [] });
        const excluded = cycleAreaFilterSelection(included, workArea.id);
        expect(excluded).toEqual({ included: [], excluded: [workArea.id] });
        expect(cycleAreaFilterSelection(excluded, workArea.id)).toEqual({ included: [], excluded: [] });
    });

    it('mirrors a single selected area into the legacy value', () => {
        expect(isAreaFilterSelectionActive({ included: [], excluded: [] })).toBe(false);
        expect(isAreaFilterSelectionActive({ included: [], excluded: [workArea.id] })).toBe(true);

        expect(areaFilterSelectionToValue({ included: [], excluded: [] })).toBe(AREA_FILTER_ALL);
        expect(areaFilterSelectionToValue({ included: [workArea.id], excluded: [] })).toBe(workArea.id);
        expect(areaFilterSelectionToValue({ included: [workArea.id, homeArea.id], excluded: [] })).toBe(AREA_FILTER_ALL);
        expect(areaFilterSelectionToValue({ included: [workArea.id], excluded: [homeArea.id] })).toBe(AREA_FILTER_ALL);
        expect(areaFilterSelectionToFilters({ included: [workArea.id], excluded: [homeArea.id] })).toEqual({
            areaId: AREA_FILTER_ALL,
            areaIds: [workArea.id],
            excludedAreaIds: [homeArea.id],
        });
    });

    it('round-trips what it stores', () => {
        const selection = { included: [workArea.id, AREA_FILTER_NONE], excluded: [homeArea.id] };
        expect(resolveAreaFilterSelection(areaFilterSelectionToFilters(selection), allAreas)).toEqual(selection);
    });
});
